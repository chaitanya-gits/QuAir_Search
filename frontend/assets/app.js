const historyKey = "ai-search-history";
const historySavingKey = "quair-history-saving";
const profilePrefsKey = "quair-profile-preferences";
const settingsPrefsKey = "quair-settings";
const knownAccountsKey = "quair-known-accounts";
const bookmarksKey = "quair-bookmarks";
const defaultSearchPlaceholder = "Search anything";
const translationBatchSize = 60;
const searchCacheTtlMs = 60_000;
const LIVE_LOCATION_MIN_UPDATE_METERS = 20;
const WEATHER_REFRESH_MIN_UPDATE_METERS = 10;

const APP_BRAND_TITLE = "[QuAir Search]";

const topLanguageOptions = [
  "en-US", "en-GB", "en-IN", "en-AU", "en-CA", "en-NZ", "en-ZA", "en-IE",
  "hi", "bn", "te", "mr", "ta", "ur", "gu", "kn", "ml", "pa", "or", "as", "sa", "ne", "si",
  "es", "es-MX", "es-AR", "fr", "fr-CA", "de", "it", "pt", "pt-BR", "ru", "uk", "be",
  "zh", "zh-TW", "ja", "ko", "ar", "tr", "nl", "pl", "sv", "no", "da", "fi",
  "el", "he", "th", "vi", "id", "ms", "tl", "fil", "ro", "hu", "cs", "sk", "sl", "hr", "sr", "bg",
  "lt", "lv", "et", "fa", "ps", "sw", "am", "ti", "so", "zu", "xh", "af", "st", "sn", "rw", "ny",
  "is", "ga", "cy", "gd", "mt", "sq", "mk", "bs", "kk", "uz", "ky", "tg", "tk", "mn", "az", "hy", "ka",
  "my", "km", "lo", "eu", "gl", "ca", "co", "oc", "br", "eo", "la", "yi", "yo", "ig", "ha",
  "ceb", "jv", "su", "mg", "mi", "haw", "sm", "to", "fj", "lb", "fo", "ku", "ckb", "sd"
];

const topRegionOptions = [
  "AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ",
  "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI",
  "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CD", "CR", "CI", "HR", "CU", "CY", "CZ",
  "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET",
  "FJ", "FI", "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW", "GY",
  "HT", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT",
  "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG",
  "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU",
  "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM",
  "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO",
  "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PL", "PT", "PR", "QA",
  "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY",
  "TW", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV", "UG", "UA", "AE", "GB", "US", "UY", "UZ",
  "VU", "VA", "VE", "VN", "YE", "ZM", "ZW"
];

const textNodeOriginalMap = new WeakMap();
const attrOriginalMap = new WeakMap();
const translationCache = new Map();
const translatableTextNodes = [];
const translatableAttrTargets = [];

const TAB_FAVICON_DEFAULT = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%234870ff'/%3E%3Cellipse cx='32' cy='32' rx='22' ry='8' fill='none' stroke='%23fff' stroke-width='2.5'/%3E%3Cellipse cx='32' cy='32' rx='22' ry='8' fill='none' stroke='%23fff' stroke-width='2.5' transform='rotate(60 32 32)'/%3E%3Cellipse cx='32' cy='32' rx='22' ry='8' fill='none' stroke='%23fff' stroke-width='2.5' transform='rotate(120 32 32)'/%3E%3Ccircle cx='32' cy='32' r='5' fill='%23fff'/%3E%3C/svg%3E";
function buildTabSpinnerFrame(deg) {
  const safeDeg = Number.isFinite(deg) ? deg : 0;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4870ff"/>
          <stop offset="1" stop-color="#1a73e8"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="white"/>
      <g transform="rotate(${safeDeg} 32 32)">
        <circle cx="32" cy="32" r="20" fill="none" stroke="#dfe6ff" stroke-width="6"/>
        <path d="M52 32a20 20 0 0 0-20-20" fill="none" stroke="url(#g)" stroke-linecap="round" stroke-width="6"/>
      </g>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const TAB_FAVICON_LOADING_FRAMES = Array.from({ length: 12 }, (_, i) => buildTabSpinnerFrame(i * 30));
let tabFaviconSpinnerTimer = null;
let tabFaviconSpinnerFrame = 0;

function getTabFaviconLink() {
  return document.querySelector("link#favicon") || document.querySelector("link[rel~='icon']");
}

function setTabFavicon(href) {
  const link = getTabFaviconLink();
  if (!link) return;
  const nextHref = String(href || "").trim() || TAB_FAVICON_DEFAULT;
  if (link.getAttribute("href") === nextHref) return;
  link.setAttribute("href", nextHref);
}

function setTabTitleForQuery(query) {
  const trimmed = String(query || "").trim();
  document.title = trimmed ? `${trimmed} - ${APP_BRAND_TITLE}` : APP_BRAND_TITLE;
}

function setTabLoadingState(isLoading, query) {
  setTabTitleForQuery(query);
  if (tabFaviconSpinnerTimer) {
    clearInterval(tabFaviconSpinnerTimer);
    tabFaviconSpinnerTimer = null;
  }

  if (isLoading) {
    tabFaviconSpinnerFrame = 0;
    setTabFavicon(TAB_FAVICON_LOADING_FRAMES[tabFaviconSpinnerFrame]);
    tabFaviconSpinnerTimer = window.setInterval(() => {
      tabFaviconSpinnerFrame = (tabFaviconSpinnerFrame + 1) % TAB_FAVICON_LOADING_FRAMES.length;
      setTabFavicon(TAB_FAVICON_LOADING_FRAMES[tabFaviconSpinnerFrame]);
    }, 80);
  } else {
    setTabFavicon(TAB_FAVICON_DEFAULT);
  }
}

const elements = {
  answerText: document.getElementById("answerText"),
  answerWrap: document.getElementById("aiAnswer"),
  authBackdrop: document.getElementById("authBackdrop"),
  authCloseButton: document.getElementById("authCloseButton"),
  authDescription: document.getElementById("authDescription"),
  authEmailInput: document.getElementById("authEmailInput"),
  authEyebrow: document.getElementById("authEyebrow"),
  authForm: document.getElementById("authForm"),
  authModal: document.getElementById("authModal"),
  authSubmitButton: document.getElementById("authSubmitButton"),
  authTitle: document.getElementById("authTitle"),
  avatarButton: document.getElementById("avatarButton"),
  avatarFallback: document.getElementById("avatarFallback"),
  avatarImage: document.getElementById("avatarImage"),
  imagePreviewBackdrop: document.getElementById("imagePreviewBackdrop"),
  imagePreviewCloseButton: document.getElementById("imagePreviewCloseButton"),
  imagePreviewImage: document.getElementById("imagePreviewImage"),
  imagePreviewModal: document.getElementById("imagePreviewModal"),
  logoutButton: document.getElementById("logoutButton"),
  profileAvatarFileInput: document.getElementById("profileAvatarFileInput"),
  profilePhotoMenu: document.getElementById("profilePhotoMenu"),
  profilePhotoMenuBackdrop: document.getElementById("profilePhotoMenuBackdrop"),
  profilePhotoMenuUploadBtn: document.getElementById("profilePhotoMenuUploadBtn"),
  profilePhotoMenuRemoveBtn: document.getElementById("profilePhotoMenuRemoveBtn"),
  profilePhotoMenuCancelBtn: document.getElementById("profilePhotoMenuCancelBtn"),
  profileBackdrop: document.getElementById("profileBackdrop"),
  profileCloseButton: document.getElementById("profileCloseButton"),
  profileDropdown: document.getElementById("profileDropdown"),
  profileEmail: document.getElementById("profileEmail"),
  profileForm: document.getElementById("profileForm"),
  profileHandleInput: document.getElementById("profileHandleInput"),
  profileModal: document.getElementById("profileModal"),
  profileNameInput: document.getElementById("profileNameInput"),
  profileName: document.getElementById("profileName"),
  profileOverviewSection: document.getElementById("profileOverviewSection"),
  profilePanelDescription: document.getElementById("profilePanelDescription"),
  profilePanelTitle: document.getElementById("profilePanelTitle"),
  profileSummaryAvatar: document.getElementById("profileSummaryAvatar"),
  profileSummaryEmail: document.getElementById("profileSummaryEmail"),
  profileSummaryFallback: document.getElementById("profileSummaryFallback"),
  profileSummaryName: document.getElementById("profileSummaryName"),
  profileGreeting: document.getElementById("profileGreeting"),
  profileSummaryProvider: document.getElementById("profileSummaryProvider"),
  adminActivitySection: document.getElementById("adminActivitySection"),
  adminActivityRefreshButton: document.getElementById("adminActivityRefreshButton"),
  adminActivityStatus: document.getElementById("adminActivityStatus"),
  adminActivityTableBody: document.getElementById("adminActivityTableBody"),
  adminReportSummary: document.getElementById("adminReportSummary"),
  adminReportJson: document.getElementById("adminReportJson"),
  settingDisplayLanguage: document.getElementById("settingDisplayLanguage"),
  settingRegion: document.getElementById("settingRegion"),
  settingTheme: document.getElementById("settingTheme"),
  settingSafeSearch: document.getElementById("settingSafeSearch"),
  settingThemeSystemBtn: document.getElementById("settingThemeSystemBtn"),
  settingThemeLightBtn: document.getElementById("settingThemeLightBtn"),
  settingThemeDarkBtn: document.getElementById("settingThemeDarkBtn"),
  settingSafeSearchToggle: document.getElementById("settingSafeSearchToggle"),
  settingsForm: document.getElementById("settingsForm"),
  historyBackdrop: document.getElementById("historyBackdrop"),
  historyCloseButton: document.getElementById("historyCloseButton"),
  historyDeleteAllButton: document.getElementById("historyDeleteAllButton"),
  historyList: document.getElementById("historyList"),
  historyModal: document.getElementById("historyModal"),
  historySavingToggle: document.getElementById("historySavingToggle"),
  historyStatusLabel: document.getElementById("historyStatusLabel"),
  languageStatusLabel: document.getElementById("languageStatusLabel"),
  menuLanguage: document.getElementById("menuLanguage"),
  menuAdminDashboard: document.getElementById("menuAdminDashboard"),
  menuSafeSearch: document.getElementById("menuSafeSearch"),
  menuSearchHistory: document.getElementById("menuSearchHistory"),
  safeSearchStatusLabel: document.getElementById("safeSearchStatusLabel"),
  accountsList: document.getElementById("accountsList"),
  addAccountButton: document.getElementById("addAccountButton"),
  topBrandButton: document.getElementById("topBrandButton"),
  headerSettingsBtn: document.getElementById("headerSettingsBtn"),
  userProfile: document.getElementById("userProfile"),
  instantAnswer: document.getElementById("instantAnswer"),
  loadMoreWrap: document.getElementById("loadMoreWrap"),
  loadMoreButton: document.getElementById("loadMoreButton"),
  historyExportButton: document.getElementById("historyExportButton"),
  menuBookmarks: document.getElementById("menuBookmarks"),
  bookmarksModal: document.getElementById("bookmarksModal"),
  bookmarksBackdrop: document.getElementById("bookmarksBackdrop"),
  bookmarksCloseButton: document.getElementById("bookmarksCloseButton"),
  bookmarksList: document.getElementById("bookmarksList"),
  utilitiesToggle: document.getElementById("utilitiesToggle"),
  utilitiesPanel: document.getElementById("utilitiesPanel"),
  utilityCalculatorForm: document.getElementById("utilityCalculatorForm"),
  utilityCalculatorInput: document.getElementById("utilityCalculatorInput"),
  utilityCalculatorOutput: document.getElementById("utilityCalculatorOutput"),
  utilityConverterForm: document.getElementById("utilityConverterForm"),
  utilityConverterInput: document.getElementById("utilityConverterInput"),
  utilityConverterOutput: document.getElementById("utilityConverterOutput"),
  utilityCalcExpr: document.getElementById("utilityCalcExpr"),
  utilityCalcResult: document.getElementById("utilityCalcResult"),
  utilityDistanceFrom: document.getElementById("utilityDistanceFrom"),
  utilityDistanceFromUnit: document.getElementById("utilityDistanceFromUnit"),
  utilityDistanceTo: document.getElementById("utilityDistanceTo"),
  utilityDistanceToUnit: document.getElementById("utilityDistanceToUnit"),
  utilityDistanceSwap: document.getElementById("utilityDistanceSwap"),
  utilityTimeOutput: document.getElementById("utilityTimeOutput"),
  utilityTimeMeta: document.getElementById("utilityTimeMeta"),
  utilityTzSelect1: document.getElementById("utilityTzSelect1"),
  utilityTzSelect2: document.getElementById("utilityTzSelect2"),
  utilityTzSelect3: document.getElementById("utilityTzSelect3"),
  utilityTzSelectA1: document.getElementById("utilityTzSelectA1"),
  utilityTzSelectA2: document.getElementById("utilityTzSelectA2"),
  utilityTzSelectA3: document.getElementById("utilityTzSelectA3"),
  utilityTimeTzOutput1: document.getElementById("utilityTimeTzOutput1"),
  utilityTimeTzOutput2: document.getElementById("utilityTimeTzOutput2"),
  utilityTimeTzOutput3: document.getElementById("utilityTimeTzOutput3"),
  utilityTimeTzMeta1: document.getElementById("utilityTimeTzMeta1"),
  utilityTimeTzMeta2: document.getElementById("utilityTimeTzMeta2"),
  utilityTimeTzMeta3: document.getElementById("utilityTimeTzMeta3"),
  utilityAnalogHourHand: document.getElementById("utilityAnalogHourHand"),
  utilityAnalogMinuteHand: document.getElementById("utilityAnalogMinuteHand"),
  utilityAnalogSecondHand: document.getElementById("utilityAnalogSecondHand"),
  utilityTimeModeDigitalBtn: document.getElementById("utilityTimeModeDigitalBtn"),
  utilityTimeModeAnalogBtn: document.getElementById("utilityTimeModeAnalogBtn"),
  utilityTimeDigitalWrap: document.getElementById("utilityTimeDigitalWrap"),
  utilityTimeAnalogWrap: document.getElementById("utilityTimeAnalogWrap"),

  utilityCurrencyForm: document.getElementById("utilityCurrencyForm"),
  utilityCurrencyAmount: document.getElementById("utilityCurrencyAmount"),
  utilityCurrencyFrom: document.getElementById("utilityCurrencyFrom"),
  utilityCurrencyTo: document.getElementById("utilityCurrencyTo"),
  utilityCurrencyOutput: document.getElementById("utilityCurrencyOutput"),
  utilityCurrencyMeta: document.getElementById("utilityCurrencyMeta"),
  settingsModal: document.getElementById("settingsModal"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  settingsCloseBtn: document.getElementById("settingsCloseBtn"),
  settingsPopupForm: document.getElementById("settingsPopupForm"),
  settingsPopupLanguage: document.getElementById("settingsPopupLanguage"),
  settingsPopupRegion: document.getElementById("settingsPopupRegion"),
  settingsPopupThemeSystem: document.getElementById("settingsPopupThemeSystem"),
  settingsPopupThemeLight: document.getElementById("settingsPopupThemeLight"),
  settingsPopupThemeDark: document.getElementById("settingsPopupThemeDark"),
  settingsPopupSafeSearch: document.getElementById("settingsPopupSafeSearch"),
  attachButton: document.getElementById("attachButton"),
  attachPreview: document.getElementById("attachPreview"),
  attachMenu: document.getElementById("attachMenu"),
  citations: document.getElementById("citations"),
  emptyState: document.getElementById("emptyState"),
  filePicker: document.getElementById("filePicker"),
  locationMeta: document.getElementById("locationMeta"),
  weatherLocationControls: document.getElementById("weatherLocationControls"),
  weatherLocationCloseBtn: document.getElementById("weatherLocationCloseBtn"),
  weatherLocationForm: document.getElementById("weatherLocationForm"),
  weatherCityInput: document.getElementById("weatherCityInput"),
  weatherStateInput: document.getElementById("weatherStateInput"),
  weatherCountryInput: document.getElementById("weatherCountryInput"),
  weatherPincodeInput: document.getElementById("weatherPincodeInput"),
  weatherLocationToggle: document.getElementById("weatherLocationToggle"),
  locationText: document.getElementById("locationText"),
  weatherCard: document.getElementById("weatherCard"),
  weatherBody: document.getElementById("weatherBody"),
  weatherEmoji: document.getElementById("weatherEmoji"),
  weatherTemp: document.getElementById("weatherTemp"),
  weatherFeels: document.getElementById("weatherFeels"),
  weatherTime: document.getElementById("weatherTime"),
  weatherDatetime: document.getElementById("weatherDatetime"),
  weatherHeaderCondition: document.getElementById("weatherHeaderCondition"),
  weatherForecast: document.getElementById("weatherForecast"),
  weatherCondition: document.getElementById("weatherCondition"),
  weatherHumidity: document.getElementById("weatherHumidity"),
  weatherWind: document.getElementById("weatherWind"),
  weatherRain: document.getElementById("weatherRain"),
  weatherUV: document.getElementById("weatherUV"),
  weatherRefreshBtn: document.getElementById("weatherRefreshBtn"),
  queryInput: document.getElementById("query"),
  clearButton: document.getElementById("clearButton"),
  results: document.getElementById("results"),
  resultsHead: document.getElementById("resultsHead"),
  analyticsBoard: document.getElementById("analyticsBoard"),
  searchTabs: Array.from(document.querySelectorAll("[data-search-tab]")),
  searchButton: document.getElementById("searchButton"),
  searchShell: document.querySelector(".search-shell"),
  statusPill: document.getElementById("statusPill"),
  searchingStatus: document.getElementById("searchingStatus"),
  spellCorrection: document.getElementById("spellCorrection"),
  spellCorrectedLink: document.getElementById("spellCorrectedLink"),
  spellOriginalLink: document.getElementById("spellOriginalLink"),
  suggestPanel: document.getElementById("suggestPanel"),
  uploadAttachmentButton: document.getElementById("uploadAttachmentButton"),
  voiceButton: document.getElementById("voiceButton"),
  voiceFeedback: document.getElementById("voiceFeedback"),
  voiceStopButton: document.getElementById("voiceStopButton"),
};

const state = {
  activeItems: [],
  activeIndex: -1,
  activeSearchToken: 0,
  answerTypingTimer: null,
  answerTypingToken: 0,
  attachmentContext: "",
  attachmentSummary: "",
  attachments: [],
  bestLocationAccuracy: Number.POSITIVE_INFINITY,
  lastSubmittedQuery: "",
  lastLocationCoords: null,
  lastWeatherCoords: null,
  liveSuggestions: [],
  liveLocationAvailable: false,
  manualWeatherLocation: null,
  locationSettled: false,
  locationPermissionStatus: null,
  locationWatchId: null,
  profileUser: null,
  recognition: null,
  searchController: null,
  languageApplyToken: 0,
  voiceDraft: "",
  voicePreviousValue: "",
  lastSearchPayload: null,
  lastSearchEventId: null,
  searchCache: new Map(),
  displayedResultCount: 0,
  resultPageSize: 10,
  previewHoverTimer: null,
  suggestRequestToken: 0,
  suggestTimer: null,
  utilityTimeTimer: null,
  weatherFetchedForCoords: null,
  adminActivityRows: [],
};

// ── Analytics tracker ────────────────────────────────────────────────────────
function getAnonymousId() {
  let id = localStorage.getItem("quair-anon-id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("quair-anon-id", id);
  }
  return id;
}

async function trackSearch({ queryRaw, queryNormalized, resultCount, responseMs, settings }) {
  try {
    const response = await fetch("/api/track/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-anonymous-id": getAnonymousId() },
      body: JSON.stringify({
        anonymous_id: getAnonymousId(),
        query_raw: queryRaw,
        query_normalized: queryNormalized,
        result_count: resultCount,
        response_ms: responseMs,
        region: settings?.region || "",
        display_language: settings?.displayLanguage || "en-US",
        safe_search: settings?.safeSearch || "moderate",
        has_attachment: Boolean(state.attachments?.length),
        search_tab: "all",
      }),
      keepalive: true,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.event_id || null;
  } catch {
    return null;
  }
}

async function trackClick({ searchEventId, resultUrl, resultTitle, resultDomain, resultRank, queryRaw }) {
  try {
    await fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-anonymous-id": getAnonymousId() },
      body: JSON.stringify({
        anonymous_id: getAnonymousId(),
        search_event_id: searchEventId || null,
        result_url: resultUrl,
        result_title: resultTitle || "",
        result_domain: resultDomain || "",
        result_rank: resultRank || null,
        query_raw: queryRaw || "",
      }),
      keepalive: true,
    });
  } catch {
    // best-effort only
  }
}

function formatAdminTimestamp(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
}

function renderAdminActivityTable(rows) {
  if (!elements.adminActivityTableBody) {
    return;
  }

  if (!rows.length) {
    elements.adminActivityTableBody.innerHTML = `
      <tr>
        <td colspan="7">No signed-in search activity has been recorded yet.</td>
      </tr>
    `;
    return;
  }

  elements.adminActivityTableBody.innerHTML = rows.map((row) => {
    const visitedUrl = String(row.visited_url || "").trim();
    const visitedCell = visitedUrl
      ? `<a href="${escapeAttribute(visitedUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(row.visited_domain || visitedUrl)}</a>`
      : "—";

    return `
      <tr>
        <td>${escapeHtml(row.display_name || "User")}</td>
        <td>${escapeHtml(row.email || "—")}</td>
        <td>${escapeHtml(formatAdminTimestamp(row.signed_up_at))}</td>
        <td>${escapeHtml(row.query_raw || row.query_normalized || "—")}</td>
        <td>${escapeHtml(formatAdminTimestamp(row.searched_at))}</td>
        <td>${visitedCell}</td>
        <td>${escapeHtml(formatAdminTimestamp(row.visited_at))}</td>
      </tr>
    `;
  }).join("");
}

function renderAdminReport(report) {
  if (!elements.adminReportSummary || !elements.adminReportJson) {
    return;
  }

  const summary = report?.summary || {};
  const users = Number(summary.total_users || 0);
  const searches = Number(summary.identified_searches || 0);
  const clicks = Number(summary.identified_clicks || 0);
  const sessions = Number(summary.active_sessions || 0);

  elements.adminReportSummary.textContent = `Users: ${users} | Active sessions: ${sessions} | Identified searches: ${searches} | Identified clicks: ${clicks}`;
  elements.adminReportJson.textContent = JSON.stringify(report, null, 2);
}

