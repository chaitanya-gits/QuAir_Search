from __future__ import annotations

import re


def clean_text(value: str) -> str:
    return re.sub(r'\s+', ' ', value or '').strip()


def summarize_result(result: dict) -> str:
    summary = clean_text(str(result.get('summary', '')))
    if summary:
        return summary[:317] + '...' if len(summary) > 320 else summary

    body = clean_text(str(result.get('body', '')))
    if body:
        return body[:317] + '...' if len(body) > 320 else body

    return 'insufficient data'


def build_answer(results: list[dict]) -> str:
    if not results:
        return 'insufficient data'

    parts: list[str] = []
    for result in results[:3]:
        summary = summarize_result(result)
        if summary != 'insufficient data':
            parts.append(summary)

    combined = clean_text(' '.join(parts))
    if not combined:
        return 'insufficient data'
    if len(combined) > 650:
        cut_point = combined.rfind(' ', 0, 647)
        return combined[:cut_point if cut_point > 0 else 647] + '...'
    return combined


def build_sources(results: list[dict], limit: int = 10) -> list[dict]:
    sources: list[dict] = []
    for result in results[:limit]:
        url = str(result.get('url', '')).strip()
        if not url:
            continue

        sources.append(
            {
                'title': clean_text(str(result.get('title', ''))) or 'Untitled source',
                'url': url,
                'summary': summarize_result(result),
                'score': round(float(result.get('score', 0.0)), 4),
                'semantic_score': round(float(result.get('semantic_score', 0.0)), 4),
                'pagerank_score': round(float(result.get('pagerank_score', 0.0)), 4),
                'quantum_score': round(float(result.get('quantum_score', 0.0)), 4),
                'sources': list(result.get('sources', [])),
                'image': str(result.get('image', '')).strip(),
                'published_date': str(result.get('published_date', '')).strip(),
            }
        )

    return sources
