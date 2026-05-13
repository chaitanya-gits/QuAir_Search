from __future__ import annotations

import asyncio
import base64
import csv
import io
import json
import mimetypes
import posixpath
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree

import google.genai as genai
from fastapi import APIRouter, HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel

from backend.config import settings

router = APIRouter()

_genai_client = None


def get_genai_client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=settings.gemini_api_key)
    return _genai_client

_MAX_EXTRACTED_TEXT_CHARS = 16000
_MAX_CELL_VALUES = 250
_MAX_FALLBACK_DETAILS_CHARS = 5000
_WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
_SHEET_NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_STOPWORDS = {
    "about", "after", "all", "also", "analysis", "analyze", "and", "are", "attachment", "attachments",
    "before", "below", "between", "can", "contains", "content", "direct", "each", "extract", "extracted",
    "file", "files", "for", "format", "from", "have", "inside", "into", "important", "infer", "info", "is",
    "local", "most", "name", "no", "not", "of", "on", "or", "provided", "query", "response", "search",
    "summary", "text", "that", "the", "this", "to", "type", "uploaded", "use", "using", "with", "you",
}


class AttachmentPayload(BaseModel):
    name: str
    mime_type: str
    content_base64: str


class AnalyzeRequest(BaseModel):
    files: list[AttachmentPayload]


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _truncate_text(text: str, limit: int = _MAX_EXTRACTED_TEXT_CHARS) -> str:
    normalized = text.strip()
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit].rstrip()}…"


def _guess_mime_type(file_name: str, provided_mime: str) -> str:
    mime_type = str(provided_mime or "").strip().lower()
    if mime_type and mime_type != "application/octet-stream":
        return mime_type
    guessed, _ = mimetypes.guess_type(file_name)
    return (guessed or "application/octet-stream").lower()


def _decode_file_bytes(file: AttachmentPayload) -> bytes:
    try:
        return base64.b64decode(file.content_base64, validate=True)
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload for {file.name}") from exc


def _extract_text_from_text_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def _extract_text_from_csv_bytes(data: bytes) -> str:
    text = _extract_text_from_text_bytes(data)
    reader = csv.reader(io.StringIO(text))
    rows: list[str] = []
    for index, row in enumerate(reader):
        if index >= 40:
            break
        rows.append(" | ".join(cell.strip() for cell in row if cell.strip()))
    return "\n".join(filter(None, rows))


def _extract_text_from_json_bytes(data: bytes) -> str:
    text = _extract_text_from_text_bytes(data)
    parsed = json.loads(text)
    pretty = json.dumps(parsed, ensure_ascii=True, indent=2)
    return pretty