async function loadAdminActivity() {
  if (!state.profileUser?.is_admin || !elements.adminActivityStatus) {
    return;
  }

  elements.adminActivityStatus.textContent = "Loading activity…";

  try {
    const response = await fetch("/api/admin/activity?limit=100", { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`Admin activity request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    state.adminActivityRows = rows;
    renderAdminActivityTable(rows);
    elements.adminActivityStatus.textContent = `${payload?.total ?? rows.length} tracked signed-in search events`;

    const reportResponse = await fetch("/api/admin/report?sample_limit=10", { credentials: "same-origin" });
    if (!reportResponse.ok) {
      throw new Error(`Admin report request failed with status ${reportResponse.status}`);
    }
    const reportPayload = await reportResponse.json();
    renderAdminReport(reportPayload);
  } catch (error) {
    console.error(error);
    state.adminActivityRows = [];
    renderAdminActivityTable([]);
    elements.adminActivityStatus.textContent = "Admin activity could not be loaded.";
    if (elements.adminReportSummary) {
      elements.adminReportSummary.textContent = "Admin report unavailable.";
    }
    if (elements.adminReportJson) {
      elements.adminReportJson.textContent = "";
    }
  }
}

const devRefreshState = {
  currentVersion: null,
  isEnabled: false,
  timerId: null,
};

const FALLBACK_FX_USD_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  JPY: 155,
  CAD: 1.37,
  AUD: 1.52,
  SGD: 1.35,
  CNY: 7.24,
  BRL: 5.12,
};

function getUserHistoryKey() {
  const user = state.profileUser;
  if (!user) return `${historyKey}:anonymous`;
  const id = String(user.id || user.email || user.username || "").trim().toLowerCase();
  return id ? `${historyKey}:${user.provider || "unknown"}:${id}` : `${historyKey}:anonymous`;
}

function isHistorySavingEnabled() {
  // Only save history for authenticated users.
  if (!state.profileUser) {
    return false;
  }
  const raw = localStorage.getItem(historySavingKey);
  return raw === null ? true : raw === "true";
}

function setHistorySaving(enabled) {
  localStorage.setItem(historySavingKey, String(enabled));
  syncHistoryUiState();
}

function readHistoryEntries() {
  try {
    const rawValue = localStorage.getItem(getUserHistoryKey()) || "[]";
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue.map((item) => {
      if (typeof item === "string") return { id: generateEntryId(), query: item, timestamp: 0 };
      if (item && typeof item.query === "string") {
        if (!item.id) item.id = generateEntryId();
        return item;
      }
      return null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function readHistory() {
  return readHistoryEntries().map((e) => e.query);
}

function writeHistoryEntries(entries) {
  localStorage.setItem(getUserHistoryKey(), JSON.stringify(entries.slice(0, 50)));
}

function writeHistory(items) {
  const existing = readHistoryEntries();
  const merged = items.map((q) => {
    const found = existing.find((e) => e.query.toLowerCase() === q.toLowerCase());
    return found || { query: q, timestamp: Date.now() };
  });
  writeHistoryEntries(merged);
}

function readJsonStorage(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallbackValue;
    }

    return { ...fallbackValue, ...JSON.parse(rawValue) };
  } catch {
    return fallbackValue;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUserProfileStorageKey(user) {
  const provider = String(user?.provider || "").trim().toLowerCase() || "unknown";
  const stableId = String(user?.id || user?.email || user?.username || "").trim().toLowerCase();
  return stableId ? `${provider}:${stableId}` : "anonymous";
}

function removeHistoryItem(value) {
  const entries = readHistoryEntries().filter(
    (e) => e.query.toLowerCase() !== value.toLowerCase(),
  );
  writeHistoryEntries(entries);
  openDropdown(elements.queryInput.value);
}

function getUserBookmarksKey() {
  const user = state.profileUser;
  if (!user) return null;
  const id = String(user.id || user.email || user.username || "").trim().toLowerCase();
  return id ? `${bookmarksKey}:${user.provider || "unknown"}:${id}` : null;
}

function readBookmarks() {
  const key = getUserBookmarksKey();
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

function writeBookmarks(items) {
  const key = getUserBookmarksKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(items.slice(0, 200)));
}

function addBookmark(url, title, snippet) {
  if (!state.profileUser) return false;
  const existing = readBookmarks();
  if (existing.some((b) => b.url === url)) return true;
  existing.unshift({ url, title, snippet: snippet || "", timestamp: Date.now() });
  writeBookmarks(existing);
  return true;
}

function removeBookmark(url) {
  if (!state.profileUser) return;
  writeBookmarks(readBookmarks().filter((b) => b.url !== url));
}

function isBookmarked(url) {
  if (!state.profileUser) return false;
  return readBookmarks().some((b) => b.url === url);
}

function renderBookmarksList() {
  if (!state.profileUser) {
    elements.bookmarksList.innerHTML = '<div class="history-empty">Sign in to save and view your bookmarks.</div>';
    return;
  }
  const bookmarks = readBookmarks();
  if (!bookmarks.length) {
    elements.bookmarksList.innerHTML = '<div class="history-empty">No bookmarks yet. Click the bookmark icon on search results to save them.</div>';
    return;
  }
  let html = "";
  for (const bm of bookmarks) {
    const host = (() => { try { return new URL(bm.url).hostname; } catch { return bm.url; } })();
    html += `<div class="history-entry">
      <img class="history-entry-favicon" src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host)}" alt="" />
      <div class="history-entry-body">
        <a class="history-entry-query" href="${escapeHtml(bm.url)}" target="_blank" rel="noreferrer noopener" style="text-decoration:none;color:inherit">${escapeHtml(bm.title)}</a>
        <span class="history-entry-source">${escapeHtml(host)}</span>
      </div>
      <button class="history-entry-delete" type="button" title="Remove bookmark" data-bm-url="${escapeHtml(bm.url)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`;
  }
  elements.bookmarksList.innerHTML = html;
  for (const btn of elements.bookmarksList.querySelectorAll("[data-bm-url]")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeBookmark(btn.getAttribute("data-bm-url"));
      renderBookmarksList();
    });
  }
}

function openBookmarksModal() {
  closeHistoryModal();
  renderBookmarksList();
  elements.bookmarksModal.classList.add("is-open");
  elements.bookmarksModal.setAttribute("aria-hidden", "false");
}

function closeBookmarksModal() {
  elements.bookmarksModal.classList.remove("is-open");
  elements.bookmarksModal.setAttribute("aria-hidden", "true");
}

function exportHistoryAs(format) {
  const entries = readHistoryEntries();
  if (!entries.length) return;
  let content = "";
  let mime = "application/json";
  let ext = "json";
  if (format === "csv") {
    const rows = [["Date", "Time", "Query"]];
    for (const e of entries) {
      const d = new Date(e.timestamp);
      rows.push([d.toLocaleDateString(), d.toLocaleTimeString(), `"${e.query.replace(/"/g, '""')}"`]);
    }
    content = rows.map((r) => r.join(",")).join("\n");
    mime = "text/csv";
    ext = "csv";
  } else {
    content = JSON.stringify(entries, null, 2);
  }
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `quair-search-history.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function tryInstantAnswer(query) {
  // Disabled permanently as per user request
  elements.instantAnswer.hidden = true;
  return false;
}

function tryCalculator(expr) {
  const cleaned = expr.replace(/[^0-9+\-*/.()^%\s]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;
  try {
    const safe = cleaned.replace(/\^/g, "**");
    const result = Function(`"use strict"; return (${safe})`)();
    if (typeof result === "number" && Number.isFinite(result)) {
      return result % 1 === 0 ? result.toLocaleString() : Number.parseFloat(result.toPrecision(12)).toLocaleString();
    }
  } catch { /* not a math expression */ }
  return null;
}

function tryUnitConvert(query) {
  const patterns = [
    { re: /([\d.]+)\s*(km|kilometers?)\s+(?:in|to)\s+(mi|miles?)/i, fn: (v) => `${(v * 0.621371).toFixed(4)} miles` },
    { re: /([\d.]+)\s*(mi|miles?)\s+(?:in|to)\s+(km|kilometers?)/i, fn: (v) => `${(v * 1.60934).toFixed(4)} km` },
    { re: /([\d.]+)\s*(kg|kilograms?)\s+(?:in|to)\s+(lbs?|pounds?)/i, fn: (v) => `${(v * 2.20462).toFixed(4)} lbs` },
    { re: /([\d.]+)\s*(lbs?|pounds?)\s+(?:in|to)\s+(kg|kilograms?)/i, fn: (v) => `${(v * 0.453592).toFixed(4)} kg` },
    { re: /([\d.]+)\s*°?[cf]\s+(?:in|to)\s+°?([cf])/i, fn: (v, m) => {
      const from = m[0].toLowerCase().includes("c") ? "c" : "f";
      const to = m[m.length - 1].toLowerCase();
      if (from === "c" && to === "f") return `${((v * 9 / 5) + 32).toFixed(2)} °F`;
      if (from === "f" && to === "c") return `${((v - 32) * 5 / 9).toFixed(2)} °C`;
      return null;
    }},
    { re: /([\d.]+)\s*(cm|centimeters?)\s+(?:in|to)\s+(in|inches?)/i, fn: (v) => `${(v * 0.393701).toFixed(4)} inches` },
    { re: /([\d.]+)\s*(in|inches?)\s+(?:in|to)\s+(cm|centimeters?)/i, fn: (v) => `${(v * 2.54).toFixed(4)} cm` },
    { re: /([\d.]+)\s*(m|meters?)\s+(?:in|to)\s+(ft|feet|foot)/i, fn: (v) => `${(v * 3.28084).toFixed(4)} feet` },
    { re: /([\d.]+)\s*(ft|feet|foot)\s+(?:in|to)\s+(m|meters?)/i, fn: (v) => `${(v * 0.3048).toFixed(4)} meters` },
    { re: /([\d.]+)\s*(l|liters?|litres?)\s+(?:in|to)\s+(gal|gallons?)/i, fn: (v) => `${(v * 0.264172).toFixed(4)} gallons` },
    { re: /([\d.]+)\s*(gal|gallons?)\s+(?:in|to)\s+(l|liters?|litres?)/i, fn: (v) => `${(v * 3.78541).toFixed(4)} liters` },
  ];
  for (const p of patterns) {
    const match = query.match(p.re);
    if (match) {
      const value = Number.parseFloat(match[1]);
      if (!Number.isFinite(value)) continue;
      const result = p.fn(value, match);
      if (result) return result;
    }
  }
  return null;
}

function setUtilitiesOpen(isOpen) {
  if (!elements.utilitiesPanel || !elements.utilitiesToggle) {
    return;
  }
  elements.utilitiesPanel.hidden = false;
  elements.utilitiesPanel.classList.toggle("is-open", isOpen);
  elements.utilitiesToggle.setAttribute("aria-expanded", String(isOpen));
  if (!isOpen) {
    window.setTimeout(() => {
      if (!elements.utilitiesPanel.classList.contains("is-open")) {
        elements.utilitiesPanel.hidden = true;
      }
    }, 260);
  }
}

function openUtilitiesModal() {
  const modal = document.getElementById("utilitiesModal");
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  initUtilityDropdowns();
  // Utilities panel is always visible inside the modal.
  if (elements.utilitiesPanel) {
    elements.utilitiesPanel.hidden = false;
    elements.utilitiesPanel.classList.add("utilities-panel-modal");
  }
  if (elements.utilitiesToggle) {
    elements.utilitiesToggle.setAttribute("aria-expanded", "true");
  }
}

function closeUtilitiesModal() {
  const modal = document.getElementById("utilitiesModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (elements.utilitiesToggle) {
    elements.utilitiesToggle.setAttribute("aria-expanded", "false");
  }
}

function setUtilityTimeMode(mode) {
  const nextMode = mode === "analog" ? "analog" : "digital";
  if (elements.utilityTimeDigitalWrap) {
    elements.utilityTimeDigitalWrap.hidden = nextMode !== "digital";
  }
  if (elements.utilityTimeAnalogWrap) {
    elements.utilityTimeAnalogWrap.hidden = nextMode !== "analog";
  }
  elements.utilityTimeModeDigitalBtn?.classList.toggle("is-active", nextMode === "digital");
  elements.utilityTimeModeAnalogBtn?.classList.toggle("is-active", nextMode === "analog");
}

function normalizeCalcExpression(raw) {
  const cleaned = String(raw || "")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−]/g, "-")
    .replace(/[^0-9+\-*/().%.\s]/g, "");
  return cleaned.trim();
}

function renderCalc(expr) {
  const normalized = normalizeCalcExpression(expr);
  if (elements.utilityCalcExpr) {
    elements.utilityCalcExpr.textContent = normalized || "0";
  }
  const result = tryCalculator(normalized);
  if (elements.utilityCalcResult) {
    elements.utilityCalcResult.textContent = result ? result : "0";
  }
}

function convertDistanceValue(value, fromUnit, toUnit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "";
  if (fromUnit === toUnit) return String(v);
  if (fromUnit === "km" && toUnit === "mi") return String((v * 0.621371).toFixed(4));
  if (fromUnit === "mi" && toUnit === "km") return String((v * 1.60934).toFixed(4));
  return "";
}

function convertUnitValue(value, fromUnit, toUnit, mode) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "";
  if (fromUnit === toUnit) return String(v);

  if (mode === "weight") {
    if (fromUnit === "kg" && toUnit === "lb") return String((v * 2.2046226218).toFixed(4));
    if (fromUnit === "lb" && toUnit === "kg") return String((v / 2.2046226218).toFixed(4));
    return "";
  }

  if (mode === "area") {
    if (fromUnit === "sqm" && toUnit === "sqft") return String((v * 10.7639104167).toFixed(4));
    if (fromUnit === "sqft" && toUnit === "sqm") return String((v / 10.7639104167).toFixed(4));
    return "";
  }

  // distance (default)
  return convertDistanceValue(v, fromUnit, toUnit);
}

function setConvertResultButtonText(text) {
  const btn = document.getElementById("utilityConvertResultBtn");
  if (btn) btn.textContent = text;
}

function getUtilityUnitMode() {
  const stored = localStorage.getItem("utility_unit_mode");
  if (stored === "weight" || stored === "area" || stored === "distance") return stored;
  return "distance";
}

function setUtilityUnitMode(mode) {
  const next = mode === "weight" || mode === "area" ? mode : "distance";
  localStorage.setItem("utility_unit_mode", next);
  return next;
}

function applyUtilityUnitModeUi(mode) {
  const titleEl = document.querySelector(".utility-card-convert .utility-card-title");
  if (titleEl) {
    titleEl.textContent = mode === "weight" ? "Weight" : mode === "area" ? "Area" : "Distance & Length";
  }

  const buttons = [
    document.getElementById("utilityConvertModeWeight"),
    document.getElementById("utilityConvertModeDistance"),
    document.getElementById("utilityConvertModeArea"),
  ];
  for (const btn of buttons) {
    if (!btn) continue;
    btn.classList.toggle("is-active", btn.dataset.unitMode === mode);
  }

  const fromUnit = elements.utilityDistanceFromUnit;
  const toUnit = elements.utilityDistanceToUnit;
  if (!fromUnit || !toUnit) return;

  const setOptions = (selectEl, options, preferred) => {
    selectEl.innerHTML = options.map((o) => `<option value="${escapeAttribute(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    if (preferred && options.some((o) => o.value === preferred)) {
      selectEl.value = preferred;
    }
  };

  let fromOpts;
  let toOpts;
  let fromPref;
  let toPref;

  if (mode === "weight") {
    fromOpts = [{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }];
    fromPref = "kg";
    toOpts   = [{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }];
    toPref   = "lb";
  } else if (mode === "area") {
    fromOpts = [{ value: "sqm", label: "sqm" }, { value: "sqft", label: "sqft" }];
    fromPref = "sqm";
    toOpts   = [{ value: "sqft", label: "sqft" }, { value: "sqm", label: "sqm" }];
    toPref   = "sqft";
  } else {
    fromOpts = [{ value: "km", label: "km" }, { value: "mi", label: "miles" }];
    fromPref = "km";
    toOpts   = [{ value: "mi", label: "miles" }, { value: "km", label: "km" }];
    toPref   = "mi";
  }

  setOptions(fromUnit, fromOpts, fromPref);
  setOptions(toUnit, toOpts, toPref);

  refreshUtilityUnitDropdown("unit-from", fromOpts, fromPref);
  refreshUtilityUnitDropdown("unit-to", toOpts, toPref);
}

const CURRENCY_CODES = [
  "AED","AUD","BRL","CAD","CHF","CNY","DKK","EUR","GBP","HKD",
  "IDR","INR","JPY","KRW","MXN","MYR","NOK","NZD","PHP","PLN",
  "RUB","SAR","SEK","SGD","THB","TRY","TWD","USD","ZAR","PKR"
];

function buildUtilityDropdownOptions(dropdown, options) {
  const menu = dropdown.querySelector(".custom-dropdown-menu");
  if (!menu) return;
  menu.innerHTML = "";
  for (const opt of options) {
    const li = document.createElement("li");
    li.className = "custom-dropdown-option";
    li.setAttribute("role", "option");
    li.dataset.value = opt.value;
    li.innerHTML = `<span class="custom-dropdown-option-text">${escapeHtml(opt.label)}</span>`;
    li.addEventListener("click", () => {
      selectUtilityDropdownOption(dropdown, opt.value, opt.label);
    });
    menu.appendChild(li);
  }
}

function selectUtilityDropdownOption(dropdown, value, label) {
  const trigger = dropdown.querySelector(".custom-dropdown-trigger");
  const valueEl = trigger?.querySelector(".custom-dropdown-value");
  const menu = dropdown.querySelector(".custom-dropdown-menu");

  if (valueEl) valueEl.textContent = label;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  if (menu) {
    menu.hidden = true;
    for (const opt of menu.querySelectorAll(".custom-dropdown-option")) {
      opt.classList.toggle("is-selected", opt.dataset.value === value);
    }
  }

  const type = dropdown.dataset.dropdown;
  if (type === "currency-from" && elements.utilityCurrencyFrom) {
    elements.utilityCurrencyFrom.value = value;
    void updateCurrencyRatePreview();
  } else if (type === "currency-to" && elements.utilityCurrencyTo) {
    elements.utilityCurrencyTo.value = value;
    void updateCurrencyRatePreview();
  } else if (type === "unit-from" && elements.utilityDistanceFromUnit) {
    elements.utilityDistanceFromUnit.value = value;
    syncDistanceConversion("from");
  } else if (type === "unit-to" && elements.utilityDistanceToUnit) {
    elements.utilityDistanceToUnit.value = value;
    syncDistanceConversion("from");
  }
}

function refreshUtilityUnitDropdown(dropdownType, options, preferred) {
  const id = dropdownType === "unit-from" ? "utilityUnitFromDropdown" : "utilityUnitToDropdown";
  const dropdown = document.getElementById(id);
  if (!dropdown) return;
  buildUtilityDropdownOptions(dropdown, options);
  const sel = preferred || options[0]?.value;
  const label = options.find((o) => o.value === sel)?.label || sel;
  const valueEl = dropdown.querySelector(".custom-dropdown-value");
  if (valueEl) valueEl.textContent = label;
  const menuOpts = dropdown.querySelectorAll(".custom-dropdown-option");
  for (const opt of menuOpts) opt.classList.toggle("is-selected", opt.dataset.value === sel);
}

function populateUtilityCurrencySelect(selectEl, selectedValue) {
  if (!selectEl) return;
  selectEl.innerHTML = CURRENCY_CODES.map((code) => {
    return `<option value="${escapeAttribute(code)}">${escapeHtml(code)}</option>`;
  }).join("");
  if (selectedValue && CURRENCY_CODES.includes(selectedValue)) {
    selectEl.value = selectedValue;
  }
}

function initUtilityDropdowns() {
  initCustomDropdownListeners();

  const currencyOpts = CURRENCY_CODES.map((c) => ({ value: c, label: c }));

  populateUtilityCurrencySelect(elements.utilityCurrencyFrom, elements.utilityCurrencyFrom?.value || "USD");
  populateUtilityCurrencySelect(elements.utilityCurrencyTo, elements.utilityCurrencyTo?.value || "INR");

  const setupDrop = (id, opts, initVal) => {
    const dropdown = document.getElementById(id);
    if (!dropdown || dropdown.dataset.initialized === "true") return;
    buildUtilityDropdownOptions(dropdown, opts);
    if (initVal) {
      const label = opts.find((o) => o.value === initVal)?.label || initVal;
      const valueEl = dropdown.querySelector(".custom-dropdown-value");
      if (valueEl) valueEl.textContent = label;
      for (const opt of dropdown.querySelectorAll(".custom-dropdown-option")) {
        opt.classList.toggle("is-selected", opt.dataset.value === initVal);
      }
    }
    const trigger = dropdown.querySelector(".custom-dropdown-trigger");
    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        toggleCustomDropdown(dropdown);
      });
    }
    dropdown.dataset.initialized = "true";
  };

  setupDrop("utilityCurrencyFromDropdown", currencyOpts, "USD");
  setupDrop("utilityCurrencyToDropdown", currencyOpts, "INR");

  const unitMode = getUtilityUnitMode();
  const unitOpts = unitMode === "weight"
    ? [{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]
    : unitMode === "area"
    ? [{ value: "sqm", label: "sqm" }, { value: "sqft", label: "sqft" }]
    : [{ value: "km", label: "km" }, { value: "mi", label: "miles" }];
  setupDrop("utilityUnitFromDropdown", unitOpts, unitOpts[0]?.value);
  const unitToOpts = [...unitOpts].reverse();
  setupDrop("utilityUnitToDropdown", unitToOpts, unitToOpts[0]?.value);
}

function syncDistanceConversion(changedSide = "from") {
  const fromValue = elements.utilityDistanceFrom?.value ?? "";
  const toValue = elements.utilityDistanceTo?.value ?? "";
  const fromUnit = elements.utilityDistanceFromUnit?.value ?? "km";
  const toUnit = elements.utilityDistanceToUnit?.value ?? "mi";
  const mode = getUtilityUnitMode();

  if (changedSide === "from") {
    const next = convertUnitValue(fromValue, fromUnit, toUnit, mode);
    if (elements.utilityDistanceTo && next !== "") {
      elements.utilityDistanceTo.value = next;
    }
    setConvertResultButtonText(next ? `${next} ${toUnit}` : "Result will appear here.");
    return;
  }

  const next = convertUnitValue(toValue, toUnit, fromUnit, mode);
  if (elements.utilityDistanceFrom && next !== "") {
    elements.utilityDistanceFrom.value = next;
  }
  setConvertResultButtonText(next ? `${elements.utilityDistanceFrom.value} ${fromUnit}` : "Result will appear here.");
}

const UTILITY_TIMEZONE_OPTIONS = [
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "London", value: "Europe/London" },
  { label: "Barcelona", value: "Europe/Madrid" },
  { label: "New York", value: "America/New_York" },
  { label: "Dubai", value: "Asia/Dubai" },
  { label: "Los Angeles", value: "America/Los_Angeles" },
  { label: "Singapore", value: "Asia/Singapore" },
  { label: "Sydney", value: "Australia/Sydney" },
  { label: "Paris", value: "Europe/Paris" },
  { label: "Berlin", value: "Europe/Berlin" },
  { label: "Toronto", value: "America/Toronto" },
  { label: "Chicago", value: "America/Chicago" },
];

function populateUtilityTimezoneSelect(selectEl, defaultValue) {
  if (!selectEl) return;
  if (!selectEl.options.length) {
    const optionsMarkup = UTILITY_TIMEZONE_OPTIONS.map(({ label, value }) => {
      return `<option value="${escapeAttribute(value)}">${escapeHtml(label)}</option>`;
    }).join("");
    selectEl.innerHTML = optionsMarkup;
  }
  if (defaultValue && Array.from(selectEl.options).some((opt) => opt.value === defaultValue)) {
    selectEl.value = defaultValue;
  }
}

