from __future__ import annotations

import httpx


def send_weekly_digest(*, bot_token: str, chat_id: str, base_url: str, timeout_seconds: float = 15, client: httpx.Client | None = None) -> dict[str, str]:
    if not bot_token.strip() or not chat_id.strip():
        raise ValueError("Telegram credentials are incomplete")
    owns_client = client is None
    client = client or httpx.Client(timeout=timeout_seconds)
    try:
        response = client.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": f"Еженедельный отчёт TechRole Index готов\n{base_url.rstrip('/')}/reports/weekly\n\nRSS: {base_url.rstrip('/')}/feed.xml", "disable_web_page_preview": False},
        )
        response.raise_for_status()
    finally:
        if owns_client:
            client.close()
    return {"status": "sent"}
