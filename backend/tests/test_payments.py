from app.providers.payments import DemoPaymentProvider


def test_demo_webhook_signature_verification():
    provider = DemoPaymentProvider("secret")
    body, signature = provider.sign_webhook({"event_id": "evt-1", "status": "active"})
    assert provider.verify_webhook(body, signature)
    assert not provider.verify_webhook(body + b"x", signature)
