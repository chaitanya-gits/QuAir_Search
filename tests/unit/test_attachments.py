from __future__ import annotations

import asyncio
import base64
import io
import sys
import zipfile
from types import SimpleNamespace

from PIL import Image

from backend.api import attachments
from backend.api.attachments import (
    AnalyzeRequest,
    AttachmentPayload,
    _extract_local_text,
    _guess_mime_type,
    analyze_attachments,
)


def _build_minimal_docx_bytes(text: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "word/document.xml",
            (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body>"
                "</w:document>"
            ),
        )
    return buffer.getvalue()


def _build_minimal_png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 16), color="white").save(buffer, format="PNG")
    return buffer.getvalue()


def test_guess_mime_type_uses_extension_when_missing() -> None:
    assert _guess_mime_type("report.docx", "") == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_extract_local_text_formats_json_prettily() -> None:
    result = _extract_local_text("sample.json", "application/json", b'{"a":1,"b":"two"}')
    assert '"a": 1' in result
    assert '"b": "two"' in result


def test_extract_local_text_reads_csv_rows() -> None:
    result = _extract_local_text("sample.csv", "text/csv", b"name,score\nalice,10\n")
    assert "name | score" in result
    assert "alice | 10" in result


def test_extract_local_text_reads_docx_xml() -> None:
    result = _extract_local_text(
        "sample.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _build_minimal_docx_bytes("Quarterly revenue increased"),
    )
    assert "Quarterly revenue increased" in result


def test_extract_local_text_reads_image_ocr_when_available(monkeypatch) -> None:
    class FakePyTesseractModule:
        tesseract_cmd = ""

    class FakePytesseract:
        pytesseract = FakePyTesseractModule()

        @staticmethod
        def image_to_string(image):
            return "Invoice Total 49"

    monkeypatch.setitem(sys.modules, "pytesseract", FakePytesseract())

    result = _extract_local_text("invoice.png", "image/png", _build_minimal_png_bytes())

    assert "Invoice Total 49" in result


def test_analyze_attachments_uses_genai_client(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeModels:
        def generate_content(self, *, model, contents, config):
            captured["model"] = model
            captured["contents"] = contents
            captured["config"] = config
            return SimpleNamespace(
                text='{"summary":"invoice summary","details":"invoice total and vendor","search_query":"invoice vendor total"}'
            )

    class FakeClient:
        def __init__(self):
            self.models = FakeModels()

    monkeypatch.setattr(attachments.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(attachments.settings, "gemini_model", "gemini-test-model")
    monkeypatch.setattr(attachments, "get_genai_client", lambda: FakeClient())

    payload = AnalyzeRequest(
        files=[
            AttachmentPayload(
                name="sample.txt",
                mime_type="text/plain",
                content_base64=base64.b64encode(b"Vendor: Acme\nTotal: 49").decode(),
            )
        ]
    )

    result = asyncio.run(analyze_attachments(payload))

    assert result["summary"] == "invoice summary"
    assert result["details"] == "invoice total and vendor"
    assert result["search_query"] == "invoice vendor total"
    assert captured["model"] == "gemini-test-model"
    assert any("Vendor: Acme" in str(item) for item in captured["contents"])


def test_analyze_attachments_returns_local_result_without_api_key(monkeypatch) -> None:
    monkeypatch.setattr(attachments.settings, "gemini_api_key", "")

    payload = AnalyzeRequest(
        files=[
            AttachmentPayload(
                name="notes.txt",
                mime_type="text/plain",
                content_base64=base64.b64encode(b"Project: Quantum SEO\nStatus: In review").decode(),
            )
        ]
    )

    result = asyncio.run(analyze_attachments(payload))

    assert result["summary"] == "Analyzed 1 uploaded file using local recognition."
    assert "Project: Quantum SEO" in result["details"]
    assert result["search_query"]


def test_analyze_attachments_falls_back_when_model_call_fails(monkeypatch) -> None:
    class FailingModels:
        def generate_content(self, *, model, contents, config):
            raise RuntimeError("model unavailable")

    class FailingClient:
        def __init__(self):
            self.models = FailingModels()

    monkeypatch.setattr(attachments.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(attachments.settings, "gemini_model", "gemini-test-model")
    monkeypatch.setattr(attachments, "get_genai_client", lambda: FailingClient())

    payload = AnalyzeRequest(
        files=[
            AttachmentPayload(
                name="report.csv",
                mime_type="text/csv",
                content_base64=base64.b64encode(b"name,total\nacme,1200\n").decode(),
            )
        ]
    )

    result = asyncio.run(analyze_attachments(payload))

    assert result["summary"] == "Analyzed 1 uploaded file using local recognition."
    assert "name | total" in result["details"]
    assert "acme | 1200" in result["details"]


def test_analyze_attachments_image_fallback_includes_detected_text(monkeypatch) -> None:
    monkeypatch.setattr(attachments.settings, "gemini_api_key", "")
    monkeypatch.setattr(attachments, "_extract_text_from_image_bytes", lambda data: "SALE 50 OFF")

    payload = AnalyzeRequest(
        files=[
            AttachmentPayload(
                name="promo.png",
                mime_type="image/png",
                content_base64=base64.b64encode(_build_minimal_png_bytes()).decode(),
            )
        ]
    )

    result = asyncio.run(analyze_attachments(payload))

    assert result["summary"] == "Analyzed 1 uploaded file using local recognition."
    assert "Detected text: SALE 50 OFF" in result["details"]