function getUtilityTzPrefs() {
  try {
    const raw = localStorage.getItem("utility_timezones");
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function setUtilityTzPrefs(prefs) {
  try {
    localStorage.setItem("utility_timezones", JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function ensureUtilityTimezoneDefaults() {
  const prefs = getUtilityTzPrefs() || {};
  const next = {
    tz1: typeof prefs.tz1 === "string" ? prefs.tz1 : "Asia/Tokyo",
    tz2: typeof prefs.tz2 === "string" ? prefs.tz2 : "Europe/London",
    tz3: typeof prefs.tz3 === "string" ? prefs.tz3 : "America/New_York",
  };
  setUtilityTzPrefs(next);
  return next;
}

function getClockTimeParts(timeZone, date) {
  const now = date || new Date();
  if (!timeZone) {
    const ms = now.getMilliseconds();
    const second = now.getSeconds() + ms / 1000;
    const minute = now.getMinutes() + second / 60;
    const hour = (now.getHours() % 12) + minute / 60;
    return { second, minute, hour };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => Number.parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
  const secondInt = get("second");
  const minuteInt = get("minute");
  const hourInt = get("hour") % 12;
  const second = secondInt;
  const minute = minuteInt + second / 60;
  const hour = hourInt + minute / 60;
  return { second, minute, hour };
}

function updateUtilityTime() {
  if (!elements.utilityTimeOutput || !elements.utilityTimeMeta) {
    return;
  }
  const now = new Date();

  const formatTimeHtml = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);
    const hh = parts.find((p) => p.type === "hour")?.value || "00";
    const mm = parts.find((p) => p.type === "minute")?.value || "00";
    const dp = (parts.find((p) => p.type === "dayPeriod")?.value || "").toUpperCase();
    const safeDp = dp === "AM" || dp === "PM" ? dp : "";
    return `${escapeHtml(hh)}:${escapeHtml(mm)}${safeDp ? ` <span class="utility-time-ampm">${escapeHtml(safeDp)}</span>` : ""}`;
  };

  elements.utilityTimeOutput.innerHTML = formatTimeHtml(now);
  elements.utilityTimeMeta.textContent = now.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const prefs = ensureUtilityTimezoneDefaults();
  const customZones = [prefs.tz1, prefs.tz2, prefs.tz3];
  const outEls = [elements.utilityTimeTzOutput1, elements.utilityTimeTzOutput2, elements.utilityTimeTzOutput3];
  const metaEls = [elements.utilityTimeTzMeta1, elements.utilityTimeTzMeta2, elements.utilityTimeTzMeta3];

  for (let i = 0; i < 3; i += 1) {
    const tz = customZones[i];
    const outEl = outEls[i];
    const metaEl = metaEls[i];
    if (!outEl || !metaEl) continue;
    outEl.innerHTML = formatTimeHtml(now, tz);
    metaEl.textContent = now.toLocaleDateString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  }

  if (
    elements.utilityAnalogHourHand
    && elements.utilityAnalogMinuteHand
    && elements.utilityAnalogSecondHand
  ) {
    // Legacy single analog clock (kept for backward compatibility; no-op if removed from DOM)
    const { second, minute, hour } = getClockTimeParts(null, now);
    elements.utilityAnalogSecondHand.style.setProperty("--rot", `${second * 6}deg`);
    elements.utilityAnalogMinuteHand.style.setProperty("--rot", `${minute * 6}deg`);
    elements.utilityAnalogHourHand.style.setProperty("--rot", `${hour * 30}deg`);
  }

  // New analog grid clocks
  for (const clock of document.querySelectorAll(".utility-analog-clock[data-analog-slot]")) {
    const slot = clock.getAttribute("data-analog-slot");
    let tz = null;
    if (slot === "1") tz = prefs.tz1;
    if (slot === "2") tz = prefs.tz2;
    if (slot === "3") tz = prefs.tz3;

    const { second, minute, hour } = getClockTimeParts(tz, now);
    const secondHand = clock.querySelector("[data-analog-hand='second']");
    const minuteHand = clock.querySelector("[data-analog-hand='minute']");
    const hourHand = clock.querySelector("[data-analog-hand='hour']");
    if (secondHand) secondHand.style.setProperty("--rot", `${second * 6}deg`);
    if (minuteHand) minuteHand.style.setProperty("--rot", `${minute * 6}deg`);
    if (hourHand) hourHand.style.setProperty("--rot", `${hour * 30}deg`);
  }
}

async function fetchFxRate(from, to) {
  if (from === to) return { rate: 1, source: "same currency", updatedAt: null };

  const live = await fetchLiveFxRate(from, to);
  if (live && Number.isFinite(live.rate) && live.rate > 0) {
    return { rate: live.rate, source: live.source || "live rate", updatedAt: live.updatedAt || null };
  }

  const fallbackRate = getFallbackFxRate(from, to);
  if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
    return { rate: fallbackRate, source: "offline estimate", updatedAt: null };
  }

  throw new Error("FX rate not available.");
}

async function fetchLiveFxRate(from, to) {
  const endpoints = [
    {
      name: "exchangerate.host",
      url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
      parse: (payload) => ({ rate: payload?.rates?.[to], updatedAt: payload?.date ? new Date(payload.date) : null }),
    },
    {
      name: "frankfurter",
      url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      parse: (payload) => ({ rate: payload?.rates?.[to], updatedAt: payload?.date ? new Date(payload.date) : null }),
    },
    {
      name: "open.er-api.com",
      url: `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
      parse: (payload) => ({
        rate: payload?.rates?.[to],
        updatedAt: Number.isFinite(payload?.time_last_update_unix)
          ? new Date(payload.time_last_update_unix * 1000)
          : null,
      }),
    },
  ];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint.url, { cache: "no-store" });
      if (!resp.ok) {
        continue;
      }

      const payload = await resp.json();
      const parsed = endpoint.parse(payload);
      const rate = parsed?.rate;
      if (Number.isFinite(rate)) {
        return { rate, updatedAt: parsed?.updatedAt ?? null, source: endpoint.name };
      }
    } catch {
      // Try the next endpoint before falling back to local estimates.
    }
  }

  return null;
}

function getFallbackFxRate(from, to) {
  const fromRate = FALLBACK_FX_USD_RATES[from];
  const toRate = FALLBACK_FX_USD_RATES[to];

  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0) {
    return Number.NaN;
  }

  return toRate / fromRate;
}

function setCurrencyUi(resultText, metaText) {
  if (elements.utilityCurrencyOutput) elements.utilityCurrencyOutput.textContent = resultText;
  if (elements.utilityCurrencyMeta) elements.utilityCurrencyMeta.textContent = metaText || "";
}

async function updateCurrencyRatePreview() {
  if (!elements.utilityCurrencyFrom || !elements.utilityCurrencyTo) return;
  if (!elements.utilityCurrencyMeta) return;

  const from = elements.utilityCurrencyFrom.value;
  const to = elements.utilityCurrencyTo.value;
  if (!from || !to) {
    elements.utilityCurrencyMeta.textContent = "";
    return;
  }

  try {
    const { rate, source, updatedAt } = await fetchFxRate(from, to);
    if (!Number.isFinite(rate) || rate <= 0) {
      elements.utilityCurrencyMeta.textContent = "";
      return;
    }
    const updatedLabel = updatedAt
      ? ` • Updated ${updatedAt.toLocaleString()}`
      : "";
    elements.utilityCurrencyMeta.textContent = `1 ${from} = ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(rate)} ${to} (${source})${updatedLabel}`;
  } catch {
    elements.utilityCurrencyMeta.textContent = "Rate unavailable (offline).";
  }
}

function resetCurrencyManualRateMessage() {
  const output = elements.utilityCurrencyOutput;
  if (!output) {
    return;
  }

  const normalizedText = output.textContent.toLowerCase();
  if (normalizedText.includes("manual") && normalizedText.includes("rate")) {
    setCurrencyUi("Enter an amount to convert.", "");
  }
}

function removeHistoryEntry(entryId) {
  const entries = readHistoryEntries().filter((e) => e.id !== entryId);
  writeHistoryEntries(entries);
}

function clearAllHistory() {
  writeHistoryEntries([]);
}

function generateEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveHistory(query) {
  if (!isHistorySavingEnabled()) return;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  const entries = readHistoryEntries();
  entries.unshift({ id: generateEntryId(), query: trimmedQuery, timestamp: Date.now() });
  writeHistoryEntries(entries);
}

function setSearchStatus(message) {
  const text = (message || "").trim();

  elements.statusPill.textContent = text;
  elements.statusPill.classList.toggle("is-visible", Boolean(text));
  elements.resultsHead.style.display = text || !elements.analyticsBoard?.hidden ? "flex" : "none";
}

function setSearchingStatus(message) {
  const text = (message || "").trim();

  if (elements.searchingStatus) {
    elements.searchingStatus.setAttribute("aria-label", text);
    const textNode = elements.searchingStatus.querySelector(".searching-status-text");
    if (textNode) {
      textNode.textContent = text;
    }
    elements.searchingStatus.classList.toggle("is-visible", Boolean(text));
  }
}

function setSearchLoading(isLoading, message) {
  elements.searchShell.classList.toggle("is-loading", isLoading);
  elements.searchButton.disabled = isLoading;
  elements.queryInput.disabled = false;
  setTabLoadingState(isLoading, state.lastSubmittedQuery || elements.queryInput.value);

  if (elements.clearButton) {
    const hasText = Boolean(elements.queryInput.value.trim());
    elements.clearButton.classList.toggle("is-visible", hasText && !isLoading);
  }

  if (isLoading) {
    setSearchingStatus("Loading");
    setSearchStatus("");
  } else {
    setSearchingStatus("");
    setSearchStatus(message || "");
  }
}

function getEffectiveQuery() {
  return elements.queryInput.value.trim() || state.lastSubmittedQuery.trim();
}

function setActiveSearchTab(tabName) {
  for (const button of elements.searchTabs) {
    button.classList.toggle(
      "is-active",
      button.getAttribute("data-search-tab") === tabName,
    );
  }
}

function openSearchVertical(tabName) {
  const query = getEffectiveQuery();
  const settings = getStoredSettings();
  const safeSearchMode = settings.safeSearch === "off" ? "off" : "active";

  if (tabName === "maps") {
    const mapsUrl = new URL(`https://www.google.com/maps/search/${encodeURIComponent(query || "maps")}`);
    mapsUrl.searchParams.set("hl", settings.displayLanguage);
    mapsUrl.searchParams.set("gl", settings.region);
    window.open(mapsUrl.toString(), "_blank", "noopener,noreferrer");
    return;
  }

  if (tabName === "mail") {
    const mailUrl = query
      ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`
      : "https://mail.google.com/mail/u/0/#inbox";
    window.open(mailUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (tabName === "stocks") {
    const financeUrl = new URL("https://www.google.com/finance");
    if (query) {
      financeUrl.searchParams.set("q", query);
    }
    financeUrl.searchParams.set("hl", settings.displayLanguage);
    financeUrl.searchParams.set("gl", settings.region);
    window.open(financeUrl.toString(), "_blank", "noopener,noreferrer");
    return;
  }

  const url = new URL("https://www.google.com/search");

  if (query) {
    url.searchParams.set("q", query);
  }

  url.searchParams.set("hl", settings.displayLanguage);
  url.searchParams.set("gl", settings.region);
  url.searchParams.set("safe", safeSearchMode);

  if (tabName === "images") {
    url.searchParams.set("tbm", "isch");
  } else if (tabName === "videos") {
    url.searchParams.set("tbm", "vid");
  } else if (tabName === "news") {
    url.searchParams.set("tbm", "nws");
  } else if (tabName === "shopping") {
    url.searchParams.set("tbm", "shop");
  }

  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

function openImagePreview(src) {
  if (!elements.imagePreviewModal || !elements.imagePreviewImage) {
    return;
  }

  elements.imagePreviewImage.src = src;
  elements.imagePreviewModal.classList.add("is-open");
  elements.imagePreviewModal.setAttribute("aria-hidden", "false");
}

function closeImagePreview() {
  if (!elements.imagePreviewModal || !elements.imagePreviewImage) {
    return;
  }

  elements.imagePreviewModal.classList.remove("is-open");
  elements.imagePreviewModal.setAttribute("aria-hidden", "true");
  elements.imagePreviewImage.src = "";
}

function setVoiceUiState(mode) {
  const isRecording = mode === "recording";

  elements.searchShell.classList.toggle("is-recording", isRecording);
  elements.voiceButton.classList.toggle("is-recording", isRecording);
  elements.voiceFeedback.classList.remove("is-visible");
  elements.voiceStopButton.classList.remove("is-visible");
  elements.voiceButton.style.opacity = "1";
  elements.queryInput.placeholder =
    mode === "recording" ? "Listening..." : defaultSearchPlaceholder;
  elements.queryInput.classList.toggle("is-listening", isRecording);
}

function clearVoiceDraft() {
  state.voiceDraft = "";
  setVoiceUiState("idle");

}

function clearAnswerTyping() {
  if (state.answerTypingTimer) {
    clearTimeout(state.answerTypingTimer);
    state.answerTypingTimer = null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripMarkdown(text) {
  return (text || "")
    .replace(/^#{1,6}\s*/gm, "")        // heading hashes
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")  // bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, "")  // inline code
    .replace(/^\s*[\-\*>]\s+/gm, "")   // list bullets / blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[.*?\]\(.*?\)/g, "")    // images
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1") // underscores
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitIntoSentences(text) {
  return stripMarkdown(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Social platform registry ───────────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { key: "youtube.com",     name: "YouTube",     color: "#FF0000" },
  { key: "instagram.com",   name: "Instagram",   color: "#E1306C" },
  { key: "twitter.com",     name: "Twitter",     color: "#1DA1F2" },
  { key: "x.com",           name: "X",           color: "#000000" },
  { key: "facebook.com",    name: "Facebook",    color: "#1877F2" },
  { key: "linkedin.com",    name: "LinkedIn",    color: "#0A66C2" },
  { key: "tiktok.com",      name: "TikTok",      color: "#010101" },
  { key: "reddit.com",      name: "Reddit",      color: "#FF4500" },
  { key: "pinterest.com",   name: "Pinterest",   color: "#E60023" },
  { key: "snapchat.com",    name: "Snapchat",    color: "#FFFC00" },
  { key: "telegram.org",    name: "Telegram",    color: "#2AABEE" },
  { key: "t.me",            name: "Telegram",    color: "#2AABEE" },
  { key: "whatsapp.com",    name: "WhatsApp",    color: "#25D366" },
  { key: "twitch.tv",       name: "Twitch",      color: "#9146FF" },
  { key: "github.com",      name: "GitHub",      color: "#181717" },
  { key: "quora.com",       name: "Quora",       color: "#B92B27" },
  { key: "medium.com",      name: "Medium",      color: "#000000" },
  { key: "tumblr.com",      name: "Tumblr",      color: "#35465C" },
  { key: "discord.com",     name: "Discord",     color: "#5865F2" },
  { key: "spotify.com",     name: "Spotify",     color: "#1DB954" },
  { key: "soundcloud.com",  name: "SoundCloud",  color: "#FF5500" },
  { key: "imdb.com",        name: "IMDb",        color: "#F5C518" },
];

function detectSocialProfiles(sources, query = "") {
  const seen = new Set();
  const profiles = [];
  for (const source of (sources || [])) {
    let host = "";
    try { host = new URL(source.url).hostname.replace(/^www\./, ""); } catch { continue; }
    const platform = SOCIAL_PLATFORMS.find((p) => host === p.key || host.endsWith(`.${p.key}`));
    if (platform && !seen.has(platform.name)) {
      seen.add(platform.name);
      profiles.push({ ...platform, url: source.url, host });
    }
  }

  // Force generic fallback profiles if they weren't found in search results
  if (query) {
    const fallbacks = [
      { key: "linkedin.com", name: "LinkedIn", searchUrl: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}` },
      { key: "twitter.com", name: "X", searchUrl: `https://twitter.com/search?q=${encodeURIComponent(query)}` },
      { key: "youtube.com", name: "YouTube", searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` },
      { key: "facebook.com", name: "Facebook", searchUrl: `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}` },
      { key: "instagram.com", name: "Instagram", searchUrl: `https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/\s+/g, ""))}/` }
    ];
    for (const fb of fallbacks) {
      if (!seen.has(fb.name)) {
        seen.add(fb.name);
        profiles.push({ ...fb, url: fb.searchUrl, host: fb.key });
      }
    }
  }

  return profiles;
}

function getStoryHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const diffMs = Date.now() - d.getTime();
    const hrs = Math.floor(diffMs / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return dateStr; }
}

// Google-News-style card: full-cover image + source + title + time
function buildNewsCard(source) {
  const host = getStoryHost(source.url);
  const favicon = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
  const timeStr = formatRelativeDate(source.published_date);

  // Image priority: 1) native image from search result, 2) Microlink og:image
  const displayImage = source.image
    ? escapeHtml(source.image)
    : `https://api.microlink.io?url=${encodeURIComponent(source.url)}&embed=image.url`;

  // On image error: try favicon as cover, then a solid branded fallback tile
  const imgBlock = `
    <div class="tsn-img-wrap">
      <img class="tsn-img" src="${displayImage}" alt=""
        loading="eager"
        onerror="
          if(!this.dataset.triedFavicon){
            this.dataset.triedFavicon=1;
            this.src='${favicon}';
          } else {
            this.style.display='none';
            this.parentNode.querySelector('.tsn-fallback-tile').style.display='flex';
          }
        " />
      <div class="tsn-fallback-tile" style="display:none;background:linear-gradient(135deg,#1e3a5f,#4870ff);color:#fff;font-size:1.3rem;font-weight:700;align-items:center;justify-content:center;width:100%;height:100%;">
        <img src="${favicon}" style="width:40px;height:40px;border-radius:8px;" onerror="this.style.display='none'" />
      </div>
    </div>`;

  return `
    <a class="tsn-card" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer noopener">
      ${imgBlock}
      <div class="tsn-body">
        <div class="ts-source-row">
          <img class="ts-favicon" src="${favicon}" alt="" onerror="this.style.display='none'" />
          <span class="ts-source-name">${escapeHtml(host)}</span>
        </div>
        <p class="tsn-title">${escapeHtml(source.title || 'Untitled')}</p>
        ${timeStr ? `<span class="ts-time">${escapeHtml(timeStr)}</span>` : ''}
      </div>
    </a>`;
}

