export const SETTINGS_PREFS_KEY = "quair-settings";

const TRANSLATION_PERSIST_KEY = "quair-i18n-pairs-v2";
/** Cap stored KV pairs (~1–4 MB worst case); eviction keeps freshest tail of insertion order */
const TRANSLATION_PERSIST_MAX_ENTRIES = 4000;

const translationBatchSize = 64;
const parallelTranslationBatches = 12;

const textNodeOriginalMap = new WeakMap();
const attrOriginalMap = new WeakMap();
const translationCache = new Map();
const translatableTextNodes = [];
const translatableAttrTargets = [];

let _applyLanguageTimer = null;
let _pendingApplyLanguage = null;
let _translateApplyChain = Promise.resolve();
let _suppressDomTranslateObserver = 0;
let _domTranslateObserver = null;
let _domTranslateDebounceTimer = null;
let _persistTranslationRafId = null;
let _translationPersistHydrated = false;

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getStoredDisplayLanguage() {
  const settings = readJsonStorage(SETTINGS_PREFS_KEY, { displayLanguage: "en-US" });
  return settings.displayLanguage || "en-US";
}

export function getLanguageCodeForTranslation(displayLanguage) {
  return String(displayLanguage || "en").split("-")[0].toLowerCase();
}

function hydratePersistedTranslationCache() {
  if (_translationPersistHydrated) return;
  _translationPersistHydrated = true;
  try {
    const raw = localStorage.getItem(TRANSLATION_PERSIST_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && typeof v === "string") {
        translationCache.set(k, v);
      }
    }
  } catch {
    /* ignore corrupted storage */
  }
}

function schedulePersistTranslations() {
  if (_persistTranslationRafId !== null) return;
  _persistTranslationRafId = requestAnimationFrame(() => {
    _persistTranslationRafId = null;
    persistTranslationTail();
  });
}

function memoTranslation(cacheKey, value) {
  translationCache.set(cacheKey, value);
  schedulePersistTranslations();
}

function persistTranslationTail() {
  try {
    const entries = [...translationCache];
    const capped =
      entries.length > TRANSLATION_PERSIST_MAX_ENTRIES
        ? entries.slice(entries.length - TRANSLATION_PERSIST_MAX_ENTRIES)
        : entries;
    localStorage.setItem(TRANSLATION_PERSIST_KEY, JSON.stringify(Object.fromEntries(capped)));
  } catch {
    /* storage full — ignore */
  }
}

function collectTranslatableTargets() {
  translatableTextNodes.length = 0;
  translatableAttrTargets.length = 0;

  const skipSelector = "script, style, noscript, code, pre, svg, .notranslate, select, option, .custom-dropdown-menu";

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const parentElement = currentNode.parentElement;
    const currentText = currentNode.nodeValue || "";

    if (
      parentElement
      && currentText.trim()
      && !parentElement.closest(skipSelector)
      && !["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(parentElement.tagName)
    ) {
      if (!textNodeOriginalMap.has(currentNode)) {
        textNodeOriginalMap.set(currentNode, currentText);
      }
      translatableTextNodes.push(currentNode);
    }

    currentNode = walker.nextNode();
  }

  for (const element of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
    if (element.closest(skipSelector)) continue;
    if (!attrOriginalMap.has(element)) {
      attrOriginalMap.set(element, {
        placeholder: element.getAttribute("placeholder"),
        ariaLabel: element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
      });
    }
    translatableAttrTargets.push(element);
  }
}

function restoreOriginalLanguage() {
  for (const node of translatableTextNodes) {
    const originalText = textNodeOriginalMap.get(node);
    if (typeof originalText === "string") {
      node.nodeValue = originalText;
    }
  }

  for (const element of translatableAttrTargets) {
    const originalAttrs = attrOriginalMap.get(element);
    if (!originalAttrs) continue;

    const restorePairs = [
      ["placeholder", originalAttrs.placeholder],
      ["aria-label", originalAttrs.ariaLabel],
      ["title", originalAttrs.title],
    ];

    for (const [attrName, attrValue] of restorePairs) {
      if (typeof attrValue === "string") {
        element.setAttribute(attrName, attrValue);
      } else {
        element.removeAttribute(attrName);
      }
    }
  }
}

