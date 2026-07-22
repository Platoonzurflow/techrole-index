import httpx
import pytest

from app.services.indexnow import submit_indexnow

SITEMAP = b'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://techrole.ru/</loc></url><url><loc>https://techrole.ru/professions/python</loc></url></urlset>'


def test_submit_indexnow_validates_key_and_submits_sitemap_urls():
    key = "test-indexnow-key-2026"
    requests: list[httpx.Request] = []
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/indexnow-key.txt":
            return httpx.Response(200, text=key)
        if request.url.path == "/sitemap.xml":
            return httpx.Response(200, content=SITEMAP)
        return httpx.Response(202)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = submit_indexnow(base_url="https://techrole.ru", key=key, client=client)
    assert result == {"status": "submitted", "submitted_urls": 2, "host": "techrole.ru"}
    assert requests[-1].url == "https://api.indexnow.org/indexnow"


def test_submit_indexnow_rejects_non_https_host():
    with pytest.raises(ValueError, match="stable HTTPS"):
        submit_indexnow(base_url="http://localhost:3000", key="")