function formatOverviewHtml(query, message, sources) {
  const cleanedMessage = stripMarkdown((message || "").trim());

  // ── About: truncate to exactly 4-5 lines (sentences) ─────────────────────
  const sentences = splitIntoSentences(cleanedMessage);
  const summaryText = sentences.slice(0, 5).join(" ") || cleanedMessage;

  // ── Source helpers ────────────────────────────────────────────────────────
  const validSources = (sources || []).filter((s) => s.url);
  const socialDomains = ["facebook.com","instagram.com","twitter.com","x.com",
    "youtube.com","linkedin.com","tiktok.com","reddit.com","pinterest.com",
    "snapchat.com","telegram.org","whatsapp.com"];
  const isSocial = (url) => { try { const h = new URL(url).hostname.replace(/^www\./,""); return socialDomains.some((d) => h === d || h.endsWith(`.${d}`)); } catch { return false; } };
  const isWiki   = (url) => /wikipedia\.org/i.test(url);

  // ── Region-aware news domain priority ─────────────────────────────────────
  const userRegion = (localStorage.getItem("quair_region") || "GLOBAL").toUpperCase();
  const REGIONAL_NEWS = {
    IN:  ["ndtv.com","timesofindia.indiatimes.com","thehindu.com","indiatoday.in","hindustantimes.com","news18.com","indianexpress.com","scroll.in","thewire.in","livemint.com"],
    US:  ["cnn.com","foxnews.com","nbcnews.com","nytimes.com","washingtonpost.com","usatoday.com","abcnews.go.com","msnbc.com","cbsnews.com","npr.org"],
    GB:  ["bbc.com","bbc.co.uk","theguardian.com","skynews.com","telegraph.co.uk","independent.co.uk","metro.co.uk","thetimes.co.uk"],
    GLOBAL: ["bbc.com","reuters.com","aljazeera.com","bloomberg.com","apnews.com","france24.com","dw.com","cnn.com","theguardian.com","ndtv.com"]
  };
  const priorityDomains = REGIONAL_NEWS[userRegion] || REGIONAL_NEWS.GLOBAL;
  const globalNewsDomains = ["bbc.com","bbc.co.uk","cnn.com","nytimes.com","reuters.com","bloomberg.com","forbes.com",
    "theguardian.com","wsj.com","cnbc.com","ndtv.com","indiatoday.in","timesofindia","thehindu",
    "aljazeera","foxnews.com","news.yahoo.com","businessinsider.com","washingtonpost.com",
    "npr.org","usatoday.com","news18.com","hindustantimes.com","cbsnews.com","nbcnews.com",
    "abcnews.go.com","msnbc.com","skynews.com","france24.com","dw.com","rt.com",
    "apnews.com","scroll.in","thewire.in","livemint.com","indianexpress.com"];

  const isNewsMedia = (url) => {
    try {
      const h = new URL(url).hostname.replace(/^www\./,"");
      return globalNewsDomains.some((d) => h === d || h.endsWith(`.${d}`))
        || h.includes("news") || h.includes("times") || h.includes("tv") || h.includes("post");
    } catch { return false; }
  };

  // ── Score each source for Top Stories ─────────────────────────────────────
  const scoreSource = (s) => {
    const h = (() => { try { return new URL(s.url).hostname.replace(/^www\./,""); } catch { return ""; } })();
    let score = 0;
    if (priorityDomains.some((d) => h === d || h.endsWith(`.${d}`))) score += 100; // Regional priority
    if (isNewsMedia(s.url)) score += 50;   // General news media
    if (s.image) score += 30;              // Has a real image
    if (s.published_date) score += 10;     // Has publish date (fresh)
    return score;
  };

  // ── Top Stories: GUARANTEED 4 cards, always ───────────────────────────────
  const wikiSource = validSources.find((s) => isWiki(s.url));
  const storyPool = validSources.filter((s) => !isWiki(s.url) && !isSocial(s.url));

  // Sort by score descending, take top 4 — ALWAYS produces 4 if any results exist
  const newsSources = storyPool
    .map(s => ({ source: s, score: scoreSource(s) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.source)
    .slice(0, 4);

  const topStoryUrls = newsSources.map(s => s.url);

  // Always show Top Stories (even if < 4 sources, show what we have)
  const storiesHtml = (() => {
    if (!newsSources.length) return "";
    const cards = newsSources.map(buildNewsCard).join("");
    return `
      <div class="tsn-grid">${cards}</div>
      <a class="ts-more-btn" href="https://news.google.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noreferrer noopener">
        More stories
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>`;
  })();

  // ── Social Profiles ───────────────────────────────────────────────────────
  const socialProfiles = detectSocialProfiles(validSources, query);
  const socialHtml = socialProfiles.length
    ? `<section class="overview-section">
        <h3 class="overview-heading">Profiles</h3>
        <div class="social-profiles-row">
          ${socialProfiles.map((p) => `
            <a class="sp-card" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer noopener" title="${escapeHtml(p.name)}">
              <div class="sp-circle">
                <img class="sp-icon" src="https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(p.key)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'" />
              </div>
              <span class="sp-name">${escapeHtml(p.name)}</span>
            </a>`).join("")}
        </div>
      </section>`
    : "";

  const wikiUrl = wikiSource ? wikiSource.url : `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;

  const html = `
    <section class="overview-section">
      <h3 class="overview-heading">About</h3>
      <p class="overview-text ai-summary-text">
        ${escapeHtml(summaryText)}
        <a class="wiki-source-link" href="${escapeHtml(wikiUrl)}" target="_blank" rel="noreferrer noopener">Wikipedia</a>
      </p>
    </section>
    ${storiesHtml ? `
    <section class="overview-section">
      <h3 class="overview-heading">Top Stories</h3>
      ${storiesHtml}
    </section>` : ""}
    ${socialHtml}
  `;
  return { html, topStoryUrls };
}



function renderOverview(query, message, sources = []) {
  clearAnswerTyping();
  state.answerTypingToken += 1;
  const result = formatOverviewHtml(query, message, sources);
  elements.answerText.innerHTML = result.html;
  return result.topStoryUrls;
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function stopLocationWatch() {
  if (state.locationWatchId !== null) {
    navigator.geolocation.clearWatch(state.locationWatchId);
    state.locationWatchId = null;
  }
}

function setLocationMeta(text = "", hidden = true) {
  if (!elements.locationMeta) {
    return;
  }
  elements.locationMeta.textContent = text;
  elements.locationMeta.hidden = hidden;
}

function setWeatherCardBusy(isBusy, message = "") {
  if (elements.weatherCard) {
    elements.weatherCard.classList.toggle("is-loading", Boolean(isBusy));
    elements.weatherCard.setAttribute("aria-busy", String(Boolean(isBusy)));
  }
  if (message) {
    setLocationMeta(message, false);
  }
}

function setWeatherLocationControlsOpen(isOpen) {
  if (!elements.weatherLocationControls || !elements.weatherLocationToggle) {
    return;
  }
  elements.weatherLocationControls.hidden = !isOpen;
  elements.weatherLocationToggle.setAttribute("aria-expanded", String(isOpen));
  elements.weatherLocationToggle.textContent = isOpen ? "Close" : "Change";
  if (isOpen && elements.weatherCityInput) {
    populateWeatherLocationForm(state.manualWeatherLocation);
    elements.weatherCityInput?.focus();
  }
}

function isInteractiveWeatherElement(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(
    "#weatherLocationControls, button, a, input, select, textarea, [role=\"button\"], [contenteditable=\"true\"]",
  ));
}

function populateWeatherLocationForm(location) {
  if (elements.weatherCityInput) {
    elements.weatherCityInput.value = location?.city || "";
  }
  if (elements.weatherStateInput) {
    elements.weatherStateInput.value = location?.state || "";
  }
  if (elements.weatherCountryInput) {
    elements.weatherCountryInput.value = location?.country || "";
  }
  if (elements.weatherPincodeInput) {
    elements.weatherPincodeInput.value = location?.pincode || "";
  }
}

function readWeatherLocationForm() {
  return {
    area: "",
    city: String(elements.weatherCityInput?.value || "").trim(),
    state: String(elements.weatherStateInput?.value || "").trim(),
    country: String(elements.weatherCountryInput?.value || "").trim(),
    pincode: String(elements.weatherPincodeInput?.value || "").trim(),
  };
}

function getDistanceMeters(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(toLatitude - fromLatitude);
  const lonDelta = toRadians(toLongitude - fromLongitude);
  const startLat = toRadians(fromLatitude);
  const endLat = toRadians(toLatitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Weather (Open-Meteo — no API key required) ───────────────────────────────

const WMO_CODES = {
  0:  { label: "Clear Sky",          emoji: "☀️" },
  1:  { label: "Mainly Clear",        emoji: "🌤️" },
  2:  { label: "Partly Cloudy",       emoji: "⛅" },
  3:  { label: "Overcast",            emoji: "☁️" },
  45: { label: "Fog",                 emoji: "🌫️" },
  48: { label: "Rime Fog",            emoji: "🌫️" },
  51: { label: "Light Drizzle",       emoji: "🌦️" },
  53: { label: "Moderate Drizzle",    emoji: "🌦️" },
  55: { label: "Dense Drizzle",       emoji: "🌧️" },
  61: { label: "Slight Rain",         emoji: "🌧️" },
  63: { label: "Moderate Rain",       emoji: "🌧️" },
  65: { label: "Heavy Rain",          emoji: "🌧️" },
  71: { label: "Slight Snow",         emoji: "🌨️" },
  73: { label: "Moderate Snow",       emoji: "❄️" },
  75: { label: "Heavy Snow",          emoji: "❄️" },
  77: { label: "Snow Grains",         emoji: "🌨️" },
  80: { label: "Slight Showers",      emoji: "🌦️" },
  81: { label: "Moderate Showers",    emoji: "🌧️" },
  82: { label: "Violent Showers",     emoji: "⛈️" },
  85: { label: "Slight Snow Showers", emoji: "🌨️" },
  86: { label: "Heavy Snow Showers",  emoji: "❄️" },
  95: { label: "Thunderstorm",        emoji: "⛈️" },
  96: { label: "Thunderstorm w/ Hail",emoji: "🌩️" },
  99: { label: "Thunderstorm w/ Hail",emoji: "🌩️" },
};

function decodeWmo(code) {
  return WMO_CODES[code] || { label: "Unknown", emoji: "🌡️" };
}

function getUvLabel(uv) {
  if (uv === null || uv === undefined) return "--";
  if (uv <= 2)  return `${uv} Low`;
  if (uv <= 5)  return `${uv} Moderate`;
  if (uv <= 7)  return `${uv} High`;
  if (uv <= 10) return `${uv} Very High`;
  return `${uv} Extreme`;
}

async function fetchWeather(latitude, longitude) {
  const nextCoords = { latitude, longitude };
  const movedMeters = state.lastWeatherCoords
    ? getDistanceMeters(
      state.lastWeatherCoords.latitude,
      state.lastWeatherCoords.longitude,
      latitude,
      longitude,
    )
    : Number.POSITIVE_INFINITY;
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (state.weatherFetchedForCoords === key && movedMeters < WEATHER_REFRESH_MIN_UPDATE_METERS) {
    return;
  }

  setWeatherCardBusy(true);
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", latitude.toFixed(5));
    url.searchParams.set("longitude", longitude.toFixed(5));
    url.searchParams.set("current", [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "wind_speed_10m",
      "precipitation",
      "uv_index",
      "weather_code",
    ].join(","));
    url.searchParams.set("daily", [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
    ].join(","));
    url.searchParams.set("forecast_days", "5");
    url.searchParams.set("timezone", "auto");

    const resp = await fetch(url.toString(), { cache: "no-store" });
    if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);

    const data = await resp.json();
    const cur = data.current || {};

    const temp    = cur.temperature_2m;
    const feels   = cur.apparent_temperature;
    const humidity= cur.relative_humidity_2m;
    const wind    = cur.wind_speed_10m;
    const rain    = cur.precipitation;
    const uv      = cur.uv_index;
    const code    = cur.weather_code;
    const wmo     = decodeWmo(code);

    if (elements.weatherEmoji)    elements.weatherEmoji.textContent = wmo.emoji;
    if (elements.weatherTemp)     elements.weatherTemp.textContent = temp !== null ? `${Math.round(temp)}°C` : "--°C";
    if (elements.weatherFeels)    elements.weatherFeels.textContent = feels !== null ? `Feels like ${Math.round(feels)}°C` : "";
    if (elements.weatherHumidity) elements.weatherHumidity.textContent = humidity !== null ? `${humidity}%` : "--%";
    if (elements.weatherWind)     elements.weatherWind.textContent = wind !== null ? `${Math.round(wind)} km/h` : "-- km/h";
    if (elements.weatherRain)     elements.weatherRain.textContent = rain !== null ? `${rain} mm` : "-- mm";
    if (elements.weatherUV)       elements.weatherUV.textContent = getUvLabel(uv);

    // Header: "Weather   Thursday, 10:00 AM   |   Mostly Cloudy"
    const now = new Date();
    const dayName = now.toLocaleDateString([], { weekday: "long" });
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    if (elements.weatherDatetime) {
      elements.weatherDatetime.textContent = `${dayName}, ${timeStr}`;
    }
    if (elements.weatherHeaderCondition) {
      elements.weatherHeaderCondition.textContent = wmo.label;
    }

    // 4-day forecast (skip today index 0, show next 4)
    if (elements.weatherForecast && data.daily) {
      const daily = data.daily;
      const dates    = daily.time || [];
      const codes    = daily.weather_code || [];
      const maxTemps = daily.temperature_2m_max || [];
      const minTemps = daily.temperature_2m_min || [];
      let forecastHtml = "";
      const count = Math.min(dates.length, 5);
      for (let i = 1; i < count; i++) {
        const date   = new Date(`${dates[i]}T12:00:00`);
        const fday   = date.toLocaleDateString([], { weekday: "short" });
        const fwmo   = decodeWmo(codes[i]);
        const hi = maxTemps[i] != null ? `${Math.round(maxTemps[i])}°` : "--°";
        const lo = minTemps[i] != null ? `${Math.round(minTemps[i])}°` : "--°";
        forecastHtml += `<div class="wc-fc-day">
          <span class="wc-fc-name">${escapeHtml(fday)}</span>
          <span class="wc-fc-emoji" title="${escapeHtml(fwmo.label)}">${fwmo.emoji}</span>
          <div class="wc-fc-temps">
            <span class="wc-fc-hi">${hi}</span>
            <span class="wc-fc-sep">/</span>
            <span class="wc-fc-lo">${lo}</span>
          </div>
        </div>`;
      }
      elements.weatherForecast.innerHTML = forecastHtml;
    }

    if (elements.weatherBody) elements.weatherBody.hidden = false;
    applyWeatherCardTint(code);

    state.weatherFetchedForCoords = key;
    state.lastWeatherCoords = nextCoords;
  } catch (err) {
    console.warn("Weather fetch failed:", err);
    if (elements.locationMeta) {
      elements.locationMeta.textContent = "Weather data unavailable.";
    }
  } finally {
    setWeatherCardBusy(false);
  }
}

function applyWeatherCardTint(code) {
  const card = elements.weatherCard;
  if (!card) return;
  // Clear previous tints
  card.removeAttribute("data-weather");
  if (code === 0 || code === 1) {
    card.setAttribute("data-weather", "sunny");
  } else if (code === 2 || code === 3) {
    card.setAttribute("data-weather", "cloudy");
  } else if (code >= 51 && code <= 67) {
    card.setAttribute("data-weather", "rainy");
  } else if (code >= 71 && code <= 77) {
    card.setAttribute("data-weather", "snowy");
  } else if (code >= 80 && code <= 82) {
    card.setAttribute("data-weather", "showery");
  } else if (code >= 95) {
    card.setAttribute("data-weather", "stormy");
  } else {
    card.setAttribute("data-weather", "foggy");
  }
}

async function reverseLookupLocation(latitude, longitude) {
  try {
    let topResult = null;
    const response = await fetch(
      `/api/location/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
    );

    if (response.ok) {
      const payload = await response.json();
      topResult = payload.results?.[0] || null;
    }

    if (!topResult) {
      // If the backend reverse-geocode endpoint isn't available, fall back to a public reverse geocoder.
      const fallbackResponse = await fetch(
        `https://geocode.maps.co/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
      );
      if (fallbackResponse.ok) {
        const fallbackPayload = await fallbackResponse.json();
        const address = fallbackPayload.address || {};
        topResult = {
          areaName: address.suburb || address.neighbourhood || address.residential || "",
          cityName: address.city || address.town || address.village || "",
          stateName: address.state || "",
          countryName: address.country || "",
          pincode: address.postcode || "",
          formattedAddress: fallbackPayload.display_name || "",
        };
      }
    }

    if (!topResult) {
      const openMeteoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&language=en&count=1`,
      );
      if (openMeteoResponse.ok) {
        const openMeteoPayload = await openMeteoResponse.json();
        const result = openMeteoPayload.results?.[0] || null;
        if (result) {
          topResult = {
            areaName: result.name || "",
            cityName: result.city || result.name || "",
            stateName: result.admin1 || "",
            countryName: result.country || "",
            pincode: result.postcode || "",
            formattedAddress: "",
          };
        }
      }
    }

    if (!topResult) return false;

    const locationLabel = formatPreciseLocationLabel(topResult);

    if (!locationLabel) {
      return false;
    }

    elements.locationText.textContent = locationLabel;
    // Remove the extra "full address" / coordinates row under the card.
    if (elements.locationMeta) {
      elements.locationMeta.textContent = "";
      elements.locationMeta.hidden = true;
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function formatPreciseLocationLabel(result) {
  const areaName = String(
    result?.areaName
    || result?.neighbourhood
    || result?.cityDistrict
    || result?.suburb
    || "",
  ).trim();
  const cityName = String(result?.cityName || result?.townName || "").trim();
  const stateName = String(result?.stateName || "").trim();
  const countryName = String(result?.countryName || "").trim();
  const pincode = String(result?.pincode || "").trim();

  const orderedParts = [areaName, cityName, stateName, countryName].filter(Boolean);
  const baseLocation = orderedParts.join(", ");

  if (!baseLocation) {
    return "";
  }
  return pincode ? `${baseLocation} - ${pincode}` : baseLocation;
}

async function geocodeCustomLocation(query) {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) {
    return null;
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmedQuery);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  const result = results[0] || null;
  if (!result) return null;

  const cityCandidate = result.admin2 || result.admin1 || result.name || "";
  return {
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
    label: formatPreciseLocationLabel({
      areaName: result.name || "",
      cityName: cityCandidate,
      stateName: result.admin1 || "",
      countryName: result.country || "",
      pincode: result.postcode || "",
    }) || [result.name, result.country].filter(Boolean).join(", "),
    query: trimmedQuery,
    area: result.name || "",
    city: cityCandidate,
    state: result.admin1 || "",
    country: result.country || "",
    pincode: result.postcode || "",
  };
}

function buildWeatherLocationQueries(locationParts) {
  const area = String(locationParts?.area || "").trim();
  const city = String(locationParts?.city || "").trim();
  const stateName = String(locationParts?.state || "").trim();
  const country = String(locationParts?.country || "").trim();
  const pincode = String(locationParts?.pincode || "").trim();

  const queries = [];

  // Highest precision first (Open-Meteo search is most reliable with "City, State, Country").
  if (city) queries.push([city, stateName, country].filter(Boolean).join(", "));
  if (area) queries.push([area, city || stateName, country].filter(Boolean).join(", "));

  // Pincode can work in some regions; try it alone (commas often hurt matching).
  if (pincode) queries.push(pincode);

  // Fallbacks if only partial data provided.
  queries.push([city || area, country].filter(Boolean).join(", "));
  queries.push([city || area, stateName].filter(Boolean).join(", "));

  // De-dupe + strip empties.
  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
}

async function geocodeCustomLocationFromParts(locationParts) {
  const queries = buildWeatherLocationQueries(locationParts);
  for (const query of queries) {
    // eslint-disable-next-line no-await-in-loop
    const hit = await geocodeCustomLocation(query);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function saveWeatherLocationForCurrentUser(location) {
  if (!state.profileUser) {
    return;
  }
  const prefs = getProfilePrefsForUser(state.profileUser);
  setProfilePrefsForUser(state.profileUser, {
    avatarDataUrl: prefs.avatarDataUrl,
    displayName: prefs.displayName,
    handle: prefs.handle,
    weatherLocation: location,
  });
}

function clearWeatherLocationForCurrentUser() {
  if (!state.profileUser) {
    return;
  }
  const prefs = getProfilePrefsForUser(state.profileUser);
  setProfilePrefsForUser(state.profileUser, {
    avatarDataUrl: prefs.avatarDataUrl,
    displayName: prefs.displayName,
    handle: prefs.handle,
    weatherLocation: null,
  });
}

async function applyManualWeatherLocation(locationDraft) {
  const queries = buildWeatherLocationQueries(locationDraft);
  const trimmedQuery = queries[0] || "";
  const previousLabel = elements.locationText?.textContent || "";
  if (!trimmedQuery) {
    setLocationMeta("Enter at least a city, state, country, or area name.", false);
    return;
  }

  elements.locationText.textContent = "Finding that location...";
  setLocationMeta("", true);
  setWeatherCardBusy(true, "Updating weather for your custom location...");

  try {
    const location = await geocodeCustomLocationFromParts(locationDraft);
    if (!location) {
      elements.locationText.textContent = previousLabel || state.manualWeatherLocation?.label || "No location selected";
      setLocationMeta("No matching location found. Try a city, neighborhood, or landmark.", false);
      setWeatherCardBusy(false);
      return;
    }

    stopLocationWatch();
    state.manualWeatherLocation = {
      ...location,
      ...locationDraft,
      query: location.query || trimmedQuery,
      area: locationDraft.area || location.area,
      city: locationDraft.city || location.city,
      state: locationDraft.state || location.state,
      country: locationDraft.country || location.country,
      pincode: locationDraft.pincode || location.pincode,
    };
    state.lastLocationCoords = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: 0,
    };
    state.lastWeatherCoords = null;
    state.weatherFetchedForCoords = null;
    elements.locationText.textContent = `${state.manualWeatherLocation.label} (Custom)`;
    setLocationMeta("Using your custom weather location.", false);
    saveWeatherLocationForCurrentUser(state.manualWeatherLocation);
    setWeatherLocationControlsOpen(false);
    void fetchWeather(state.manualWeatherLocation.latitude, state.manualWeatherLocation.longitude);
  } catch (error) {
    console.error(error);
    elements.locationText.textContent = previousLabel || state.manualWeatherLocation?.label || "Location lookup failed";
    setLocationMeta("Unable to look up that place right now.", false);
    setWeatherCardBusy(false);
  }
}

function routeToBackend(path) {
  window.location.href = path;
}

function buildGoogleAuthUrl(email = "", flow = "popup") {
  const params = new URLSearchParams();
  params.set("flow", flow);
  if (email) {
    params.set("login_hint", email);
    params.set("expected_email", email);
  }
  return `/api/auth/google/login?${params.toString()}`;
}

function openGoogleAuthPopup(email = "") {
  const popupWidth = 520;
  const popupHeight = 720;
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const viewportWidth = window.outerWidth || document.documentElement.clientWidth || popupWidth;
  const viewportHeight = window.outerHeight || document.documentElement.clientHeight || popupHeight;
  const left = Math.max(0, Math.round(dualScreenLeft + (viewportWidth - popupWidth) / 2));
  const top = Math.max(0, Math.round(dualScreenTop + (viewportHeight - popupHeight) / 2));
  const features = [
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const popup = window.open(buildGoogleAuthUrl(email), "quair-google-auth", features);
  if (!popup) {
    routeToBackend(buildGoogleAuthUrl(email, "redirect"));
    return null;
  }

  try {
    popup.focus();
  } catch {}
  return popup;
}

function switchToAccount(email) {
  const targetEmail = String(email || "").trim();
  const targetAccount = getKnownAccounts().find(
    (account) => account.email?.toLowerCase() === targetEmail.toLowerCase(),
  );

  if (!targetEmail) {
    showAccountSwitchToast("Account switch failed", "", "error");
    return;
  }

  // Close the dropdown immediately for responsive feel.
  elements.profileDropdown.hidden = true;
  elements.avatarButton.setAttribute("aria-expanded", "false");
  const label = targetAccount?.name || targetAccount?.email || "that account";
  showAccountSwitchToast(
    label,
    targetAccount?.picture || "",
    "switching",
  );

  // Try instant local switch first (no Google redirect).
  fetch("/api/auth/switch", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: targetEmail }),
  })
    .then((resp) => {
      if (!resp.ok) throw new Error("no_stored_session");
      return resp.json();
    })
    .then((data) => {
      if (!data.ok || !data.user) throw new Error("invalid_response");
      // Success — update UI instantly without page reload.
      showLoggedInUI(data.user);
      const resolvedUser = getResolvedUser(data.user);
      showAccountSwitchToast(
        resolvedUser.name || data.user.name,
        resolvedUser.picture || data.user.picture,
      );
      renderAccountsList();
      syncHistoryUiState();
    })
    .catch(() => {
      const message = `Session unavailable for ${label}. Redirecting to sign-in.`;
      showAccountSwitchToast(
        message,
        targetAccount?.picture || "",
        "switching",
      );

      routeToBackend(buildGoogleAuthUrl(targetEmail, "redirect"));
    });
}

let _toastTimer = null;
function showAccountSwitchToast(name, picture, tone = "success") {
  const toast = document.getElementById("accountSwitchToast");
  if (!toast) return;

  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  toast.classList.remove("is-hiding", "is-error", "is-success", "is-switching");
  let toneClass = "is-success";
  if (tone === "error") {
    toneClass = "is-error";
  } else if (tone === "switching") {
    toneClass = "is-switching";
  }
  toast.classList.add(toneClass);

  const initials = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const avatarHtml = picture
    ? `<img class="account-switch-toast-avatar" src="${escapeAttribute(picture)}" alt="" />`
    : `<span class="account-switch-toast-fallback">${initials}</span>`;
  let message = `Switched to ${name || "account"}`;
  if (tone === "error") {
    message = name;
  } else if (tone === "switching") {
    message = `Switching to ${name || "account"}`;
  }
  const iconHtml = tone === "error"
    ? '<svg class="account-switch-toast-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : '<svg class="account-switch-toast-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  toast.innerHTML = `
    ${iconHtml}
    ${avatarHtml}
    <span>${escapeHtml(message)}</span>
  `;
  toast.hidden = false;

  _toastTimer = setTimeout(() => {
    toast.classList.add("is-hiding");
    _toastTimer = setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-hiding");
    }, 350);
  }, 3000);
}

async function handleGoogleAuthPopupMessage(event) {
  if (event.origin !== window.location.origin) {
    return;
  }

  const payload = event.data;
  if (!payload || payload.source !== "quair-google-oauth") {
    return;
  }

  if (payload.status === "success") {
    closeAuthModal();
    if (payload.user) {
      // Set session cookies on main page
      if (payload.session_token && payload.jwt_token) {
        fetch("/api/auth/set-session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: payload.session_token,
            jwt_token: payload.jwt_token,
          }),
        }).catch(() => {
          // Ignore errors, UI will update anyway
        });
      }
      showLoggedInUI(payload.user);
      const resolvedUser = getResolvedUser(payload.user);
      showAccountSwitchToast(
        resolvedUser.name || payload.user.name,
        resolvedUser.picture || payload.user.picture,
      );
      renderAccountsList();
      syncHistoryUiState();
    }
    await checkSession();
    return;
  }

  console.error("Google sign-in failed", payload.error || "unknown_error");
  showAccountSwitchToast(
    `Google sign-in failed: ${payload.error || "unknown_error"}`,
    "",
    "error",
  );
}

function scrubIncognitoUi() {
  try {
    localStorage.removeItem("quair-incognito");
    localStorage.removeItem("incognito");
    sessionStorage.removeItem("quair-incognito");
    sessionStorage.removeItem("incognito");
  } catch {
    // Ignore storage cleanup failures.
  }

  const candidates = document.querySelectorAll(
    "#profileDropdown .dropdown-feature-item, #profileDropdown .profile-menu-item, #profileDropdown button",
  );

  for (const item of candidates) {
    const label = (item.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (label.includes("incognito")) {
      item.remove();
    }
  }
}

async function applyLocationFix(position, options = {}) {
  if (state.manualWeatherLocation && options.force !== true) {
    return;
  }
  const { latitude, longitude, accuracy } = position.coords;
  const previousCoords = state.lastLocationCoords;
  const movedMeters = previousCoords
    ? getDistanceMeters(previousCoords.latitude, previousCoords.longitude, latitude, longitude)
    : Number.POSITIVE_INFINITY;
  const accuracyImproved = accuracy < state.bestLocationAccuracy - 3
    || !Number.isFinite(state.bestLocationAccuracy);
  const shouldUseFix =
    options.force === true
    || movedMeters >= LIVE_LOCATION_MIN_UPDATE_METERS
    || accuracyImproved
    || !previousCoords;

  if (!shouldUseFix) {
    return;
  }

  state.bestLocationAccuracy = Math.min(state.bestLocationAccuracy, accuracy);
  state.lastLocationCoords = { latitude, longitude, accuracy };
  elements.locationText.textContent = previousCoords
    ? "Updating your live location..."
    : "Refining your location...";
  setLocationMeta("", true);

  const resolved = await reverseLookupLocation(latitude, longitude);

  if (!resolved) {
    elements.locationText.textContent = "Location name unavailable";
  }
  setLocationMeta("", true);

  state.locationSettled = Boolean(resolved && accuracy <= 20);
  state.liveLocationAvailable = true;

  // Fetch live weather for this location
  void fetchWeather(latitude, longitude);
}

async function syncGeolocationPermission() {
  if (!navigator.permissions?.query) {
    return;
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: "geolocation" });
    state.locationPermissionStatus = permissionStatus;
    permissionStatus.onchange = () => {
      if (state.manualWeatherLocation) {
        return;
      }
      if (permissionStatus.state === "granted") {
        void updateUserLocation();
        return;
      }

      stopLocationWatch();
      state.locationSettled = false;
      if (permissionStatus.state === "denied") {
        elements.locationText.textContent = "Enable precise location permission in your browser.";
        setLocationMeta("", true);
      }
    };
  } catch {
    // Ignore browsers with partial Permissions API support.
  }
}

async function updateUserLocation() {
  if (state.manualWeatherLocation) {
    elements.locationText.textContent = `${state.manualWeatherLocation.label} (Custom)`;
    setLocationMeta("Using your custom weather location.", false);
    void fetchWeather(state.manualWeatherLocation.latitude, state.manualWeatherLocation.longitude);
    return;
  }
  if (!("geolocation" in navigator)) {
    elements.locationText.textContent = "This browser does not support live location.";
    setLocationMeta("", true);
    return;
  }

  elements.locationText.textContent = "Requesting your current location...";
  setLocationMeta("", true);
  state.bestLocationAccuracy = Number.POSITIVE_INFINITY;
  state.locationSettled = false;
  state.liveLocationAvailable = false;
  state.lastLocationCoords = null;
  state.lastWeatherCoords = null;
  stopLocationWatch();

  try {
    let position;

    try {
      position = await getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });
    } catch (error) {
      if (error.code !== 3) {
        throw error;
      }

      position = await getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    }

    await applyLocationFix(position, { force: true });

    state.locationWatchId = navigator.geolocation.watchPosition(
      (watchPosition) => {
        void applyLocationFix(watchPosition);
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  } catch (error) {
    const messages = {
      1: "Location access was denied in the browser.",
      2: "Your location could not be determined.",
      3: "Location request timed out.",
    };

    elements.locationText.textContent =
      messages[error.code] || "Unable to read your current location.";
    setLocationMeta("", true);
  }
}

function renderResults(query) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    setTabTitleForQuery("");
    clearAnswerTyping();
    elements.answerWrap.classList.remove("is-visible");
    elements.results.innerHTML = "";
    elements.citations.innerHTML = "";
    elements.emptyState.style.display = "block";
    elements.emptyState.textContent = "";
    setSearchStatus("");
    return;
  }

  elements.answerWrap.classList.add("is-visible");
  renderOverview(trimmedQuery, "Searching...", []);
  elements.citations.innerHTML = "";
  elements.results.innerHTML = "";
  elements.emptyState.style.display = "none";
  elements.emptyState.textContent = "";
}

function renderErrorState(query, message) {
  const trimmedQuery = query.trim();

  elements.answerWrap.classList.add("is-visible");
  renderOverview(trimmedQuery, message || "Search is temporarily unavailable.", []);
  elements.citations.innerHTML = "";
  elements.results.innerHTML = "";
  setSearchStatus("Showing fallback response");
  elements.emptyState.style.display = "block";
  elements.emptyState.textContent = trimmedQuery
    ? `No live results returned for "${trimmedQuery}".`
    : "Search is temporarily unavailable.";
}

// ── YouTube video helpers ─────────────────────────────────────────────────────
function isVideoUrl(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    const videoDomains = ["youtube.com", "youtu.be", "m.youtube.com", "vimeo.com", "dailymotion.com", "twitch.tv", "tiktok.com", "bilibili.com"];
    return videoDomains.some((d) => h === d || h.endsWith(`.${d}`)) || h.includes("video");
  } catch { return false; }
}

function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v") || "";
  } catch { return ""; }
}

function pickVideoThumbForSource(source) {
  const vid = extractYouTubeId(source.url);
  if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  if (source.image) return source.image;
  return `https://api.microlink.io?url=${encodeURIComponent(source.url)}&embed=image.url`;
}

function videoCreatorLabel(source) {
  let host = "";
  try {
    host = new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
  const title = String(source.title || "").trim();
  const ytLike = host.includes("youtube") || host === "youtu.be";
  if (ytLike) {
    const parts = title.split(/\s*[-–|]\s+/);
    if (parts.length >= 2) {
      const channel = parts[parts.length - 1].trim();
      if (channel && channel.length < 96 && !/^youtube$/i.test(channel)) return channel;
    }
  }
  if (!host) return "";
  const seg = host.split(".").filter(Boolean);
  const site = seg.length >= 2 ? seg[seg.length - 2] : seg[0];
  return site ? site.charAt(0).toUpperCase() + site.slice(1) : host;
}

function videoCardDisplayTitle(source) {
  const title = String(source.title || "").trim();
  const label = videoCreatorLabel(source);
  if (!label || !title) return title || "Video";
  const re = new RegExp(`\\s*[-–|]\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  return title.replace(re, "").trim() || title;
}

function buildRelatedVideosRow(ytSources, query) {
  const seen = new Set();
  const picked = [];
  for (const s of ytSources) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    picked.push(s);
    if (picked.length >= 3) break;
  }
  if (!picked.length) return null;

  const section = document.createElement("section");
  section.className = "related-videos-strip";

  const hdr = document.createElement("div");
  hdr.className = "related-videos-strip-head";
  hdr.innerHTML = `
    <span class="related-videos-strip-title">Videos</span>
    <a class="related-videos-strip-more" href="https://duckduckgo.com/?q=${encodeURIComponent(`${query} videos`)}" target="_blank" rel="noreferrer noopener">
      View more
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </a>`;
  section.appendChild(hdr);

  const grid = document.createElement("div");
  grid.className = "related-videos-grid";

  for (const src of picked) {
    const thumb = pickVideoThumbForSource(src);
    const creator = videoCreatorLabel(src);
    const cardTitle = videoCardDisplayTitle(src);
    let host = "";
    try {
      host = new URL(src.url).hostname.replace(/^www\./, "");
    } catch { /* noop */ }

    const card = document.createElement("a");
    card.className = "related-video-card";
    card.href = src.url;
    card.target = "_blank";
    card.rel = "noreferrer noopener";
    card.innerHTML = `
      <div class="related-video-cover">
        <img class="related-video-cover-img" src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <span class="related-video-play" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </span>
      </div>
      <div class="related-video-body">
        <p class="related-video-title">${escapeHtml(cardTitle)}</p>
        <div class="related-video-creator">
          ${host ? `<img class="related-video-favicon" src="https://www.google.com/s2/favicons?sz=32&domain=${escapeAttribute(host)}" alt="" />` : ""}
          <span>${escapeHtml(creator || host || "Video")}</span>
        </div>
      </div>`;
    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

function buildResultCard(source) {

  const card = document.createElement("article");
  card.className = "result-card";
  const bookmarked = isBookmarked(source.url);
  const sourceMeta = (() => {
    try {
      const parsed = new URL(source.url);
      return {
        hostname: parsed.hostname,
        displayUrl: `${parsed.protocol}//${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`,
      };
    } catch {
      return {
        hostname: source.url,
        displayUrl: source.url,
      };
    }
  })();
  card.innerHTML = `
    <button class="result-bookmark${bookmarked ? " is-bookmarked" : ""}" type="button" title="${bookmarked ? "Remove bookmark" : "Bookmark"}" data-bm-url="${escapeHtml(source.url)}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${bookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    </button>
    <div class="result-source-row">
      <span class="result-favicon-circle">
        <img class="result-favicon" src="https://www.google.com/s2/favicons?sz=32&domain=${escapeAttribute(sourceMeta.hostname)}" alt="" />
      </span>
      <div class="result-source-inline">
        <span class="result-source-name">${escapeHtml(sourceMeta.hostname)}</span>
        <span class="result-url">${escapeHtml(sourceMeta.displayUrl)}</span>
      </div>
    </div>
    <h3 class="result-title">
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(source.title)}</a>
    </h3>
    <p class="result-snippet">${escapeHtml(source.summary)}</p>
    <div class="result-meta">
      ${Array.isArray(source.sources) ? source.sources.map((item) => `<span class="result-badge">${escapeHtml(item)}</span>`).join("") : ""}
      ${source.semantic_score ? `<span class="result-badge">semantic ${Number(source.semantic_score).toFixed(2)}</span>` : ""}
      ${source.quantum_score ? `<span class="result-badge">quantum ${Number(source.quantum_score).toFixed(2)}</span>` : ""}
    </div>
  `;
  const bmBtn = card.querySelector(".result-bookmark");
  bmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!state.profileUser) {
      openAuthModal();
      return;
    }
    if (isBookmarked(source.url)) {
      removeBookmark(source.url);
      bmBtn.classList.remove("is-bookmarked");
      bmBtn.querySelector("svg").setAttribute("fill", "none");
      bmBtn.title = "Bookmark";
    } else {
      addBookmark(source.url, source.title, source.summary);
      bmBtn.classList.add("is-bookmarked");
      bmBtn.querySelector("svg").setAttribute("fill", "currentColor");
      bmBtn.title = "Remove bookmark";
    }
  });
  const cardLink = card.querySelector(".result-title a");
  if (cardLink) {
    cardLink.addEventListener("click", () => {
      saveHistory(`${source.title} – ${(() => { try { return new URL(source.url).hostname; } catch { return source.url; } })()}`);
      trackClick({
        searchEventId: state.lastSearchEventId || null,
        resultUrl: source.url,
        resultTitle: source.title,
        resultDomain: (() => { try { return new URL(source.url).hostname; } catch { return ""; } })(),
        resultRank: Array.from(elements.results.children).indexOf(card) + 1,
        queryRaw: state.lastSubmittedQuery,
      });
    });
  }
  return card;
}