/** Build `{ items }` sharing the same traversal rules as the async pass. */
function buildTranslationItems() {
  const textNodesPayload = translatableTextNodes
    .map((node) => ({
      node,
      source: textNodeOriginalMap.get(node),
    }))
    .filter((item) => typeof item.source === "string" && item.source.trim());

  const attrPayload = [];
  for (const element of translatableAttrTargets) {
    const originalAttrs = attrOriginalMap.get(element);
    if (!originalAttrs) continue;

    const attrPairs = [
      ["placeholder", originalAttrs.placeholder],
      ["aria-label", originalAttrs.ariaLabel],
      ["title", originalAttrs.title],
    ];

    for (const [attrName, attrValue] of attrPairs) {
      if (typeof attrValue === "string" && attrValue.trim()) {
        attrPayload.push({ element, attrName, source: attrValue });
      }
    }
  }

  const items = [
    ...textNodesPayload.map((item) => ({ type: "text", target: item, source: item.source })),
    ...attrPayload.map((item) => ({ type: "attr", target: item, source: item.source })),
  ];
  return { items };
}

/**
 * Applies every string we already know (RAM + persisted) in one synchronous layout pass.
 * Call this FIRST on language changes so switching back to Telugu etc. snaps instantly.
 */
export function flushTranslationCacheToDom(displayLanguage) {
  hydratePersistedTranslationCache();
  _suppressDomTranslateObserver += 1;
  try {
    const targetLanguage = getLanguageCodeForTranslation(displayLanguage);
    document.documentElement.lang = displayLanguage || "en-US";
    collectTranslatableTargets();

    if (targetLanguage === "en") {
      restoreOriginalLanguage();
      return;
    }

    const { items } = buildTranslationItems();
    if (!items.length) return;

    for (const item of items) {
      const cacheKey = `${targetLanguage}|auto|${item.source}`;
      if (translationCache.has(cacheKey)) {
        _applyTranslatedItem(item, translationCache.get(cacheKey));
      }
    }
  } finally {
    _suppressDomTranslateObserver -= 1;
  }
}