def _extract_text_from_docx_bytes(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml_bytes)
    lines: list[str] = []
    for paragraph in root.findall(".//w:p", _WORD_NS):
        parts = [node.text for node in paragraph.findall(".//w:t", _WORD_NS) if node.text]
        line = "".join(parts).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _extract_text_from_pptx_bytes(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        slide_names = sorted(
            name for name in archive.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        )
        slides: list[str] = []
        for slide_name in slide_names[:20]:
            xml_bytes = archive.read(slide_name)
            root = ElementTree.fromstring(xml_bytes)
            texts = [node.text.strip() for node in root.iter() if node.text and node.text.strip()]
            if texts:
                slide_label = Path(posixpath.basename(slide_name)).stem.replace("slide", "Slide ")
                slides.append(f"{slide_label}: {' '.join(texts)}")
    return "\n\n".join(slides)


def _extract_text_from_xlsx_bytes(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for node in shared_root.findall(".//a:t", _SHEET_NS):
                shared_strings.append(node.text or "")

        sheet_names = sorted(
            name for name in archive.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        )

        values: list[str] = []
        for sheet_name in sheet_names[:10]:
            sheet_root = ElementTree.fromstring(archive.read(sheet_name))
            values.append(f"[{Path(posixpath.basename(sheet_name)).stem}]")
            row_count = 0
            for row in sheet_root.findall(".//a:row", _SHEET_NS):
                if row_count >= 40 or len(values) >= _MAX_CELL_VALUES:
                    break
                cells: list[str] = []
                for cell in row.findall("a:c", _SHEET_NS):
                    cell_type = cell.get("t", "")
                    raw_value = cell.findtext("a:v", default="", namespaces=_SHEET_NS)
                    if not raw_value:
                        continue
                    if cell_type == "s":
                        try:
                            raw_value = shared_strings[int(raw_value)]
                        except (ValueError, IndexError):
                            pass
                    cells.append(_normalize_whitespace(str(raw_value)))
                if cells:
                    values.append(" | ".join(cells))
                    row_count += 1
                if len(values) >= _MAX_CELL_VALUES:
                    break
    return "\n".join(values)


def _extract_local_text(file_name: str, mime_type: str, data: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    if mime_type.startswith("image/") or suffix in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}:
        return _extract_text_from_image_bytes(data)
    if mime_type == "text/csv" or suffix == ".csv":
        return _extract_text_from_csv_bytes(data)
    if mime_type == "application/json" or suffix == ".json":
        return _extract_text_from_json_bytes(data)
    if mime_type.startswith("text/") or suffix in {".md", ".log", ".py", ".html", ".xml", ".yaml", ".yml"}:
        return _extract_text_from_text_bytes(data)
    if suffix == ".docx":
        return _extract_text_from_docx_bytes(data)
    if suffix == ".pptx":
        return _extract_text_from_pptx_bytes(data)
    if suffix == ".xlsx":
        return _extract_text_from_xlsx_bytes(data)
    return ""


def _extract_text_from_image_bytes(data: bytes) -> str:
    try:
        import pytesseract
    except ImportError:
        return ""

    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    try:
        with Image.open(io.BytesIO(data)) as image:
            prepared_images = _build_ocr_candidates(image)
            extracted_lines: list[str] = []
            for prepared in prepared_images:
                text = pytesseract.image_to_string(prepared)
                cleaned = _normalize_whitespace(text)
                if cleaned:
                    extracted_lines.append(cleaned)
            for prepared in prepared_images:
                prepared.close()
    except (UnidentifiedImageError, OSError, ValueError):
        return ""
    except Exception:
        return ""

    unique_lines: list[str] = []
    for line in extracted_lines:
        if line not in unique_lines:
            unique_lines.append(line)
    return "\n".join(unique_lines[:4])


def _build_ocr_candidates(image: Image.Image) -> list[Image.Image]:
    base = image.convert("RGB")
    grayscale = ImageOps.grayscale(base)
    autocontrast = ImageOps.autocontrast(grayscale)
    enlarged = autocontrast.resize(
        (max(1, autocontrast.width * 2), max(1, autocontrast.height * 2)),
        Image.Resampling.LANCZOS,
    )
    threshold = enlarged.point(lambda value: 255 if value > 180 else 0)
    return [autocontrast, threshold]


def _extract_image_metadata_text(file_name: str, mime_type: str, data: bytes) -> str:
    try:
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            image_format = str(image.format or "").upper() or Path(file_name).suffix.replace(".", "").upper() or "UNKNOWN"
            mode = str(image.mode or "").upper() or "UNKNOWN"
        ocr_text = _truncate_text(_extract_text_from_image_bytes(data), 1500)
        ocr_section = f"\nDetected text:\n{ocr_text}" if ocr_text else "\nDetected text:\nNo readable text detected."
        return (
            f"File: {file_name}\n"
            f"Type: {mime_type}\n"
            f"Image metadata:\n"
            f"format={image_format}, size={width}x{height}px, color_mode={mode}"
            f"{ocr_section}"
        )
    except (UnidentifiedImageError, OSError, ValueError):  # pragma: no cover - malformed file path
        return (
            f"File: {file_name}\n"
            f"Type: {mime_type}\n"
            "Image metadata: Could not parse image dimensions or color mode.\n"
            "Detected text:\nNo readable text detected."
        )


def _supports_inline_analysis(mime_type: str, file_name: str) -> bool:
    suffix = Path(file_name).suffix.lower()
    if mime_type.startswith("image/") or mime_type == "application/pdf":
        return True
    return suffix == ".pdf"


def _build_analysis_contents(files: list[AttachmentPayload]) -> tuple[list[object], list[str]]:
    contents: list[object] = []
    extracted_sections: list[str] = []

    for file in files:
        mime_type = _guess_mime_type(file.name, file.mime_type)
        data = _decode_file_bytes(file)
        extracted_text = ""
        try:
            extracted_text = _extract_local_text(file.name, mime_type, data)
        except (KeyError, ValueError, zipfile.BadZipFile, ElementTree.ParseError, json.JSONDecodeError):
            extracted_text = ""

        if extracted_text:
            cleaned = _truncate_text(_normalize_whitespace(extracted_text))
            if cleaned:
                extracted_sections.append(f"File: {file.name}\nType: {mime_type}\nExtracted text:\n{cleaned}")
                continue

        if _supports_inline_analysis(mime_type, file.name):
            contents.append(genai.types.Part.from_bytes(data=data, mime_type=mime_type))
            if mime_type.startswith("image/"):
                extracted_sections.append(_extract_image_metadata_text(file.name, mime_type, data))
            else:
                extracted_sections.append(
                    f"File: {file.name}\nType: {mime_type}\nUse the uploaded binary attachment to inspect visible or embedded content."
                )
            continue

        extracted_sections.append(
            f"File: {file.name}\nType: {mime_type}\nNo direct text extractor is available for this format. "
            "Infer what you can from the filename and file type."
        )

    if extracted_sections:
        contents.append("\n\n".join(extracted_sections))

    return contents, extracted_sections


def _derive_search_query(fallback_text: str, files: list[AttachmentPayload]) -> str:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9]{2,}", fallback_text.lower())
    ranked: list[str] = []
    for token in tokens:
        if token in _STOPWORDS:
            continue
        if token not in ranked:
            ranked.append(token)
        if len(ranked) >= 5:
            break

    if ranked:
        return " ".join(ranked[:4])

    first_name = Path(files[0].name).stem.replace("_", " ").replace("-", " ").strip()
    normalized_name = _normalize_whitespace(first_name)
    if normalized_name:
        return f"{normalized_name} file details"
    return "uploaded file details"


def _build_local_analysis_result(files: list[AttachmentPayload], extracted_sections: list[str]) -> dict:
    file_count = len(files)
    summary = f"Analyzed {file_count} uploaded file{'s' if file_count != 1 else ''} using local recognition."
    fallback_text = _normalize_whitespace(" ".join(section for section in extracted_sections if section))
    details = _truncate_text(fallback_text, _MAX_FALLBACK_DETAILS_CHARS) if fallback_text else summary
    return {
        "search_query": _derive_search_query(fallback_text, files),
        "summary": summary,
        "details": details,
    }


@router.post("/attachments/analyze")
async def analyze_attachments(payload: AnalyzeRequest) -> dict:
    if not payload.files:
        raise HTTPException(status_code=400, detail="No files provided")
    contents, extracted_sections = _build_analysis_contents(payload.files)
    if not contents:
        raise HTTPException(status_code=400, detail="No readable files provided")

    if not settings.gemini_api_key:
        return _build_local_analysis_result(payload.files, extracted_sections)

    prompt = (
        "Analyze the provided attachments and extracted content. "
        "Explain what each file contains, highlight the most important information found inside, "
        "and produce a practical short search query for follow-up research. "
        "Return valid JSON only using this schema: "
        '{"summary":"short overall summary","details":"important extracted facts and contents","search_query":"2-10 word search query"}'
    )
    contents.append(prompt)

    try:
        client = get_genai_client()
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.gemini_model,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                responseMimeType="application/json",
            ),
        )
        result = json.loads(response.text)
    except Exception as exc:  # pragma: no cover - network/model path
        print(f"Attachment analysis failed: {exc}")
        return _build_local_analysis_result(payload.files, extracted_sections)

    summary = _normalize_whitespace(str(result.get("summary", "")).strip())
    details = _normalize_whitespace(str(result.get("details", "")).strip())
    search_query = _normalize_whitespace(str(result.get("search_query", "")).strip())

    if not summary:
        summary = "Analysis complete."
    if not details:
        fallback_text = " ".join(section for section in extracted_sections if section)
        details = _truncate_text(_normalize_whitespace(fallback_text)) or summary
    if not search_query:
        search_query = f"Information about {payload.files[0].name}"

    return {
        "search_query": search_query,
        "summary": summary,
        "details": details,
    }