function showMoreResults() {
  if (!state.lastSearchPayload) return;
  const sources = Array.isArray(state.lastSearchPayload.sources) ? state.lastSearchPayload.sources : [];
  const end = Math.min(state.displayedResultCount + state.resultPageSize, sources.length);
  for (let i = state.displayedResultCount; i < end; i++) {
    elements.results.appendChild(buildResultCard(sources[i]));
  }
  state.displayedResultCount = end;
  elements.loadMoreWrap.hidden = end >= sources.length;
}

function renderLiveResults(query, payload) {
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  state.lastSearchPayload = payload;
  state.displayedResultCount = 0;

  tryInstantAnswer(query);

  // ── Spell Correction Banner ──
  const correctedQuery = payload.corrected_query || null;
  if (correctedQuery && correctedQuery.toLowerCase() !== query.toLowerCase()) {
    elements.spellCorrection.hidden = false;
    elements.spellCorrectedLink.textContent = correctedQuery;
    elements.spellOriginalLink.textContent = query;

    // Click corrected query → search with correct spelling
    elements.spellCorrectedLink.onclick = (e) => {
      e.preventDefault();
      elements.queryInput.value = correctedQuery;
      performSearch();
    };

    // Click original query → search with original (as-is)
    elements.spellOriginalLink.onclick = (e) => {
      e.preventDefault();
      elements.queryInput.value = query;
      performSearch();
    };
  } else {
    elements.spellCorrection.hidden = true;
  }

  const finalAnswer = typeof payload?.final_answer === "string" ? payload.final_answer : String(payload?.final_answer || "");
  const topStoryUrls = renderOverview(query, finalAnswer || "insufficient data", sources);
  elements.citations.innerHTML = "";
  elements.results.innerHTML = "";

  for (const source of sources.slice(0, 3)) {
    const link = document.createElement("a");
    link.className = "citation";
    link.href = source.url;
    link.target = "_blank";
    link.textContent = (() => { try { return new URL(source.url).hostname; } catch { return source.url; } })();
    link.rel = "noreferrer noopener";
    link.addEventListener("click", () => {
      saveHistory(`${source.title} – ${link.textContent}`);
    });
    elements.citations.appendChild(link);
  }

  // ── Render result cards — inject related video row after 2nd card when we have video URLs from results
  const topStoryUrlSet = new Set(topStoryUrls || []);
  const webSources  = sources.filter((s) => !isVideoUrl(s.url) && !topStoryUrlSet.has(s.url));
  const ytSources   = sources.filter((s) =>  isVideoUrl(s.url) && !topStoryUrlSet.has(s.url));
  const initialWeb  = webSources.slice(0, state.resultPageSize);
  const relatedVideosRow = buildRelatedVideosRow(ytSources, query);

  let videoRowInjected = false;
  for (let i = 0; i < initialWeb.length; i++) {
    elements.results.appendChild(buildResultCard(initialWeb[i]));

    if (i === 1 && !videoRowInjected && relatedVideosRow) {
      elements.results.appendChild(relatedVideosRow);
      videoRowInjected = true;
    }
  }

  // Render remaining results beyond the page limit (so full list shows after video section)
  const remainingWeb = webSources.slice(state.resultPageSize);
  for (const src of remainingWeb) {
    elements.results.appendChild(buildResultCard(src));
  }

  if (!videoRowInjected && relatedVideosRow) {
    elements.results.appendChild(relatedVideosRow);
  }

  state.displayedResultCount = initialWeb.length;
  elements.loadMoreWrap.hidden = webSources.length <= state.resultPageSize;
  renderAnalytics(payload);

  elements.answerWrap.classList.add("is-visible");
  setSearchStatus(
    sources.length
      ? buildSearchStatus(query, payload)
      : "No strong live sources found",
  );
  const emptyMessage = String(payload.empty_state || "").trim();
  elements.emptyState.style.display = sources.length === 0 || Boolean(emptyMessage) ? "block" : "none";
  elements.emptyState.textContent = emptyMessage || (sources.length === 0 ? "No matching results found." : "");
}

function buildSearchStatus(query, payload) {
  const semanticHits = payload?.analytics?.semantic_hits || 0;
  const groverSteps = payload?.quantum?.simulated_quantum_steps;
  const parts = [`Live results for "${query}"`];
  if (semanticHits) {
    parts.push(`semantic ${semanticHits}`);
  }
  if (groverSteps) {
    parts.push(`grover ${groverSteps} steps`);
  }
  return parts.join(" | ");
}

function renderAnalytics(payload) {
  if (!elements.analyticsBoard) {
    return;
  }

  const analytics = payload?.analytics || {};
  const quantum = payload?.quantum || {};
  const modes = Array.isArray(payload?.search_modes) ? payload.search_modes : [];
  const sourceMix = analytics.source_mix || {};
  const chips = [
    ["Modes", modes.join(" + ") || "classic"],
    ["Results", analytics.result_count ?? 0],
    ["Semantic", analytics.semantic_hits ?? 0],
    ["Speedup", quantum.estimated_speedup ? `${quantum.estimated_speedup}x` : "n/a"],
    ["Filters", analytics.filters_active ?? 0],
    ["Mix", Object.entries(sourceMix).map(([key, value]) => `${key}:${value}`).join(" ") || "n/a"],
  ];

  elements.analyticsBoard.innerHTML = chips
    .map(([label, value]) => `
      <div class="analytics-chip">
        <span class="analytics-label">${escapeHtml(String(label))}</span>
        <strong class="analytics-value">${escapeHtml(String(value))}</strong>
      </div>
    `)
    .join("");
  elements.analyticsBoard.hidden = false;
  elements.resultsHead.style.display = "flex";
}

function getDropdownItems(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const history = readHistory();

  const historyMatches = history
    .filter((item) => !normalizedQuery || item.toLowerCase().includes(normalizedQuery))
    .slice(0, 5)
    .map((item) => ({ type: "history", text: item }));

  const historyTextsLower = new Set(historyMatches.map((h) => h.text.toLowerCase()));

  const suggestionMatches = state.liveSuggestions
    .filter((item) => {
      const val = typeof item === "object" ? item.title : item;
      const lower = val.toLowerCase();
      return !historyTextsLower.has(lower) && (!normalizedQuery || lower.includes(normalizedQuery));
    })
    .slice(0, normalizedQuery ? 5 : 0)
    .map((item) => typeof item === "object" 
      ? { type: "suggestion", text: item.title, image: item.image || "", description: item.description || "" }
      : { type: "suggestion", text: item, image: "", description: "" }
    );

  const trendingMatches = !normalizedQuery
    ? state.liveSuggestions
        .filter((item) => !historyTextsLower.has((typeof item === "object" ? item.title : item).toLowerCase()))
        .slice(0, 8)
        .map((item) =>
          typeof item === "object"
            ? { type: "trending", text: item.title, image: item.image || "", description: item.description || "" }
            : { type: "trending", text: item, image: "", description: "" }
        )
    : [];

  return {
    history: historyMatches,
    suggestions: suggestionMatches,
    trending: trendingMatches,
  };
}

function closeDropdown() {
  elements.suggestPanel.classList.remove("is-open");
  elements.suggestPanel.innerHTML = "";
  elements.queryInput.setAttribute("aria-expanded", "false");
  state.activeItems = [];
  state.activeIndex = -1;
}

function clearAnalytics() {
  if (!elements.analyticsBoard) {
    return;
  }
  elements.analyticsBoard.innerHTML = "";
  elements.analyticsBoard.hidden = true;
}

function closeAttachMenu() {
  elements.attachMenu.classList.remove("is-open");
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, "&quot;");
}

function renderGroup(label, items, offset) {
  if (!items.length) {
    return "";
  }

  const renderedItems = items
    .map((item, index) => {
      const isHistory  = item.type === "history";
      const isTrending = item.type === "trending";

      // Left icon: circular image (trending with photo), trending arrow, or clock
      let iconHtml;
      if (item.image) {
        iconHtml = `<img class="suggest-trend-img" src="${escapeAttribute(item.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`;
      } else if (isTrending) {
        iconHtml = `<svg class="suggest-trend-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
      } else if (isHistory) {
        iconHtml = `<svg class="suggest-history-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      } else {
        iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
      }

      // Right side
      const rightHtml = isHistory
        ? `<button class="history-delete" type="button" data-delete="${escapeAttribute(item.text)}" aria-label="Remove">×</button>`
        : "";

      const descHtml = !isTrending && item.description
        ? `<span class="suggest-trend-desc">${escapeHtml(item.description)}</span>`
        : "";

      return `
        <div class="suggest-item${item.image ? " has-img" : ""}" role="button" tabindex="0"
          data-index="${offset + index}" data-value="${escapeAttribute(item.text)}">
          <span class="item-icon">${iconHtml}</span>
          <span class="item-body">
            <span class="item-text">${escapeHtml(item.text)}</span>
            ${descHtml}
          </span>
          <span class="item-right">${rightHtml}</span>
        </div>`;
    })
    .join("");

  return `
    <div class="suggest-group">
      <span class="suggest-label${label === "Popular" ? " trending-label" : ""}">
        ${label}
      </span>
      ${renderedItems}
    </div>
  `;
}

function openDropdown(query) {
  const groups = getDropdownItems(query);
  const hasQuery = Boolean(query.trim());

  state.activeItems = [...groups.history, ...(hasQuery ? groups.suggestions : groups.trending)];

  if (!state.activeItems.length) {
    closeDropdown();
    return;
  }

  let offset = 0;
  let html = "";

  if (groups.history.length) {
    html += renderGroup(hasQuery ? "Recent" : "Recent searches", groups.history, offset);
    offset += groups.history.length;
  }

  if (hasQuery && groups.suggestions.length) {
    html += renderGroup("Suggestions", groups.suggestions, offset);
    offset += groups.suggestions.length;
  }

  if (!hasQuery && groups.trending.length) {
    html += renderGroup("Trending searches", groups.trending, offset);
  }

  elements.suggestPanel.innerHTML = html;
  elements.suggestPanel.classList.add("is-open");
  elements.queryInput.setAttribute("aria-expanded", "true");
  state.activeIndex = -1;

  // Delegate dropdown clicks (more reliable than nested listeners)
  elements.suggestPanel.onclick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const deleteButton = target.closest(".history-delete");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      const value = deleteButton.getAttribute("data-delete") || "";
      if (value) {
        removeHistoryItem(value);
      }
      return;
    }

    const itemButton = target.closest(".suggest-item");
    if (!itemButton) {
      return;
    }
    const value = itemButton.getAttribute("data-value") || "";
    if (!value) {
      return;
    }
    elements.queryInput.value = value;
    void executeSearch(value, state.attachmentContext);
  };
}

function updateActiveItem() {
  for (const item of Array.from(elements.suggestPanel.querySelectorAll(".suggest-item"))) {
    const index = Number(item.getAttribute("data-index"));
    item.classList.toggle("is-active", index === state.activeIndex);
  }
}

function buildSearchCacheKey(query, settings, attachmentContext) {
  return [
    query.trim().toLowerCase(),
    settings.region,
    settings.displayLanguage,
    settings.safeSearch,
    attachmentContext,
  ].join("|");
}