async function translateBatch(texts, targetLanguage, sourceLanguage = "auto") {
  let response;
  try {
    response = await fetch("/api/translate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts,
        target_language: targetLanguage,
        source_language: sourceLanguage,
      }),
    });
  } catch {
    console.warn("[i18n] /api/translate network error — UI stays in English.");
    throw new Error("translate_fetch_failed");
  }

  if (!response.ok) {
    console.warn(`[i18n] /api/translate HTTP ${response.status} — serving static UI only?`);
    throw new Error(`Translate request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.translations) ? payload.translations : texts;
}

export async function translateTextsWithCache(texts, targetLanguage, sourceLanguage = "auto") {
  const output = new Array(texts.length);
  const uncached = [];
  const uncachedIndices = [];

  texts.forEach((text, index) => {
    const cacheKey = `${targetLanguage}|${sourceLanguage}|${text}`;
    if (translationCache.has(cacheKey)) {
      output[index] = translationCache.get(cacheKey);
    } else {
      uncached.push(text);
      uncachedIndices.push(index);
    }
  });

  for (let start = 0; start < uncached.length; start += translationBatchSize) {
    const batchTexts = uncached.slice(start, start + translationBatchSize);
    const batchTranslations = await translateBatch(batchTexts, targetLanguage, sourceLanguage);

    batchTexts.forEach((batchText, batchIndex) => {
      const translatedText = batchTranslations[batchIndex] || batchText;
      const cacheKey = `${targetLanguage}|${sourceLanguage}|${batchText}`;
      memoTranslation(cacheKey, translatedText);
      const originalIndex = uncachedIndices[start + batchIndex];
      output[originalIndex] = translatedText;
    });
  }

  return output;
}

function _applyTranslatedItem(item, translatedText) {
  if (item.type === "text") {
    item.target.node.nodeValue = translatedText;
    return;
  }
  item.target.element.setAttribute(item.target.attrName, translatedText);
}

export function syncOverlayModalState() {
  const isOpen = Boolean(
    document.getElementById("settingsModal")?.classList.contains("is-open")
    || document.getElementById("authModal")?.classList.contains("is-open")
    || document.getElementById("profileModal")?.classList.contains("is-open"),
  );
  document.body.classList.toggle("is-overlay-open", isOpen);
}

export function refreshPageLanguage() {
  schedulePageLanguage(getStoredDisplayLanguage(), { immediate: true });
}

function queueTranslateAsync(displayLanguage) {
  _translateApplyChain = _translateApplyChain
    .catch(() => {})
    .then(() => fetchMissingTranslationsAndApply(displayLanguage));
}

export function schedulePageLanguage(displayLanguage, options = {}) {
  hydratePersistedTranslationCache();

  const immediate = options.immediate === true;
  _pendingApplyLanguage = displayLanguage;

  if (_applyLanguageTimer) {
    clearTimeout(_applyLanguageTimer);
    _applyLanguageTimer = null;
  }

  if (immediate) {
    flushTranslationCacheToDom(displayLanguage);
    queueTranslateAsync(displayLanguage);
    return;
  }

  _applyLanguageTimer = setTimeout(() => {
    _applyLanguageTimer = null;
    const lang = _pendingApplyLanguage ?? displayLanguage;
    flushTranslationCacheToDom(lang);
    queueTranslateAsync(lang);
  }, 48);
}

async function translateSourcesParallel(uniqueSources, targetLanguage, onWaveComplete) {
  const chunks = [];
  for (let start = 0; start < uniqueSources.length; start += translationBatchSize) {
    chunks.push(uniqueSources.slice(start, start + translationBatchSize));
  }

  for (let waveStart = 0; waveStart < chunks.length; waveStart += parallelTranslationBatches) {
    const wave = chunks.slice(waveStart, waveStart + parallelTranslationBatches);
    const results = await Promise.all(
      wave.map((batch) => translateBatch(batch, targetLanguage, "auto").catch(() => batch)),
    );

    for (let w = 0; w < wave.length; w++) {
      const batchSources = wave[w];
      const batchTranslations = results[w];
      for (let j = 0; j < batchSources.length; j++) {
        memoTranslation(`${targetLanguage}|auto|${batchSources[j]}`, batchTranslations[j] || batchSources[j]);
      }
    }

    onWaveComplete?.();
  }
}

async function fetchMissingTranslationsAndApply(displayLanguage) {
  hydratePersistedTranslationCache();
  _suppressDomTranslateObserver += 1;
  try {
    const targetLanguage = getLanguageCodeForTranslation(displayLanguage);
    document.documentElement.lang = displayLanguage || "en-US";
    collectTranslatableTargets();

    if (targetLanguage === "en") {
      restoreOriginalLanguage();
      return;
    }

    const { items } = buildTranslationItems();

    if (!items.length) return;

    try {
      /** Start from freshest originals so duplicates keep correct keys */
      flushTranslationCacheToDom(displayLanguage);

      const uncached = [];
      for (const item of items) {
        const cacheKey = `${targetLanguage}|auto|${item.source}`;
        if (!translationCache.has(cacheKey)) {
          uncached.push(item);
        }
      }

      if (!uncached.length) {
        flushTranslationCacheToDom(displayLanguage);
        return;
      }

      const priorityRootSelector = "#settingsModal, .settings-popup, .top-header, .hero, .search-shell, .search-tabs, .page-wrap, main";
      const isPriorityItem = (item) => {
        const root = item.type === "text" ? item.target.node.parentElement : item.target.element;
        return Boolean(root?.closest(priorityRootSelector));
      };

      const orderedUncached = [
        ...uncached.filter(isPriorityItem),
        ...uncached.filter((item) => !isPriorityItem(item)),
      ];

      const uniqueSources = [];
      const seenSources = new Set();
      for (const item of orderedUncached) {
        if (!seenSources.has(item.source)) {
          seenSources.add(item.source);
          uniqueSources.push(item.source);
        }
      }

      const applyCachedTranslations = () => flushTranslationCacheToDom(displayLanguage);

      await translateSourcesParallel(uniqueSources, targetLanguage, applyCachedTranslations);
      applyCachedTranslations();
    } catch {
      restoreOriginalLanguage();
    }
  } finally {
    _suppressDomTranslateObserver -= 1;
  }
}

export async function translateQueryForSearch(query, displayLanguage) {
  const sourceLanguage = getLanguageCodeForTranslation(displayLanguage);

  if (!query.trim() || sourceLanguage === "en") {
    return query;
  }

  hydratePersistedTranslationCache();
  try {
    const translated = await translateTextsWithCache([query], "en", sourceLanguage);
    return translated[0] || query;
  } catch {
    return query;
  }
}

export function initPageI18nObserver() {
  if (_domTranslateObserver || !document.body) return;

  hydratePersistedTranslationCache();

  _domTranslateObserver = new MutationObserver(() => {
    if (_suppressDomTranslateObserver > 0) return;
    if (_domTranslateDebounceTimer) clearTimeout(_domTranslateDebounceTimer);
    _domTranslateDebounceTimer = setTimeout(() => {
      _domTranslateDebounceTimer = null;
      schedulePageLanguage(getStoredDisplayLanguage());
    }, 80);
  });

  _domTranslateObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_PREFS_KEY || event.key === TRANSLATION_PERSIST_KEY) {
      if (event.key === TRANSLATION_PERSIST_KEY) {
        _translationPersistHydrated = false;
      }
      schedulePageLanguage(getStoredDisplayLanguage(), { immediate: true });
    }
  });
}

function initStandalonePageI18n() {
  initPageI18nObserver();
  schedulePageLanguage(getStoredDisplayLanguage(), { immediate: true });
}

const isMainSearchApp = Boolean(document.getElementById("query") || document.getElementById("resultsQuery"));
if (!isMainSearchApp) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStandalonePageI18n, { once: true });
  } else {
    initStandalonePageI18n();
  }
}
