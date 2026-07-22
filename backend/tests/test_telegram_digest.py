import httpx

from app.services.telegram_digest import send_weekly_digest


def test_send_weekly_digest_posts_public_report_link():
    captured: list[httpx.Request] = []
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"ok": True})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert send_weekly_digest(bot_token="test-token", chat_id="123", base_url="https://techrole.ru", client=client) == {"status": "sent"}
    assert captured[0].url.path.endswith("/sendMessage")
    assert "reports/weekly" in captured[0].content.decode()