function getCachedSearchPayload(cacheKey) {
  const cached = state.searchCache.get(cacheKey);
  if (!cached || Date.now() - cached.timestamp > searchCacheTtlMs) {
    state.searchCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function rememberSearchPayload(cacheKey, payload) {
  state.searchCache.set(cacheKey, {
    payload,
    timestamp: Date.now(),
  });

  if (state.searchCache.size > 25) {
    const oldestKey = state.searchCache.keys().next().value;
    state.searchCache.delete(oldestKey);
  }
}

async function executeSearch(query, attachmentContext = "", options = {}) {
  const trimmedQuery = query.trim();
  const displayQuery = String(options.displayQuery ?? trimmedQuery).trim() || trimmedQuery;
  const inputValue = typeof options.inputValue === "string" ? options.inputValue : trimmedQuery;
  const shouldSaveHistory = options.saveHistory !== false;
  setActiveSearchTab("all");

  if (!trimmedQuery) {
    renderResults("");
    clearAnalytics();
    closeDropdown();

    return;
  }

  if (state.searchController) {
    state.searchController.abort();
  }

  const searchToken = ++state.activeSearchToken;
  state.searchController = new AbortController();
  const settings = getStoredSettings();
  elements.queryInput.value = inputValue;

  if (shouldSaveHistory) {
    saveHistory(trimmedQuery);
  }
  closeDropdown();
  tryInstantAnswer(trimmedQuery);
  setSearchLoading(true);
  state.lastSubmittedQuery = displayQuery;

  try {
    const translatedQuery = await translateQueryForSearch(trimmedQuery, settings.displayLanguage);
    const cacheKey = buildSearchCacheKey(translatedQuery, settings, attachmentContext);
    const cachedPayload = getCachedSearchPayload(cacheKey);

    if (cachedPayload) {
      renderLiveResults(displayQuery, cachedPayload);
      setSearchLoading(false, `Ready from recent search for "${displayQuery}"`);
      void applyPageLanguage(settings.displayLanguage);
      return;
    }

    const searchUrl = `/api/search?q=${encodeURIComponent(translatedQuery)}&region=${encodeURIComponent(settings.region)}&hl=${encodeURIComponent(settings.displayLanguage)}&safe_search=${encodeURIComponent(settings.safeSearch)}&context=${encodeURIComponent(attachmentContext)}`;
    const response = await fetch(searchUrl, { signal: state.searchController.signal });

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Search returned an invalid response.");
    }

    if (searchToken !== state.activeSearchToken) {
      return;
    }

    try {
      rememberSearchPayload(cacheKey, payload);
      renderLiveResults(displayQuery, payload);
      void trackSearch({
        queryRaw: trimmedQuery,
        queryNormalized: payload?.query || trimmedQuery,
        resultCount: Array.isArray(payload?.sources) ? payload.sources.length : 0,
        responseMs: payload?.index_status?.response_ms || 0,
        settings,
      }).then((eventId) => {
        if (searchToken === state.activeSearchToken) {
          state.lastSearchEventId = eventId;
        }
      });
    } catch (renderError) {
      console.error(renderError);
      renderErrorState(displayQuery, "Live search could not complete.");

      // Try to render the sources list even if overview rendering fails.
      const sources = Array.isArray(payload?.sources) ? payload.sources : [];
      if (sources.length) {
        elements.results.innerHTML = "";
        for (const source of sources.slice(0, state.resultPageSize)) {
          elements.results.appendChild(buildResultCard(source));
        }
        elements.loadMoreWrap.hidden = sources.length <= state.resultPageSize;
        setSearchStatus(`Partial results for "${displayQuery}"`);
      }
    }
    void applyPageLanguage(settings.displayLanguage);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    console.error(error);
    renderErrorState(displayQuery, error?.message || "Live search could not complete.");
    void applyPageLanguage(settings.displayLanguage);
  } finally {
    if (searchToken === state.activeSearchToken) {
      state.searchController = null;
      setSearchLoading(false, elements.statusPill.textContent);
    }
  }
}

async function loadTrendingTopics() {
  try {
    const region = getStoredSettings().region || "IN";
    const response = await fetch(`/api/trending?geo=${encodeURIComponent(region)}`);
    if (!response.ok) throw new Error(`Trending ${response.status}`);
    const payload = await response.json();
    // Prefer rich items (with image/description); fall back to plain string array
    if (Array.isArray(payload.rich) && payload.rich.length) {
      state.liveSuggestions = payload.rich; // array of {title, image, description}
    } else if (Array.isArray(payload.topics)) {
      state.liveSuggestions = payload.topics; // plain strings
    } else {
      state.liveSuggestions = [];
    }
  } catch (error) {
    console.error(error);
    state.liveSuggestions = [];
  }
}

async function refreshLiveSuggestions(query) {
  const trimmedQuery = query.trim();
  const requestToken = ++state.suggestRequestToken;

  if (!trimmedQuery) {
    await loadTrendingTopics();
    openDropdown("");
    return;
  }

  try {
    const response = await fetch(`/api/suggest?q=${encodeURIComponent(trimmedQuery)}`);
    if (!response.ok) {
      throw new Error(`Suggest request failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (requestToken !== state.suggestRequestToken) {
      return;
    }

    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    state.liveSuggestions = suggestions.length ? suggestions : state.liveSuggestions;
    openDropdown(trimmedQuery);
  } catch (error) {
    console.error(error);
  }
}

function scheduleSuggestionRefresh(query) {
  if (state.suggestTimer) {
    clearTimeout(state.suggestTimer);
  }
  state.suggestTimer = window.setTimeout(() => {
    void refreshLiveSuggestions(query);
  }, 120);
}

function handlePickedFiles(files) {
  if (!files.length) {
    return;
  }

  void analyzePickedFiles(files);
}

async function fileToPayload(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const [, contentBase64 = ""] = dataUrl.split(",", 2);

  return {
    name: file.name,
    mime_type: file.type || "application/octet-stream",
    content_base64: contentBase64,
  };
}

function getAttachmentKind(file) {
  const type = String(file?.type || "");
  if (type.startsWith("image/")) return "image";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("spreadsheet") || type.includes("excel")) return "sheet";
  if (type.includes("word")) return "doc";
  if (type.includes("presentation") || type.includes("powerpoint")) return "slides";
  if (type.includes("text")) return "text";
  return "file";
}

function getFileExtension(name) {
  const value = String(name || "");
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === value.length - 1) return "";
  return value.slice(lastDot + 1).toLowerCase();
}

function getAttachmentIconMeta(item) {
  const ext = getFileExtension(item?.name);
  const kind = item?.kind || "file";
  const key = kind === "file" && ext ? ext : kind;

  const meta = {
    label: "",
    className: "is-generic",
    glyph: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    `,
  };

  if (key === "pdf") {
    meta.label = "PDF";
    meta.className = "is-pdf";
  } else if (key === "sheet" || key === "xlsx" || key === "xls" || key === "csv") {
    meta.label = "XLS";
    meta.className = "is-sheet";
  } else if (key === "doc" || key === "docx") {
    meta.label = "DOC";
    meta.className = "is-doc";
  } else if (key === "slides" || key === "ppt" || key === "pptx") {
    meta.label = "PPT";
    meta.className = "is-slides";
  } else if (key === "text" || key === "txt" || key === "json") {
    meta.label = "TXT";
    meta.className = "is-text";
  }

  return meta;
}

function formatAttachmentSummary(summary) {
  const text = String(summary || "").replace(/\s+/g, " ").trim();
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 177).trimEnd()}...`;
}

function clearAttachments() {
  for (const item of state.attachments) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
  state.attachments = [];
  state.attachmentContext = "";
  state.attachmentSummary = "";
  if (elements.attachPreview) {
    elements.attachPreview.classList.remove("is-visible");
    elements.attachPreview.innerHTML = "";
  }
}

function renderAttachments() {
  if (!elements.attachPreview) return;

  if (!state.attachments.length) {
    elements.attachPreview.classList.remove("is-visible");
    elements.attachPreview.innerHTML = "";
    return;
  }

  const chips = state.attachments.map((item) => {
    const isImage = item.kind === "image" && item.previewUrl;
    const iconMeta = isImage ? null : getAttachmentIconMeta(item);
    const iconHtml = isImage
      ? `<img class="attach-chip-thumb" src="${escapeAttribute(item.previewUrl)}" alt="" />`
      : `
        <span class="attach-chip-icon ${escapeAttribute(iconMeta.className)}" aria-hidden="true">
          ${iconMeta.glyph}
          ${iconMeta.label ? `<span class="attach-chip-badge">${escapeHtml(iconMeta.label)}</span>` : ""}
        </span>
      `;

    const fileNameHtml = isImage
      ? ""
      : `<span class="attach-chip-name">${escapeHtml(item.name)}</span>`;

    return `
      <span class="attach-chip${isImage ? " is-image" : " is-file"}" data-attachment-id="${escapeAttribute(item.id)}"${isImage ? ` data-preview-src="${escapeAttribute(item.previewUrl)}"` : ""}>
        ${iconHtml}
        ${fileNameHtml}
        <button class="attach-chip-remove" type="button" aria-label="Remove attachment" data-attachment-remove="${escapeAttribute(item.id)}">×</button>
      </span>
    `;
  }).join("");

  elements.attachPreview.innerHTML = chips;
  elements.attachPreview.classList.add("is-visible");

  for (const button of Array.from(elements.attachPreview.querySelectorAll("[data-attachment-remove]"))) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearAttachments();
    });
  }

  for (const chip of Array.from(elements.attachPreview.querySelectorAll(".attach-chip.is-image"))) {
    chip.addEventListener("click", () => {
      const src = chip.getAttribute("data-preview-src") || "";
      if (src) {
        openImagePreview(src);
      }
    });
  }
}

async function analyzePickedFiles(files) {
  try {
    setSearchLoading(true, "Analyzing upload...");
    const payloadFiles = await Promise.all(files.slice(0, 3).map((file) => fileToPayload(file)));
    const response = await fetch("/api/attachments/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payloadFiles }),
    });

    if (!response.ok) {
      throw new Error(`Attachment analysis failed with status ${response.status}`);
    }

    const payload = await response.json();
    const attachmentQuery = String(payload.search_query || "").trim()
      || "Summarize the uploaded attachment and explain the important details.";
    const attachmentSummary = String(payload.summary || "").trim();
    const attachmentDetails = String(payload.details || "").trim();
    const attachmentContext = [attachmentSummary, attachmentDetails].filter(Boolean).join(" ");

    clearAttachments();
    state.attachments = files.slice(0, 3).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      kind: getAttachmentKind(file),
      mime: file.type || "",
      previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    state.attachmentContext = attachmentContext;
    state.attachmentSummary = attachmentDetails || attachmentSummary;
    renderAttachments();
    await executeSearch(attachmentQuery, attachmentContext, {
      displayQuery: files[0]?.name || "Attachment analysis",
      inputValue: "",
      saveHistory: false,
    });
    if (state.attachmentSummary) {
      setSearchStatus(`Upload summary: ${formatAttachmentSummary(state.attachmentSummary)}`);
    }
    elements.queryInput.value = "";
    elements.queryInput.focus();
  } catch (error) {
    console.error(error);
    clearAttachments();
    state.attachments = files.slice(0, 3).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      kind: getAttachmentKind(file),
      mime: file.type || "",
      previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    state.attachmentContext = "Uploaded file analysis unavailable.";
    state.attachmentSummary = "Uploaded file analysis unavailable.";
    renderAttachments();
    elements.queryInput.value = "";
    elements.queryInput.focus();
    renderErrorState(files[0]?.name || "Attachment analysis", "Attachment analysis unavailable.");
    setSearchLoading(false, "");
  }
}

function setAuthMode() {
  elements.authEyebrow.textContent = "QuAir account";
  elements.authTitle.textContent = "Create your account";
  elements.authDescription.textContent = "";
  elements.authSubmitButton.textContent = "Sign up with email";

  const googleLabel = document.getElementById("googleLabel");
  if (googleLabel) googleLabel.textContent = "Sign up with Google";

  void applyPageLanguage(getStoredSettings().displayLanguage);
}

function openAuthModal() {
  setAuthMode();
  elements.authModal.classList.add("is-open");
  elements.authModal.setAttribute("aria-hidden", "false");
  elements.authEmailInput.focus();
}

function closeAuthModal() {
  elements.authModal.classList.remove("is-open");
  elements.authModal.setAttribute("aria-hidden", "true");
}

function buildDisplayNames() {
  try {
    return {
      language: new Intl.DisplayNames(["en"], { type: "language" }),
      region: new Intl.DisplayNames(["en"], { type: "region" }),
    };
  } catch {
    return {
      language: null,
      region: null,
    };
  }
}

const displayNames = buildDisplayNames();

function formatLanguageLabel(code) {
  if (code === "en-US") return "English (United States)";
  if (code === "en-GB") return "English (United Kingdom)";
  if (code === "en-IN") return "English (India)";

  const [baseCode, regionCode] = code.split("-");
  const englishLabel = displayNames.language?.of(baseCode) || baseCode;

  let nativeLabel = baseCode;
  try {
    const nativeDN = new Intl.DisplayNames([code], { type: "language" });
    nativeLabel = nativeDN.of(baseCode) || baseCode;
  } catch {
    nativeLabel = englishLabel;
  }

  // Capitalize first letter of native label
  const capitalizedNative = nativeLabel.charAt(0).toUpperCase() + nativeLabel.slice(1);

  if (regionCode) {
    const regionLabel = displayNames.region?.of(regionCode) || regionCode;
    return `${capitalizedNative} (${englishLabel}, ${regionLabel})`;
  }

  if (capitalizedNative.toLowerCase() === englishLabel.toLowerCase()) {
    return englishLabel;
  }

  return `${capitalizedNative} (${englishLabel})`;
}

function formatRegionLabel(code) {
  return displayNames.region?.of(code) || code;
}

function populateSelectOptions(selectElement, options, labelFormatter) {
  const optionMarkup = options
    .map((optionValue) => {
      const optionLabel = labelFormatter(optionValue);
      return `<option value="${escapeAttribute(optionValue)}">${escapeHtml(optionLabel)}</option>`;
    })
    .join("");

  selectElement.innerHTML = optionMarkup;
}

function populateSettingsOptions() {
  if (!elements.settingDisplayLanguage || !elements.settingRegion) {
    return;
  }

  if (!elements.settingDisplayLanguage.options.length) {
    populateSelectOptions(elements.settingDisplayLanguage, topLanguageOptions, formatLanguageLabel);
  }

  if (!elements.settingRegion.options.length) {
    const sortedRegions = [...topRegionOptions].sort((a, b) => {
      return formatRegionLabel(a).localeCompare(formatRegionLabel(b));
    });
    populateSelectOptions(elements.settingRegion, sortedRegions, formatRegionLabel);
  }
}

function getCountryFlagEmoji(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (code.length !== 2) return "";
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}

function getFlagImgHtml(code, size = 20) {
  const cc = String(code || "").toLowerCase();
  if (!cc || cc.length !== 2) return "";
  return `<img src="https://flagcdn.com/w${size}/${cc}.png" srcset="https://flagcdn.com/w${size * 2}/${cc}.png 2x" width="${size}" height="${Math.round(size * 0.75)}" alt="${cc.toUpperCase()} flag" class="flag-img" onerror="this.style.display='none'">`;
}

function formatRegionLabelWithFlag(code) {
  const flag = getCountryFlagEmoji(code);
  const name = formatRegionLabel(code);
  return flag ? `${flag} ${name}` : name;
}

function buildFlagTriggerHtml(code, name) {
  const flagHtml = getFlagImgHtml(code, 20);
  return `<span class="custom-dropdown-trigger-inner">${flagHtml}<span>${name}</span></span>`;
}

const customDropdownState = {
  languageDropdown: null,
  regionDropdown: null,
  cardLanguageDropdown: null,
  cardRegionDropdown: null,
  listenersInitialized: false,
};

function closeAllCustomDropdowns(exceptDropdown = null) {
  const dropdowns = document.querySelectorAll(".custom-dropdown");
  for (const dropdown of dropdowns) {
    if (dropdown === exceptDropdown) continue;
    const trigger = dropdown.querySelector(".custom-dropdown-trigger");
    const menu = dropdown.querySelector(".custom-dropdown-menu");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (menu) menu.hidden = true;
  }
}

function toggleCustomDropdown(dropdown) {
  const trigger = dropdown.querySelector(".custom-dropdown-trigger");
  const menu = dropdown.querySelector(".custom-dropdown-menu");
  if (!trigger || !menu) return;

  const isOpen = trigger.getAttribute("aria-expanded") === "true";

  if (isOpen) {
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  } else {
    closeAllCustomDropdowns(dropdown);
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    const selectedOption = menu.querySelector(".is-selected");
    if (selectedOption) {
      selectedOption.scrollIntoView({ block: "nearest" });
    }
  }
}

function selectCustomDropdownOption(dropdown, value, labelText, isRegion = false) {
  const trigger = dropdown.querySelector(".custom-dropdown-trigger");
  const valueEl = trigger?.querySelector(".custom-dropdown-value");
  const menu = dropdown.querySelector(".custom-dropdown-menu");

  if (valueEl) {
    if (isRegion) {
      valueEl.innerHTML = buildFlagTriggerHtml(value, labelText);
    } else {
      valueEl.textContent = labelText;
    }
  }
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  if (menu) {
    menu.hidden = true;
    const options = menu.querySelectorAll(".custom-dropdown-option");
    for (const opt of options) {
      opt.classList.toggle("is-selected", opt.dataset.value === value);
    }
  }

  const dropdownType = dropdown.dataset.dropdown;
  let hiddenSelect = null;
  if (dropdownType === "language") {
    hiddenSelect = elements.settingsPopupLanguage;
  } else if (dropdownType === "region") {
    hiddenSelect = elements.settingsPopupRegion;
  } else if (dropdownType === "card-language") {
    hiddenSelect = elements.settingDisplayLanguage;
  } else if (dropdownType === "card-region") {
    hiddenSelect = elements.settingRegion;
  }
  if (hiddenSelect) hiddenSelect.value = value;
}

function buildCustomDropdownOptions(dropdown, options, formatter, withFlag = false) {
  const menu = dropdown.querySelector(".custom-dropdown-menu");
  if (!menu) return;

  menu.innerHTML = "";
  for (const code of options) {
    const li = document.createElement("li");
    li.className = "custom-dropdown-option";
    li.setAttribute("role", "option");
    li.dataset.value = code;

    if (withFlag) {
      const name = formatRegionLabel(code);
      const flagImg = getFlagImgHtml(code, 20);
      li.innerHTML = `<span class="custom-dropdown-option-flag">${flagImg}</span><span class="custom-dropdown-option-text">${name}</span>`;
    } else {
      li.innerHTML = `<span class="custom-dropdown-option-text">${formatter(code)}</span>`;
    }

    li.addEventListener("click", () => {
      if (withFlag) {
        const name = formatRegionLabel(code);
        selectCustomDropdownOption(dropdown, code, name, true);
      } else {
        selectCustomDropdownOption(dropdown, code, formatter(code), false);
      }
    });

    menu.appendChild(li);
  }
}

function initCustomDropdownListeners() {
  if (customDropdownState.listenersInitialized) return;

  document.addEventListener("click", (e) => {
    const isInsideDropdown = e.target.closest(".custom-dropdown");
    if (!isInsideDropdown) {
      closeAllCustomDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllCustomDropdowns();
    }
  });

  customDropdownState.listenersInitialized = true;
}

function initSingleCustomDropdown(dropdown, optionsList, formatter, withFlag) {
  if (!dropdown || dropdown.dataset.initialized === "true") return;

  const sortedOptions = [...optionsList].sort((a, b) => {
    const labelA = withFlag ? formatRegionLabel(a) : formatter(a);
    const labelB = withFlag ? formatRegionLabel(b) : formatter(b);
    return labelA.localeCompare(labelB);
  });
  buildCustomDropdownOptions(dropdown, sortedOptions, formatter, withFlag);

  const trigger = dropdown.querySelector(".custom-dropdown-trigger");
  if (trigger) {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      toggleCustomDropdown(dropdown);
    });
  }

  dropdown.dataset.initialized = "true";
}

function initCustomDropdowns() {
  initCustomDropdownListeners();

  const langDropdown = document.getElementById("settingsPopupLanguageDropdown");
  const regionDropdown = document.getElementById("settingsPopupRegionDropdown");
  const cardLangDropdown = document.getElementById("settingLanguageDropdown");
  const cardRegionDropdown = document.getElementById("settingRegionDropdown");

  if (langDropdown && !customDropdownState.languageDropdown) {
    customDropdownState.languageDropdown = langDropdown;
    initSingleCustomDropdown(langDropdown, topLanguageOptions, formatLanguageLabel, false);
  }

  if (regionDropdown && !customDropdownState.regionDropdown) {
    customDropdownState.regionDropdown = regionDropdown;
    initSingleCustomDropdown(regionDropdown, topRegionOptions, formatRegionLabel, true);
  }

  if (cardLangDropdown && !customDropdownState.cardLanguageDropdown) {
    customDropdownState.cardLanguageDropdown = cardLangDropdown;
    initSingleCustomDropdown(cardLangDropdown, topLanguageOptions, formatLanguageLabel, false);
  }

  if (cardRegionDropdown && !customDropdownState.cardRegionDropdown) {
    customDropdownState.cardRegionDropdown = cardRegionDropdown;
    initSingleCustomDropdown(cardRegionDropdown, topRegionOptions, formatRegionLabel, true);
  }
}

function syncCustomDropdownValue(dropdown, value, withFlag = false) {
  const menu = dropdown.querySelector(".custom-dropdown-menu");
  const trigger = dropdown.querySelector(".custom-dropdown-trigger");
  const valueEl = trigger?.querySelector(".custom-dropdown-value");

  if (menu) {
    const options = menu.querySelectorAll(".custom-dropdown-option");
    for (const opt of options) {
      opt.classList.toggle("is-selected", opt.dataset.value === value);
    }
  }

  if (valueEl) {
    if (withFlag) {
      valueEl.innerHTML = buildFlagTriggerHtml(value, formatRegionLabel(value));
    } else {
      valueEl.textContent = formatLanguageLabel(value);
    }
  }
}

function populateSettingsPopupOptions() {
  initCustomDropdowns();

  if (elements.settingsPopupLanguage && !elements.settingsPopupLanguage.options.length) {
    const sortedLangs = [...topLanguageOptions].sort((a, b) => {
      return formatLanguageLabel(a).localeCompare(formatLanguageLabel(b));
    });
    populateSelectOptions(elements.settingsPopupLanguage, sortedLangs, formatLanguageLabel);
  }

  if (elements.settingsPopupRegion && !elements.settingsPopupRegion.options.length) {
    const sortedRegions = [...topRegionOptions].sort((a, b) => {
      return formatRegionLabel(a).localeCompare(formatRegionLabel(b));
    });
    populateSelectOptions(elements.settingsPopupRegion, sortedRegions, formatRegionLabelWithFlag);
  }
}

function setSettingsPopupThemeActive(themeValue) {
  const buttons = [
    elements.settingsPopupThemeSystem,
    elements.settingsPopupThemeLight,
    elements.settingsPopupThemeDark,
  ];
  for (const btn of buttons) {
    if (!btn) continue;
    btn.classList.toggle("is-active", btn.dataset.themeValue === themeValue);
  }
}

function applySettingsPopupUi() {
  const settings = loadSettings();
  if (elements.settingsPopupLanguage) {
    elements.settingsPopupLanguage.value = settings.displayLanguage;
  }
  if (elements.settingsPopupRegion) {
    elements.settingsPopupRegion.value = settings.region;
  }

  if (customDropdownState.languageDropdown) {
    syncCustomDropdownValue(customDropdownState.languageDropdown, settings.displayLanguage, false);
  }
  if (customDropdownState.regionDropdown) {
    syncCustomDropdownValue(customDropdownState.regionDropdown, settings.region, true);
  }

  setSettingsPopupThemeActive(settings.theme || "system");
  if (elements.settingsPopupSafeSearch) {
    elements.settingsPopupSafeSearch.checked = settings.safeSearch !== "off";
  }
}

function openSettingsPopup() {
  const modal = elements.settingsModal || document.getElementById("settingsModal");
  if (!modal) return;
  populateSettingsPopupOptions();
  applySettingsPopupUi();
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  // Force visibility even if some CSS/JS interferes.
  modal.style.display = "grid";
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";
}

function requestOpenSettings() {
  // Always route to the Profile card Settings UI (works signed-in and signed-out).
  closeSettingsPopup();
  openProfilePanel("settings");
}

function closeSettingsPopup() {
  const modal = elements.settingsModal || document.getElementById("settingsModal");
  if (modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "";
    modal.style.opacity = "";
    modal.style.pointerEvents = "";
  }
  closeAllCustomDropdowns();
}

function saveSettingsPopup() {
  const currentSettings = loadSettings();
  const newSettings = {
    ...currentSettings,
    displayLanguage: elements.settingsPopupLanguage?.value || currentSettings.displayLanguage,
    region: elements.settingsPopupRegion?.value || currentSettings.region,
    theme: document.querySelector(".settings-popup-theme-btn.is-active")?.dataset?.themeValue || "system",
    safeSearch: elements.settingsPopupSafeSearch?.checked ? "moderate" : "off",
  };
  saveSettings(newSettings);
  applyTheme(newSettings.theme);
  closeSettingsPopup();
}

function getLanguageCodeForTranslation(displayLanguage) {
  return String(displayLanguage || "en").split("-")[0].toLowerCase();
}

function collectTranslatableTargets() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const parentElement = currentNode.parentElement;
    const currentText = currentNode.nodeValue || "";

    if (
      parentElement
      && currentText.trim()
      && !parentElement.closest("script, style, noscript, code, pre, svg")
      && !parentElement.classList.contains("brand")
      && !parentElement.classList.contains("top-brand")
      && !["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(parentElement.tagName)
      && !textNodeOriginalMap.has(currentNode)
    ) {
      textNodeOriginalMap.set(currentNode, currentText);
      translatableTextNodes.push(currentNode);
    }

    currentNode = walker.nextNode();
  }

  for (const element of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
    if (!attrOriginalMap.has(element)) {
      attrOriginalMap.set(element, {
        placeholder: element.getAttribute("placeholder"),
        ariaLabel: element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
      });
      translatableAttrTargets.push(element);
    }
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
    if (!originalAttrs) {
      return;
    }

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

async function translateBatch(texts, targetLanguage, sourceLanguage = "auto") {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texts,
      target_language: targetLanguage,
      source_language: sourceLanguage,
    }),
  });

  if (!response.ok) {
    throw new Error(`Translate request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.translations) ? payload.translations : texts;
}

async function translateTextsWithCache(texts, targetLanguage, sourceLanguage = "auto") {
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
      translationCache.set(cacheKey, translatedText);
      const originalIndex = uncachedIndices[start + batchIndex];
      output[originalIndex] = translatedText;
    });
  }

  return output;
}

async function applyPageLanguage(displayLanguage) {
  const applyToken = ++state.languageApplyToken;
  const targetLanguage = getLanguageCodeForTranslation(displayLanguage);

  collectTranslatableTargets();

  if (targetLanguage === "en") {
    restoreOriginalLanguage();
    return;
  }

  const textNodesPayload = translatableTextNodes
    .map((node) => ({
      node,
      source: textNodeOriginalMap.get(node),
    }))
    .filter((item) => typeof item.source === "string" && item.source.trim());

  const attrPayload = [];
  for (const element of translatableAttrTargets) {
    const originalAttrs = attrOriginalMap.get(element);
    if (!originalAttrs) {
      continue;
    }

    const attrPairs = [
      ["placeholder", originalAttrs.placeholder],
      ["aria-label", originalAttrs.ariaLabel],
      ["title", originalAttrs.title],
    ];

    for (const [attrName, attrValue] of attrPairs) {
      if (typeof attrValue === "string" && attrValue.trim()) {
        attrPayload.push({
          element,
          attrName,
          source: attrValue,
        });
      }
    }
  }

  const combinedSources = [
    ...textNodesPayload.map((item) => item.source),
    ...attrPayload.map((item) => item.source),
  ];

  if (!combinedSources.length) {
    return;
  }

  try {
    const translatedValues = await translateTextsWithCache(combinedSources, targetLanguage, "auto");

    if (applyToken !== state.languageApplyToken) {
      return;
    }

    for (const [index, item] of textNodesPayload.entries()) {
      item.node.nodeValue = translatedValues[index] || item.source;
    }

    for (const [attrIndex, item] of attrPayload.entries()) {
      const translatedIndex = textNodesPayload.length + attrIndex;
      item.element.setAttribute(item.attrName, translatedValues[translatedIndex] || item.source);
    }
  } catch {
    restoreOriginalLanguage();
  }
}

async function translateQueryForSearch(query, displayLanguage) {
  const sourceLanguage = getLanguageCodeForTranslation(displayLanguage);

  if (!query.trim() || sourceLanguage === "en") {
    return query;
  }

  try {
    const translated = await translateTextsWithCache([query], "en", sourceLanguage);
    return translated[0] || query;
  } catch {
    return query;
  }
}

// ---------------------------------------------------------------------------
// Session / avatar helpers
// ---------------------------------------------------------------------------

