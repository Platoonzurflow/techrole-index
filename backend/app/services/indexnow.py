from __future__ import annotations

import re
from urllib.parse import urlsplit
from xml.etree import ElementTree

import httpx

_KEY_RE = re.compile(r"^[A-Za-z0-9-]{8,128}$")


def submit_indexnow(*, base_url: str, key: str, timeout_seconds: float = 20, client: httpx.Client | None = None) -> dict[str, object]:
    base_url = base_url.rstrip("/")
    site = urlsplit(base_url)
    if site.scheme != "https" or not site.hostname or site.hostname in {"localhost", "127.0.0.1"}:
        raise ValueError("IndexNow requires a stable HTTPS host")
    if not _KEY_RE.fullmatch(key):
        raise ValueError("Invalid IndexNow key")
    key_location = f"{base_url}/indexnow-key.txt"
    owns_client = client is None
    client = client or httpx.Client(timeout=timeout_seconds, follow_redirects=True)
    try:
        published = client.get(key_location)
        published.raise_for_status()
        if published.text.strip() != key:
            raise ValueError("Published IndexNow key does not match")
        sitemap = client.get(f"{base_url}/sitemap.xml")
        sitemap.raise_for_status()
        root = ElementTree.fromstring(sitemap.content)
        urls = []
        for loc in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
            if loc.text and urlsplit(loc.text).hostname == site.hostname and loc.text not in urls:
                urls.append(loc.text)
        if not urls or len(urls) > 10_000:
            raise ValueError("Unexpected sitemap URL count")
        response = client.post("https://api.indexnow.org/indexnow", json={"host": site.hostname, "key": key, "keyLocation": key_location, "urlList": urls})
        response.raise_for_status()
    finally:
        if owns_client:
            client.close()
    return {"status": "submitted", "submitted_urls": len(urls), "host": site.hostname}