function getInitials(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function getKnownAccounts() {
  try {
    const raw = localStorage.getItem(knownAccountsKey);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveKnownAccount(user) {
  if (!user || !user.email) return;
  const accounts = getKnownAccounts();
  const idx = accounts.findIndex((a) => a.email?.toLowerCase() === user.email.toLowerCase());
  const entry = {
    provider: user.provider || "google",
    id: user.id || "",
    name: user.name || "",
    email: user.email || "",
    picture: user.picture || "",
  };
  if (idx >= 0) { accounts[idx] = entry; } else { accounts.push(entry); }
  const capped = accounts.slice(0, 3);
  localStorage.setItem(knownAccountsKey, JSON.stringify(capped));
}

function removeKnownAccount(user) {
  if (!user?.email) {
    return [];
  }

  const nextAccounts = getKnownAccounts().filter(
    (account) => account.email?.toLowerCase() !== user.email.toLowerCase(),
  );
  localStorage.setItem(knownAccountsKey, JSON.stringify(nextAccounts));
  return nextAccounts;
}

function getFallbackAccount(accounts, excludedEmail = "") {
  const excluded = String(excludedEmail || "").trim().toLowerCase();
  return accounts.find((account) => account.email?.toLowerCase() !== excluded) || null;
}

function renderAccountsList() {
  if (!elements.accountsList) return;
  const accounts = getKnownAccounts();
  const currentEmail = state.profileUser?.email?.toLowerCase() || "";
  if (accounts.length <= 1) {
    elements.accountsList.innerHTML = "";
    return;
  }
  let html = "";
  for (const acct of accounts) {
    const isCurrent = acct.email?.toLowerCase() === currentEmail;
    const initials = getInitials(acct.name);
    const avatarHtml = acct.picture
      ? `<img class="account-item-avatar" src="${escapeAttribute(acct.picture)}" alt="" />`
      : `<span class="account-item-fallback">${initials}</span>`;
    const checkHtml = isCurrent
      ? '<svg class="account-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : "";
    const removeHtml = !isCurrent
      ? `<button class="account-item-remove" type="button" title="Remove account" data-remove-email="${escapeAttribute(acct.email || "")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
      : "";
    const escapedEmail = escapeHtml(acct.email || "");
    const escapedName = escapeHtml(acct.name || "");
    const emailAttribute = escapeAttribute(acct.email || "");
    html += `<div class="account-item" data-switch-email="${emailAttribute}">
      ${avatarHtml}
      <div class="account-item-info">
        <span class="account-item-name">${escapedName}</span>
        <span class="account-item-email">${escapedEmail}</span>
      </div>
      ${checkHtml}${removeHtml}
    </div>`;
  }
  elements.accountsList.innerHTML = html;

  for (const item of elements.accountsList.querySelectorAll("[data-switch-email]")) {
    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove-email]")) return;
      const email = item.getAttribute("data-switch-email");
      if (email?.toLowerCase() !== currentEmail) {
        switchToAccount(email);
      }
    });
  }

  for (const btn of elements.accountsList.querySelectorAll("[data-remove-email]")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const email = btn.getAttribute("data-remove-email");
      removeKnownAccount({ email });
      renderAccountsList();
    });
  }
}

function getStoredProfilePrefs() {
  return readJsonStorage(profilePrefsKey, {
    profiles: {},
  });
}

function getProfilePrefsForUser(user) {
  const store = getStoredProfilePrefs();
  const key = getUserProfileStorageKey(user);
  const profile = store.profiles?.[key] || {};

  return {
    avatarDataUrl: typeof profile.avatarDataUrl === "string" ? profile.avatarDataUrl : "",
    displayName: typeof profile.displayName === "string" ? profile.displayName : "",
    handle: typeof profile.handle === "string" ? profile.handle : "",
    weatherLocation: profile.weatherLocation && typeof profile.weatherLocation === "object"
      ? profile.weatherLocation
      : null,
  };
}

function setProfilePrefsForUser(user, prefs) {
  const store = getStoredProfilePrefs();
  const key = getUserProfileStorageKey(user);
  const profiles = { ...(store.profiles || {}) };

  profiles[key] = {
    avatarDataUrl: String(prefs.avatarDataUrl || "").trim(),
    displayName: String(prefs.displayName || "").trim(),
    handle: String(prefs.handle || "").trim(),
    weatherLocation: prefs.weatherLocation && typeof prefs.weatherLocation === "object"
      ? prefs.weatherLocation
      : null,
  };

  writeJsonStorage(profilePrefsKey, { profiles });
}

function getStoredSettings() {
  return readJsonStorage(settingsPrefsKey, {
    displayLanguage: "en-US",
    region: "IN",
    theme: "system",
    safeSearch: "moderate",
  });
}

function getSettingsFromUi() {
  return {
    displayLanguage: elements.settingDisplayLanguage.value,
    region: elements.settingRegion.value,
    theme: elements.settingTheme.value,
    safeSearch: elements.settingSafeSearch.value,
  };
}

function setActiveThemeButton(themeValue) {
  const buttons = [
    elements.settingThemeSystemBtn,
    elements.settingThemeLightBtn,
    elements.settingThemeDarkBtn,
  ].filter(Boolean);
  for (const btn of buttons) {
    const isActive = btn.getAttribute("data-theme-value") === themeValue;
    btn.classList.toggle("is-active", isActive);
  }
}

function getResolvedTheme(themePreference) {
  if (themePreference === "dark") {
    return "dark";
  }

  if (themePreference === "light") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemePreview(themePreference) {
  document.body.dataset.themePreference = themePreference;
  document.body.dataset.theme = getResolvedTheme(themePreference);
}

function getResolvedUser(user) {
  const prefs = getProfilePrefsForUser(user);
  const providerHandle = user.provider === "twitter"
    ? (user.username ? `@${String(user.username).replace(/^@+/, "")}` : "")
    : (user.email || user.username || "");
  const fallbackName = user.name || user.username || (user.email ? user.email.split("@")[0] : "") || "User";
  const providerPicture = user.providerPicture || user.picture || "";

  return {
    ...user,
    name: prefs.displayName || fallbackName,
    handle: prefs.handle || providerHandle,
    // Prefer local uploaded photo; otherwise fall back to the provider (Google) URL.
    picture: prefs.avatarDataUrl || providerPicture || "",
  };
}

function syncWeatherLocationForCurrentUser() {
  const storedLocation = state.profileUser
    ? getProfilePrefsForUser(state.profileUser).weatherLocation
    : null;

  if (storedLocation && typeof storedLocation === "object") {
    stopLocationWatch();
    state.manualWeatherLocation = storedLocation;
    populateWeatherLocationForm(storedLocation);
    state.weatherFetchedForCoords = null;
    state.lastWeatherCoords = null;
    elements.locationText.textContent = `${storedLocation.label} (Custom)`;
    setLocationMeta("Using your custom weather location.", false);
    void fetchWeather(storedLocation.latitude, storedLocation.longitude);
    return;
  }

  state.manualWeatherLocation = null;
  populateWeatherLocationForm(null);
  state.weatherFetchedForCoords = null;
  state.lastWeatherCoords = null;
  void updateUserLocation();
}

function getTimeBasedGreeting() {
  const hour = new Date().getHours();

  const morning = ["Good morning", "Hello", "Hi"];
  const afternoon = ["Good afternoon", "Hello", "Hi"];
  const evening = ["Good evening", "Hello", "Hi"];

  // 05:00-11:59 morning, 12:00-16:59 afternoon, 17:00+ evening
  if (hour >= 5 && hour < 12) return morning[Math.floor(Math.random() * morning.length)];
  if (hour >= 12 && hour < 17) return afternoon[Math.floor(Math.random() * afternoon.length)];
  return evening[Math.floor(Math.random() * evening.length)];
}

function applyUserSummary(user) {
  const resolvedUser = getResolvedUser(user);
  const fallback = getInitials(resolvedUser.name);
  const prefs = user ? getProfilePrefsForUser(user) : { avatarDataUrl: "" };
  const hasCustomAvatar = Boolean(prefs.avatarDataUrl);

  if (elements.profileGreeting) {
    const greeting = getTimeBasedGreeting();
    elements.profileGreeting.textContent = `${greeting}, ${resolvedUser.name}!`;
    elements.profileGreeting.hidden = false;
  }
  elements.profileSummaryEmail.textContent = resolvedUser.handle || "No email or username available";
  elements.profileSummaryProvider.textContent = resolvedUser.provider
    ? `Signed in with ${resolvedUser.provider}`
    : "Signed in";

  if (resolvedUser.picture) {
    elements.profileSummaryAvatar.onerror = () => {
      elements.profileSummaryAvatar.hidden = true;
      elements.profileSummaryFallback.hidden = false;
      elements.profileSummaryFallback.textContent = fallback;
    };
    elements.profileSummaryAvatar.src = resolvedUser.picture;
    elements.profileSummaryAvatar.alt = `${resolvedUser.name} avatar`;
    elements.profileSummaryAvatar.hidden = false;
    elements.profileSummaryFallback.hidden = true;
  } else {
    elements.profileSummaryAvatar.onerror = null;
    elements.profileSummaryAvatar.hidden = true;
    elements.profileSummaryFallback.hidden = false;
    elements.profileSummaryFallback.textContent = fallback;
  }

  if (elements.profilePhotoMenuRemoveBtn) {
    elements.profilePhotoMenuRemoveBtn.hidden = !hasCustomAvatar;
  }

  elements.profileNameInput.value = resolvedUser.name;
  elements.profileHandleInput.value = resolvedUser.handle || "";
}

async function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

async function handleProfileAvatarSelection(file) {
  if (!state.profileUser || !file || !file.type.startsWith("image/")) {
    return;
  }

  const avatarDataUrl = await readImageAsDataUrl(file);
  const existingPrefs = getProfilePrefsForUser(state.profileUser);
  setProfilePrefsForUser(state.profileUser, {
    avatarDataUrl,
    displayName: existingPrefs.displayName || elements.profileNameInput.value.trim(),
    handle: existingPrefs.handle || elements.profileHandleInput.value.trim(),
  });
  showLoggedInUI(state.profileUser);
}

function clearCustomProfileAvatar() {
  if (!state.profileUser) {
    return;
  }
  const existingPrefs = getProfilePrefsForUser(state.profileUser);
  setProfilePrefsForUser(state.profileUser, {
    avatarDataUrl: "",
    displayName: existingPrefs.displayName || elements.profileNameInput.value.trim(),
    handle: existingPrefs.handle || elements.profileHandleInput.value.trim(),
    weatherLocation: existingPrefs.weatherLocation,
  });
  showLoggedInUI(state.profileUser);
}

function setProfilePhotoMenuOpen(isOpen) {
  if (!elements.profilePhotoMenu) {
    return;
  }
  elements.profilePhotoMenu.hidden = !isOpen;
  if (!isOpen) {
    return;
  }
  const prefs = state.profileUser ? getProfilePrefsForUser(state.profileUser) : { avatarDataUrl: "" };
  const hasCustomAvatar = Boolean(prefs.avatarDataUrl);
  if (elements.profilePhotoMenuRemoveBtn) {
    elements.profilePhotoMenuRemoveBtn.hidden = !hasCustomAvatar;
  }
}

function applySettingsUi() {
  const settings = getStoredSettings();

  populateSettingsOptions();
  initCustomDropdowns();

  elements.settingDisplayLanguage.value = settings.displayLanguage;
  elements.settingRegion.value = settings.region;
  elements.settingTheme.value = settings.theme;
  elements.settingSafeSearch.value = settings.safeSearch;

  if (customDropdownState.cardLanguageDropdown) {
    syncCustomDropdownValue(customDropdownState.cardLanguageDropdown, settings.displayLanguage, false);
  }
  if (customDropdownState.cardRegionDropdown) {
    syncCustomDropdownValue(customDropdownState.cardRegionDropdown, settings.region, true);
  }

  if (elements.settingSafeSearchToggle) {
    elements.settingSafeSearchToggle.checked = settings.safeSearch !== "off";
  }
  setActiveThemeButton(settings.theme);

  document.documentElement.lang = settings.displayLanguage;
  document.body.dataset.region = settings.region;
  document.body.dataset.safeSearch = settings.safeSearch;
  applyThemePreview(settings.theme);

  void applyPageLanguage(settings.displayLanguage);
}

function setProfileSection(sectionName) {
  const isOverview = sectionName === "overview";
  const isSettings = sectionName === "settings";
  const isAdmin = sectionName === "admin";

  elements.profileOverviewSection.hidden = !isOverview;
  elements.settingsForm.hidden = !isSettings;
  if (elements.adminActivitySection) {
    elements.adminActivitySection.hidden = !isAdmin;
  }

  if (isOverview) {
    elements.profilePanelTitle.textContent = "Your profile";
    elements.profilePanelDescription.textContent = "";
  }

  if (isSettings) {
    elements.profilePanelTitle.textContent = "Settings";
    elements.profilePanelDescription.textContent = "";
  }

  if (isAdmin) {
    elements.profilePanelTitle.textContent = "Admin activity";
    elements.profilePanelDescription.textContent = "Track signed-up users, their search queries, and visited result websites.";
  }

  void applyPageLanguage(getStoredSettings().displayLanguage);
}


function persistSettingsFromUi() {
  translationCache.clear();
  const newSettings = getSettingsFromUi();
  writeJsonStorage(settingsPrefsKey, newSettings);

  applySettingsUi();
  syncHistoryUiState();
  void applyPageLanguage(newSettings.displayLanguage);
  void loadTrendingTopics();

  if (state.profileUser?.authenticated) {
    void persistSettingsToBackend(newSettings);
  }
}

async function persistSettingsToBackend(settingsDoc) {
  try {
    await fetch("/api/settings/me", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayLanguage: settingsDoc.displayLanguage,
        region: settingsDoc.region,
        theme: settingsDoc.theme,
        safeSearch: settingsDoc.safeSearch,
        utility_timezones: getUtilityTzPrefs() || undefined,
        utility_unit_mode: localStorage.getItem("utility_unit_mode") || undefined,
      }),
    });
  } catch {
    // Backend persistence is best-effort.
  }
}

async function hydrateSettingsFromBackend() {
  if (!state.profileUser?.authenticated) return;
  try {
    const resp = await fetch("/api/settings/me", { credentials: "same-origin" });
    if (!resp.ok) return;
    const payload = await resp.json();
    const s = payload?.settings || {};
    const merged = {
      ...getStoredSettings(),
      ...(typeof s.displayLanguage === "string" ? { displayLanguage: s.displayLanguage } : {}),
      ...(typeof s.region === "string" ? { region: s.region } : {}),
      ...(typeof s.theme === "string" ? { theme: s.theme } : {}),
      ...(typeof s.safeSearch === "string" ? { safeSearch: s.safeSearch } : {}),
    };
    writeJsonStorage(settingsPrefsKey, merged);
    if (s.utility_timezones && typeof s.utility_timezones === "object") {
      localStorage.setItem("utility_timezones", JSON.stringify(s.utility_timezones));
    }
    if (typeof s.utility_unit_mode === "string") {
      localStorage.setItem("utility_unit_mode", s.utility_unit_mode);
    }
    applySettingsUi();
  } catch {
    // ignore
  }
}

function openProfilePanel(sectionName = "overview") {
  // Allow opening Settings even when signed out.
  if (state.profileUser) {
    applyUserSummary(state.profileUser);
  }
  applySettingsUi();
  setProfileSection(sectionName);
  if (sectionName === "admin") {
    void loadAdminActivity();
  }
  elements.profileModal.classList.add("is-open");
  elements.profileModal.setAttribute("aria-hidden", "false");
}

function closeProfilePanel() {
  elements.profileModal.classList.remove("is-open");
  elements.profileModal.setAttribute("aria-hidden", "true");
  applySettingsUi();
}

function showLoggedInUI(user) {
  const resolvedUser = getResolvedUser(user);
  const providerPicture = user.providerPicture || user.picture || "";

  state.profileUser = {
    ...user,
    name: resolvedUser.name,
    handle: resolvedUser.handle,
    // Keep provider picture separate so removing custom avatar restores it.
    providerPicture,
    // Keep `picture` as the provider picture; UI uses `resolvedUser.picture`.
    picture: providerPicture,
  };

  document.querySelector(".auth-actions").hidden = true;
  elements.userProfile.hidden = false;

  if (state.pendingOpenSettings) {
    state.pendingOpenSettings = false;
  }

  if (resolvedUser.picture) {
    elements.avatarImage.onerror = () => {
      elements.avatarImage.hidden = true;
      elements.avatarFallback.hidden = false;
      elements.avatarFallback.textContent = getInitials(resolvedUser.name);
    };
    elements.avatarImage.src = resolvedUser.picture;
    elements.avatarImage.alt = resolvedUser.name || "User avatar";
    elements.avatarImage.hidden = false;
    elements.avatarFallback.hidden = true;
  } else {
    elements.avatarImage.onerror = null;
    elements.avatarImage.hidden = true;
    elements.avatarFallback.hidden = false;
    elements.avatarFallback.textContent = getInitials(resolvedUser.name);
  }

  elements.profileName.textContent = resolvedUser.name || "User";
  elements.profileEmail.textContent = resolvedUser.handle || resolvedUser.provider || "";
  if (elements.menuAdminDashboard) {
    elements.menuAdminDashboard.hidden = !state.profileUser?.is_admin;
  }
  applyUserSummary(state.profileUser);
  applySettingsUi();
  saveKnownAccount(state.profileUser);
  renderAccountsList();
  if (elements.addAccountButton) {
    elements.addAccountButton.style.display = getKnownAccounts().length >= 3 ? "none" : "";
  }
  syncWeatherLocationForCurrentUser();
}

function showLoggedOutUI() {
  document.querySelector(".auth-actions").hidden = false;
  elements.userProfile.hidden = true;
  elements.profileDropdown.hidden = true;
  elements.avatarButton.setAttribute("aria-expanded", "false");
  state.profileUser = null;
  state.manualWeatherLocation = null;
  state.adminActivityRows = [];
  if (elements.menuAdminDashboard) {
    elements.menuAdminDashboard.hidden = true;
  }
  // Do not persist history for signed-out sessions.
  try {
    localStorage.removeItem(getUserHistoryKey());
  } catch {}
  closeDropdown();
  syncHistoryUiState();
  closeProfilePanel();
  populateWeatherLocationForm(null);
}

function syncHistoryUiState() {
  const saving = isHistorySavingEnabled();
  if (elements.historyStatusLabel) {
    elements.historyStatusLabel.textContent = saving ? "Saving" : "Not saving";
  }
  if (elements.historySavingToggle) {
    elements.historySavingToggle.checked = saving;
  }
  const toggleLabel = document.querySelector(".history-toggle-label");
  if (toggleLabel) {
    toggleLabel.textContent = saving ? "Saving" : "Paused";
  }
  const settings = getStoredSettings();
  if (elements.safeSearchStatusLabel) {
    const theme = String(settings.theme || "system");
    const labels = { system: "System", light: "Light", dark: "Dark" };
    elements.safeSearchStatusLabel.textContent = labels[theme] || "System";
  }
  if (elements.languageStatusLabel) {
    const langTag = settings.displayLanguage || "en-US";
    try {
      const dn = new Intl.DisplayNames([langTag], { type: "language" });
      elements.languageStatusLabel.textContent = dn.of(langTag) || langTag;
    } catch {
      elements.languageStatusLabel.textContent = langTag;
    }
  }
}

function formatHistoryDate(ts) {
  if (!ts) return "Older";
  const locale = getStoredSettings().displayLanguage || undefined;
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const formattedDate = d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (isToday) return `${rtf.format(0, "day")} - ${formattedDate}`;
    if (isYesterday) return `${rtf.format(-1, "day")} - ${formattedDate}`;
  } catch {
    if (isToday) return `Today - ${formattedDate}`;
    if (isYesterday) return `Yesterday - ${formattedDate}`;
  }

  return formattedDate;
}

function formatHistoryTime(ts) {
  if (!ts) return "";
  const locale = getStoredSettings().displayLanguage || undefined;
  return new Date(ts).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function renderHistoryList() {
  const entries = readHistoryEntries();
  if (!entries.length) {
    elements.historyList.innerHTML = '<div class="history-empty">No search history yet.</div>';
    void applyPageLanguage(getStoredSettings().displayLanguage);
    return;
  }

  const grouped = new Map();
  for (const entry of entries) {
    const key = formatHistoryDate(entry.timestamp);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }

  let html = "";
  for (const [dateLabel, items] of grouped) {
    html += `<div class="history-date-group"><h3 class="history-date-heading">${dateLabel}</h3>`;
    for (const item of items) {
      const time = formatHistoryTime(item.timestamp);
      const escapedQuery = item.query.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const entryId = (item.id || "").replace(/"/g, "&quot;");
      html += `<div class="history-entry" data-history-query="${escapedQuery}">
        <span class="history-entry-time">${time}</span>
        <img class="history-entry-favicon" src="https://www.google.com/s2/favicons?sz=32&domain=quairsearch.com" alt="" />
        <div class="history-entry-body">
          <span class="history-entry-query">${escapedQuery}</span>
          <span class="history-entry-source">QuAir Search</span>
        </div>
        <button class="history-entry-delete" type="button" title="Delete from history" data-entry-id="${entryId}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>`;
    }
    html += "</div>";
  }
  elements.historyList.innerHTML = html;

  for (const btn of elements.historyList.querySelectorAll("[data-entry-id]")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeHistoryEntry(btn.getAttribute("data-entry-id"));
      renderHistoryList();
    });
  }

  for (const row of elements.historyList.querySelectorAll(".history-entry[data-history-query]")) {
    row.addEventListener("click", () => {
      const q = row.getAttribute("data-history-query") || "";
      if (!q) return;
      closeHistoryModal();
      elements.queryInput.value = q;
      void executeSearch(q, "");
    });
  }

  void applyPageLanguage(getStoredSettings().displayLanguage);
}

function openHistoryModal() {
  closeBookmarksModal();
  syncHistoryUiState();
  renderHistoryList();
  elements.historyModal.classList.add("is-open");
  elements.historyModal.setAttribute("aria-hidden", "false");
}

function closeHistoryModal() {
  elements.historyModal.classList.remove("is-open");
  elements.historyModal.setAttribute("aria-hidden", "true");
}

function toggleProfileDropdown() {
  const isOpen = !elements.profileDropdown.hidden;
  elements.profileDropdown.hidden = isOpen;
  elements.avatarButton.setAttribute("aria-expanded", String(!isOpen));
  if (!isOpen) {
    scrubIncognitoUi();
    syncHistoryUiState();
    renderAccountsList();
  }
}

async function checkSession() {
  try {
    const resp = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!resp.ok) { showLoggedOutUI(); return; }
    const user = await resp.json();
    if (user.authenticated) { showLoggedInUI(user); } else { showLoggedOutUI(); }
    if (user.authenticated) { void hydrateSettingsFromBackend(); }
  } catch { showLoggedOutUI(); }
}

async function handleLogout() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch {}
  const signedOutUser = state.profileUser;
  const remainingAccounts = removeKnownAccount(signedOutUser);
  showLoggedOutUI();
  renderAccountsList();

  // If there's another known account, switch to it instantly.
  const fallbackAccount = getFallbackAccount(remainingAccounts, signedOutUser?.email);
  if (fallbackAccount?.email) {
    switchToAccount(fallbackAccount.email);
  }
}

function bindEvents() {
  elements.topBrandButton.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.reload();
  });

  // Weather refresh button
  if (elements.weatherRefreshBtn) {
    const doWeatherRefresh = () => {
      state.weatherFetchedForCoords = null; // force re-fetch
      state.lastWeatherCoords = null;
      void updateUserLocation();
    };
    elements.weatherRefreshBtn.addEventListener("click", doWeatherRefresh);
    elements.weatherRefreshBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doWeatherRefresh(); }
    });
  }

  if (elements.weatherLocationToggle) {
    elements.weatherLocationToggle.addEventListener("click", () => {
      const isOpen = elements.weatherLocationControls ? !elements.weatherLocationControls.hidden : false;
      setWeatherLocationControlsOpen(!isOpen);
    });
  }

  if (elements.weatherLocationCloseBtn) {
    elements.weatherLocationCloseBtn.addEventListener("click", () => {
      setWeatherLocationControlsOpen(false);
    });
  }

  if (elements.weatherLocationForm) {
    elements.weatherLocationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void applyManualWeatherLocation(readWeatherLocationForm());
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (state.manualWeatherLocation) {
      return;
    }
    if (state.locationWatchId === null && state.locationPermissionStatus?.state !== "denied") {
      void updateUserLocation();
    }
  });

  window.addEventListener("pagehide", stopLocationWatch);

  for (const button of document.querySelectorAll("[data-auth-trigger]")) {
    button.addEventListener("click", () => {
      openAuthModal();
    });
  }

  elements.authCloseButton.addEventListener("click", closeAuthModal);
  elements.authBackdrop.addEventListener("click", closeAuthModal);
  elements.imagePreviewCloseButton.addEventListener("click", closeImagePreview);
  elements.imagePreviewBackdrop.addEventListener("click", closeImagePreview);

  elements.authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = elements.authEmailInput.value.trim();
    const knownAccount = getKnownAccounts().find(
      (account) => account.email?.toLowerCase() === email.toLowerCase(),
    );

    if (email && knownAccount) {
      closeAuthModal();
      switchToAccount(email);
      return;
    }

    openGoogleAuthPopup(email);
  });

  for (const button of document.querySelectorAll("[data-provider]")) {
    button.addEventListener("click", () => {
      const provider = button.getAttribute("data-provider");
      if (provider === "Google") {
        const email = elements.authEmailInput.value.trim();
        const knownAccount = getKnownAccounts().find(
          (account) => account.email?.toLowerCase() === email.toLowerCase(),
        );
        if (email && knownAccount) {
          closeAuthModal();
          switchToAccount(email);
          return;
        }
        openGoogleAuthPopup(email);
      }
    });
  }

  elements.avatarButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileDropdown();
  });

  elements.logoutButton.addEventListener("click", () => {
    toggleProfileDropdown();
    void handleLogout();
  });

  for (const button of document.querySelectorAll("[data-profile-panel]")) {
    button.addEventListener("click", () => {
      elements.profileDropdown.hidden = true;
      elements.avatarButton.setAttribute("aria-expanded", "false");
      const panel = button.getAttribute("data-profile-panel") || "overview";
      if (panel === "settings") {
        requestOpenSettings();
        return;
      }
      openProfilePanel(panel);
    });
  }

  elements.profileCloseButton.addEventListener("click", closeProfilePanel);
  elements.profileBackdrop.addEventListener("click", closeProfilePanel);

  elements.menuSearchHistory.addEventListener("click", () => {
    elements.profileDropdown.hidden = true;
    elements.avatarButton.setAttribute("aria-expanded", "false");
    openHistoryModal();
  });

  elements.menuSafeSearch.addEventListener("click", () => {
    elements.profileDropdown.hidden = true;
    elements.avatarButton.setAttribute("aria-expanded", "false");
    openProfilePanel("settings");
  });

  elements.menuLanguage.addEventListener("click", () => {
    elements.profileDropdown.hidden = true;
    elements.avatarButton.setAttribute("aria-expanded", "false");
    openProfilePanel("settings");
  });

  const headerSettingsButton = elements.headerSettingsBtn || document.getElementById("headerSettingsBtn");
  if (headerSettingsButton) {
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      requestOpenSettings();
    };
    headerSettingsButton.addEventListener("click", handler, { capture: true });
    headerSettingsButton.addEventListener("pointerup", handler, { capture: true });
  }

  const settingsCloseButton = elements.settingsCloseBtn || document.getElementById("settingsCloseBtn");
  if (settingsCloseButton) {
    settingsCloseButton.addEventListener("click", closeSettingsPopup);
  }

  const settingsBackdropEl = elements.settingsBackdrop || document.getElementById("settingsBackdrop");
  if (settingsBackdropEl) {
    settingsBackdropEl.addEventListener("click", closeSettingsPopup);
  }

  if (elements.settingsPopupForm) {
    elements.settingsPopupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveSettingsPopup();
    });
  }

  const settingsThemeButtons = [
    elements.settingsPopupThemeSystem,
    elements.settingsPopupThemeLight,
    elements.settingsPopupThemeDark,
  ];
  for (const btn of settingsThemeButtons) {
    if (!btn) continue;
    btn.addEventListener("click", () => {
      setSettingsPopupThemeActive(btn.dataset.themeValue);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elements.settingsModal?.classList.contains("is-open")) {
      closeSettingsPopup();
    }
  });

  if (elements.menuAdminDashboard) {
    elements.menuAdminDashboard.addEventListener("click", () => {
      elements.profileDropdown.hidden = true;
      elements.avatarButton.setAttribute("aria-expanded", "false");
      openProfilePanel("admin");
    });
  }

  elements.historyCloseButton.addEventListener("click", closeHistoryModal);
  elements.historyBackdrop.addEventListener("click", closeHistoryModal);

  elements.historySavingToggle.addEventListener("change", () => {
    setHistorySaving(elements.historySavingToggle.checked);
  });

  elements.historyDeleteAllButton.addEventListener("click", () => {
    clearAllHistory();
    renderHistoryList();
  });

  elements.addAccountButton.addEventListener("click", () => {
    elements.profileDropdown.hidden = true;
    elements.avatarButton.setAttribute("aria-expanded", "false");
    openGoogleAuthPopup();
  });

  elements.profileForm.addEventListener("submit", (event) => {
    event.preventDefault();

    setProfilePrefsForUser(state.profileUser, {
      avatarDataUrl: getProfilePrefsForUser(state.profileUser).avatarDataUrl,
      displayName: elements.profileNameInput.value.trim(),
      handle: elements.profileHandleInput.value.trim(),
    });

    if (state.profileUser) {
      showLoggedInUI(state.profileUser);
      setProfileSection("overview");
      closeProfilePanel();
    }
  });

  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    persistSettingsFromUi();
    closeProfilePanel();
  });

  if (elements.adminActivityRefreshButton) {
    elements.adminActivityRefreshButton.addEventListener("click", () => {
      void loadAdminActivity();
    });
  }

  const profileAvatarWrap = document.querySelector(".profile-summary-avatar-wrap");
  if (profileAvatarWrap && elements.profileAvatarFileInput) {
    profileAvatarWrap.addEventListener("click", () => {
      setProfilePhotoMenuOpen(true);
    });
    elements.profileAvatarFileInput.addEventListener("change", async () => {
      const file = elements.profileAvatarFileInput.files?.[0];
      if (!file) {
        return;
      }
      try {
        await handleProfileAvatarSelection(file);
      } finally {
        elements.profileAvatarFileInput.value = "";
      }
    });
  }

  if (elements.profilePhotoMenuUploadBtn && elements.profileAvatarFileInput) {
    elements.profilePhotoMenuUploadBtn.addEventListener("click", () => {
      setProfilePhotoMenuOpen(false);
      elements.profileAvatarFileInput.click();
    });
  }

  if (elements.profilePhotoMenuRemoveBtn) {
    elements.profilePhotoMenuRemoveBtn.addEventListener("click", () => {
      setProfilePhotoMenuOpen(false);
      clearCustomProfileAvatar();
    });
  }

  if (elements.profilePhotoMenuCancelBtn) {
    elements.profilePhotoMenuCancelBtn.addEventListener("click", () => {
      setProfilePhotoMenuOpen(false);
    });
  }

  if (elements.profilePhotoMenuBackdrop) {
    elements.profilePhotoMenuBackdrop.addEventListener("click", () => {
      setProfilePhotoMenuOpen(false);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setProfilePhotoMenuOpen(false);
    }
  });

  const settingsSelects = [
    elements.settingDisplayLanguage,
    elements.settingRegion,
    elements.settingTheme,
    elements.settingSafeSearch,
  ];

  for (const selectElement of settingsSelects) {
    selectElement.addEventListener("change", () => {
      persistSettingsFromUi();
    });
  }

  elements.settingTheme.addEventListener("change", () => {
    applyThemePreview(elements.settingTheme.value);
  });

  for (const btn of [elements.settingThemeSystemBtn, elements.settingThemeLightBtn, elements.settingThemeDarkBtn]) {
    if (!btn) continue;
    btn.addEventListener("click", () => {
      const nextTheme = btn.getAttribute("data-theme-value") || "system";
      elements.settingTheme.value = nextTheme;
      setActiveThemeButton(nextTheme);
      persistSettingsFromUi();
    });
  }

  if (elements.settingSafeSearchToggle) {
    elements.settingSafeSearchToggle.addEventListener("change", () => {
      const current = elements.settingSafeSearch.value;
      if (elements.settingSafeSearchToggle.checked) {
        elements.settingSafeSearch.value = current === "strict" ? "strict" : "moderate";
      } else {
        elements.settingSafeSearch.value = "off";
      }
      persistSettingsFromUi();
    });
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const settings = getStoredSettings();

    if (settings.theme === "system") {
      applySettingsUi();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".user-profile")) {
      elements.profileDropdown.hidden = true;
      elements.avatarButton.setAttribute("aria-expanded", "false");
    }
  });

  for (const button of elements.searchTabs) {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-search-tab") || "all";
      setActiveSearchTab(tabName);

      if (tabName === "all") {
        void executeSearch(getEffectiveQuery(), state.attachmentContext);
        return;
      }

      openSearchVertical(tabName);
    });
  }

  elements.queryInput.addEventListener("focus", () => {
    // On focus, show day-to-day trending topics (even when signed out).
    void loadTrendingTopics().finally(() => {
      openDropdown(elements.queryInput.value);
    });
  });

  elements.queryInput.addEventListener("input", () => {
    if (elements.clearButton) {
      elements.clearButton.classList.toggle("is-visible", Boolean(elements.queryInput.value.trim()));
    }
    if (elements.queryInput.value.trim()) {
      scheduleSuggestionRefresh(elements.queryInput.value);
      return;
    }

    openDropdown("");
    setSearchStatus(state.lastSubmittedQuery ? `Last search: ${state.lastSubmittedQuery}` : "");
  });

  if (elements.clearButton) {
    elements.clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      elements.queryInput.value = "";
      state.lastSubmittedQuery = "";
      setTabTitleForQuery("");
      setTabFavicon(TAB_FAVICON_DEFAULT);
      closeDropdown();
      clearAnalytics();
      renderResults("");
      setSearchStatus("");
      elements.clearButton.classList.remove("is-visible");
      elements.queryInput.focus();
    });
  }

  elements.queryInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && state.activeItems.length) {
      event.preventDefault();
      state.activeIndex = Math.min(state.activeIndex + 1, state.activeItems.length - 1);
      updateActiveItem();
      return;
    }

    if (event.key === "ArrowUp" && state.activeItems.length) {
      event.preventDefault();
      state.activeIndex = Math.max(state.activeIndex - 1, 0);
      updateActiveItem();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (state.activeIndex >= 0 && state.activeItems[state.activeIndex]) {
        elements.queryInput.value = state.activeItems[state.activeIndex].text;
      }

      void executeSearch(elements.queryInput.value, state.attachmentContext);
    }

    if (event.key === "Escape") {
      closeDropdown();
      closeAuthModal();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-stage")) {
      closeDropdown();
      closeAttachMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
      closeImagePreview();
      closeHistoryModal();
      closeBookmarksModal();
    }

    const tag = document.activeElement?.tagName;
    const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;

    if (!isTyping && event.key === "/" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      elements.queryInput.focus();
    }

    if (!isTyping && event.key === "b" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      openBookmarksModal();
    }

    if (!isTyping && event.key === "h" && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      openHistoryModal();
    }
  });

  elements.voiceButton.addEventListener("click", () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      elements.queryInput.focus();
      return;
    }

    if (state.recognition) {
      state.recognition.stop();
      return;
    }

    state.voicePreviousValue = elements.queryInput.value;
    state.voiceDraft = "";
    elements.queryInput.value = "";


    state.recognition = new SpeechRecognition();
    state.recognition.lang = "en-US";
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.maxAlternatives = 2;
    setVoiceUiState("recording");

    state.recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";

        if (event.results[index].isFinal) {
          state.voiceDraft = `${state.voiceDraft} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      const liveTranscript = `${state.voiceDraft} ${interimTranscript}`.trim();
      elements.queryInput.value = liveTranscript;

    };

    state.recognition.onerror = () => {
      state.recognition = null;
      const transcript = state.voiceDraft.trim();
      elements.queryInput.value = transcript || state.voicePreviousValue;
      clearVoiceDraft();
    };

    state.recognition.onend = () => {
      state.recognition = null;
      const transcript = state.voiceDraft.trim();

      if (transcript) {
        elements.queryInput.value = transcript;

        elements.queryInput.focus();
      } else {
        elements.queryInput.value = state.voicePreviousValue;

      }

      state.voicePreviousValue = "";
      clearVoiceDraft();
    };

    state.recognition.start();
  });

  elements.voiceStopButton.addEventListener("click", () => {
    if (state.recognition) {
      setVoiceUiState("idle");
      state.recognition.stop();
    }
  });

  elements.attachButton.addEventListener("click", (event) => {
    event.stopPropagation();
    elements.attachMenu.classList.toggle("is-open");
  });

  elements.searchButton.addEventListener("click", () => {
    void executeSearch(elements.queryInput.value, state.attachmentContext);
  });

  elements.uploadAttachmentButton.addEventListener("click", () => {
    closeAttachMenu();
    elements.filePicker.click();
  });

  elements.filePicker.addEventListener("change", () => {
    const files = Array.from(elements.filePicker.files || []);
    handlePickedFiles(files);
    elements.filePicker.value = "";
  });

  if (elements.loadMoreButton) {
    elements.loadMoreButton.addEventListener("click", showMoreResults);
  }

  if (elements.menuBookmarks) {
    elements.menuBookmarks.addEventListener("click", () => {
      elements.profileDropdown.hidden = true;
      elements.avatarButton.setAttribute("aria-expanded", "false");
      openBookmarksModal();
    });
  }

  if (elements.bookmarksCloseButton) {
    elements.bookmarksCloseButton.addEventListener("click", closeBookmarksModal);
  }
  if (elements.bookmarksBackdrop) {
    elements.bookmarksBackdrop.addEventListener("click", closeBookmarksModal);
  }

  if (elements.historyExportButton) {
    elements.historyExportButton.addEventListener("click", () => {
      exportHistoryAs("json");
    });
  }

  if (elements.utilitiesToggle) {
    elements.utilitiesToggle.addEventListener("click", () => {
      openUtilitiesModal();
    });
  }

  const utilitiesCloseBtn = document.getElementById("utilitiesCloseButton");
  const utilitiesBackdrop = document.getElementById("utilitiesBackdrop");
  if (utilitiesCloseBtn) utilitiesCloseBtn.addEventListener("click", closeUtilitiesModal);
  if (utilitiesBackdrop) utilitiesBackdrop.addEventListener("click", closeUtilitiesModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeUtilitiesModal();
    }
  });

  if (elements.utilityTimeModeDigitalBtn) {
    elements.utilityTimeModeDigitalBtn.addEventListener("click", () => {
      setUtilityTimeMode("digital");
    });
  }

  if (elements.utilityTimeModeAnalogBtn) {
    elements.utilityTimeModeAnalogBtn.addEventListener("click", () => {
      setUtilityTimeMode("analog");
    });
  }

  // Time zone custom dropdowns (digital + analog share the same stored prefs)
  const tzPrefs = ensureUtilityTimezoneDefaults();

  const applyTzToHiddenSelect = (selectEl, tzValue) => {
    if (!selectEl) return;
    if (!selectEl.options.length) {
      populateUtilityTimezoneSelect(selectEl, tzValue);
    } else {
      selectEl.value = tzValue;
    }
  };

  applyTzToHiddenSelect(elements.utilityTzSelect1, tzPrefs.tz1);
  applyTzToHiddenSelect(elements.utilityTzSelect2, tzPrefs.tz2);
  applyTzToHiddenSelect(elements.utilityTzSelect3, tzPrefs.tz3);
  applyTzToHiddenSelect(elements.utilityTzSelectA1, tzPrefs.tz1);
  applyTzToHiddenSelect(elements.utilityTzSelectA2, tzPrefs.tz2);
  applyTzToHiddenSelect(elements.utilityTzSelectA3, tzPrefs.tz3);

  const setupTzDropdown = (dropdownId, hiddenSelect, mirrorSelects = []) => {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown || dropdown.dataset.tzInitialized === "true") return;

    const menu = dropdown.querySelector(".custom-dropdown-menu");
    const trigger = dropdown.querySelector(".custom-dropdown-trigger");
    const valueEl = trigger?.querySelector(".custom-dropdown-value");

    if (menu) {
      menu.innerHTML = "";
      for (const opt of UTILITY_TIMEZONE_OPTIONS) {
        const li = document.createElement("li");
        li.className = "custom-dropdown-option";
        li.setAttribute("role", "option");
        li.dataset.value = opt.value;
        li.textContent = opt.label;
        li.addEventListener("click", () => {
          if (valueEl) valueEl.textContent = opt.label;
          trigger?.setAttribute("aria-expanded", "false");
          menu.hidden = true;
          for (const o of menu.querySelectorAll(".custom-dropdown-option")) {
            o.classList.toggle("is-selected", o.dataset.value === opt.value);
          }
          if (hiddenSelect) hiddenSelect.value = opt.value;
          for (const sel of mirrorSelects) {
            if (sel) sel.value = opt.value;
            const mirrorId = sel?.id?.replace("TzSelect", "TzDropdown")?.replace("utilityTzSelect", "utilityTzDropdown");
            if (mirrorId) {
              const mirrorDrop = document.getElementById(mirrorId);
              if (mirrorDrop) {
                const mirrorValueEl = mirrorDrop.querySelector(".custom-dropdown-value");
                if (mirrorValueEl) mirrorValueEl.textContent = opt.label;
                for (const mo of (mirrorDrop.querySelector(".custom-dropdown-menu")?.querySelectorAll(".custom-dropdown-option") || [])) {
                  mo.classList.toggle("is-selected", mo.dataset.value === opt.value);
                }
              }
            }
          }
          const next = {
            tz1: elements.utilityTzSelect1?.value || tzPrefs.tz1,
            tz2: elements.utilityTzSelect2?.value || tzPrefs.tz2,
            tz3: elements.utilityTzSelect3?.value || tzPrefs.tz3,
          };
          setUtilityTzPrefs(next);
          updateUtilityTime();
        });
        menu.appendChild(li);
      }
    }

    const currentValue = hiddenSelect?.value;
    const currentLabel = UTILITY_TIMEZONE_OPTIONS.find((o) => o.value === currentValue)?.label || currentValue;
    if (valueEl && currentLabel) valueEl.textContent = currentLabel;
    if (currentValue && menu) {
      for (const o of menu.querySelectorAll(".custom-dropdown-option")) {
        o.classList.toggle("is-selected", o.dataset.value === currentValue);
      }
    }

    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        toggleCustomDropdown(dropdown);
      });
    }

    dropdown.dataset.tzInitialized = "true";
  };

  setupTzDropdown("utilityTzDropdown1", elements.utilityTzSelect1, [elements.utilityTzSelectA1]);
  setupTzDropdown("utilityTzDropdown2", elements.utilityTzSelect2, [elements.utilityTzSelectA2]);
  setupTzDropdown("utilityTzDropdown3", elements.utilityTzSelect3, [elements.utilityTzSelectA3]);
  setupTzDropdown("utilityTzDropdownA1", elements.utilityTzSelectA1, [elements.utilityTzSelect1]);
  setupTzDropdown("utilityTzDropdownA2", elements.utilityTzSelectA2, [elements.utilityTzSelect2]);
  setupTzDropdown("utilityTzDropdownA3", elements.utilityTzSelectA3, [elements.utilityTzSelect3]);

  if (elements.utilityCalculatorForm) {
    elements.utilityCalculatorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const expression = elements.utilityCalculatorInput.value.trim();
      const result = tryCalculator(expression);
      elements.utilityCalculatorOutput.textContent = result
        ? result
        : "Enter a valid math expression like 18 / 3 + 42.";
    });
  }

  if (elements.utilityConverterForm) {
    elements.utilityConverterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = elements.utilityConverterInput.value.trim();
      const result = tryUnitConvert(query);
      elements.utilityConverterOutput.textContent = result
        ? result
        : "Try a supported conversion like 5 km to miles or 72 F to C.";
    });
  }

  // Calculator keypad UI
  const calcExprState = { value: "0" };
  const calcRoot = document.querySelector(".utility-card-calc");
  if (calcRoot) {
    renderCalc(calcExprState.value);
    for (const btn of calcRoot.querySelectorAll("[data-calc-value], [data-calc-action]")) {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-calc-action");
        const value = btn.getAttribute("data-calc-value");
        if (action === "clear") {
          calcExprState.value = "0";
          renderCalc(calcExprState.value);
          return;
        }
        if (action === "back") {
          calcExprState.value = calcExprState.value.length > 1 ? calcExprState.value.slice(0, -1) : "0";
          renderCalc(calcExprState.value);
          return;
        }
        if (action === "equals") {
          const normalized = normalizeCalcExpression(calcExprState.value);
          const result = tryCalculator(normalized);
          if (result) {
            calcExprState.value = result;
          }
          renderCalc(calcExprState.value);
          return;
        }
        if (value) {
          if (calcExprState.value === "0" && /[0-9.]/.test(value)) {
            calcExprState.value = value === "." ? "0." : value;
          } else {
            calcExprState.value += value;
          }
          renderCalc(calcExprState.value);
        }
      });
    }
  }

  // Distance converter UI
  if (elements.utilityDistanceFrom && elements.utilityDistanceTo) {
    const onFromChange = () => syncDistanceConversion("from");
    const onToChange = () => syncDistanceConversion("to");
    elements.utilityDistanceFrom.addEventListener("input", onFromChange);
    elements.utilityDistanceFromUnit?.addEventListener("change", onFromChange);
    elements.utilityDistanceToUnit?.addEventListener("change", onFromChange);
    elements.utilityDistanceTo.addEventListener("input", onToChange);

    if (elements.utilityDistanceSwap) {
      elements.utilityDistanceSwap.addEventListener("click", () => {
        const fromUnit = elements.utilityDistanceFromUnit?.value ?? "km";
        const toUnit = elements.utilityDistanceToUnit?.value ?? "mi";
        if (elements.utilityDistanceFromUnit) elements.utilityDistanceFromUnit.value = toUnit;
        if (elements.utilityDistanceToUnit) elements.utilityDistanceToUnit.value = fromUnit;
        const currentOptions = Array.from(elements.utilityDistanceFromUnit?.options || []).map((option) => ({
          value: option.value,
          label: option.textContent || option.value,
        }));
        refreshUtilityUnitDropdown("unit-from", currentOptions, toUnit);
        refreshUtilityUnitDropdown("unit-to", currentOptions, fromUnit);
        syncDistanceConversion("from");
      });
    }
    // initial sync
    syncDistanceConversion("from");
  }

  // Unit mode buttons + big result copy button
  const modeButtons = [
    document.getElementById("utilityConvertModeWeight"),
    document.getElementById("utilityConvertModeDistance"),
    document.getElementById("utilityConvertModeArea"),
  ];
  for (const btn of modeButtons) {
    if (!btn) continue;
    btn.addEventListener("click", () => {
      const mode = btn.dataset.unitMode || "distance";
      const next = setUtilityUnitMode(mode);
      applyUtilityUnitModeUi(next);
      syncDistanceConversion("from");
    });
  }

  const initialMode = getUtilityUnitMode();
  applyUtilityUnitModeUi(initialMode);

  const resultBtn = document.getElementById("utilityConvertResultBtn");
  if (resultBtn) {
    resultBtn.addEventListener("click", async () => {
      const text = String(resultBtn.textContent || "").trim();
      if (!text || text.toLowerCase().includes("result will appear")) return;
      try {
        await navigator.clipboard.writeText(text);
        resultBtn.textContent = `${text} (Copied)`;
        window.setTimeout(() => {
          resultBtn.textContent = text;
        }, 900);
      } catch {
        // ignore
      }
    });
  }

  if (elements.utilityCurrencyForm) {
    elements.utilityCurrencyForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const amount = Number.parseFloat(elements.utilityCurrencyAmount.value);
      const from = elements.utilityCurrencyFrom.value;
      const to = elements.utilityCurrencyTo.value;

      if (!Number.isFinite(amount)) {
        setCurrencyUi("Enter a valid amount.", "");
        return;
      }
      if (!from || !to) {
        setCurrencyUi("Select currencies to convert.", "");
        return;
      }

      setCurrencyUi("Converting…", "");

      let fxResult;
      try {
        fxResult = await fetchFxRate(from, to);
      } catch {
        setCurrencyUi("Rate unavailable for this currency pair.", "");
        return;
      }

      const { rate, source, updatedAt } = fxResult;
      if (!Number.isFinite(rate) || rate <= 0) {
        setCurrencyUi("Rate unavailable for this currency pair.", "");
        return;
      }

      const converted = amount * rate;
      const formatted = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 6,
      }).format(converted);

      setCurrencyUi(
        `${formatted} ${to}`,
        `1 ${from} = ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(rate)} ${to} (${source})${updatedAt ? ` • Updated ${updatedAt.toLocaleString()}` : ""}`
      );
    });
  }

  if (elements.utilityCurrencyFrom) {
    elements.utilityCurrencyFrom.addEventListener("change", () => {
      void updateCurrencyRatePreview();
    });
  }
  if (elements.utilityCurrencyTo) {
    elements.utilityCurrencyTo.addEventListener("change", () => {
      void updateCurrencyRatePreview();
    });
  }

  if (elements.utilityCurrencyOutput) {
    elements.utilityCurrencyOutput.addEventListener("click", async () => {
      const value = String(elements.utilityCurrencyOutput.textContent || "").trim();
      if (!value || value.toLowerCase().includes("enter an amount")) return;
      try {
        await navigator.clipboard.writeText(value);
        setCurrencyUi(value, "Copied result to clipboard.");
      } catch {
        // Ignore clipboard failures (browser permissions).
      }
    });
  }

}

async function checkForLocalChanges() {
  if (!devRefreshState.isEnabled) {
    return;
  }

  try {
    const response = await fetch(`/api/dev/version?ts=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const nextVersion = String(payload.version || "");

    if (!nextVersion) {
      return;
    }

    if (devRefreshState.currentVersion === null) {
      devRefreshState.currentVersion = nextVersion;
      return;
    }

    if (devRefreshState.currentVersion !== nextVersion) {
      window.location.reload();
    }
  } catch {
    // Ignore transient dev refresh polling failures.
  }
}

function startLocalAutoRefresh() {
  if (!devRefreshState.isEnabled || devRefreshState.timerId !== null) {
    return;
  }

  void checkForLocalChanges();
  devRefreshState.timerId = window.setInterval(() => {
    void checkForLocalChanges();
  }, 10000);
}

async function initializePage() {
  // Always show the default logo favicon during initial load.
  setTabFavicon(TAB_FAVICON_DEFAULT);

  // Use a single canonical local origin for OAuth + cookies.
  // Mixing `127.0.0.1` and `localhost` splits cookies and breaks popup postMessage checks.
  if (window.location.hostname === "127.0.0.1") {
    const nextUrl = new URL(window.location.href);
    nextUrl.hostname = "localhost";
    window.location.replace(nextUrl.toString());
    return;
  }

  window.addEventListener("message", (event) => {
    void handleGoogleAuthPopupMessage(event);
  });

  const params = new URLSearchParams(window.location.search);
  const isAuthSuccess = params.has("auth");
  const isAuthError = params.has("auth_error");
  if (isAuthSuccess || isAuthError) {
    window.history.replaceState({}, "", "/");
  }

  devRefreshState.isEnabled = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && params.has("devrefresh");

  renderResults("");
  setTabTitleForQuery("");
  setTabFavicon(TAB_FAVICON_DEFAULT);
  const authActions = document.querySelector(".auth-actions");
  if (authActions) {
    authActions.hidden = true;
  }
  elements.userProfile.hidden = true;
  closeDropdown();
  clearAttachments();

  await syncGeolocationPermission();
  applySettingsUi();
  scrubIncognitoUi();
  bindEvents();
  resetCurrencyManualRateMessage();
  updateUtilityTime();
  setUtilityTimeMode("digital");
  if (state.utilityTimeTimer) {
    clearInterval(state.utilityTimeTimer);
  }
  state.utilityTimeTimer = window.setInterval(updateUtilityTime, 250);
  startLocalAutoRefresh();
  await checkSession();
  scrubIncognitoUi();

  // No toast needed for account switch — switchToAccount() handles it instantly.

  const savedLang = getStoredSettings().displayLanguage;
  if (savedLang) {
    void applyPageLanguage(savedLang);
  }
  void loadTrendingTopics();
  void updateUserLocation();
}

initializePage();

window.openSettingsPopup = openSettingsPopup;
window.closeSettingsPopup = closeSettingsPopup;
window.requestOpenSettings = requestOpenSettings;

// Failsafe: open settings even if some handlers are blocked.
document.addEventListener("click", (event) => {
  const settingsBtn = event.target?.closest?.("#headerSettingsBtn");
  if (!settingsBtn) return;
  event.preventDefault();
  event.stopPropagation();
  requestOpenSettings();
}, true);
