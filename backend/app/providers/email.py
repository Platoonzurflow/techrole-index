from __future__ import annotations

import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from pydantic import EmailStr, TypeAdapter, ValidationError

from app.config import settings


class EmailDeliveryNotConfigured(RuntimeError):
    pass


@dataclass(frozen=True)
class SupportEmail:
    public_id: str
    name: str
    reply_to: str
    topic: str
    subject: str
    message: str


@dataclass(frozen=True)
class MentorshipEmail:
    public_id: str
    name: str
    contact: str
    direction: str
    level: str
    proposed_budget_rub: int | None
    context: str


@dataclass(frozen=True)
class PipelineReportEmail:
    status: str
    started_at: str
    finished_at: str
    summary: str


class EmailProvider(Protocol):
    def send_support(self, support_email: SupportEmail) -> None: ...

    def send_mentorship(self, mentorship_email: MentorshipEmail) -> None: ...

    def send_pipeline_report(self, report: PipelineReportEmail) -> None: ...


class DisabledEmailProvider:
    def send_support(self, support_email: SupportEmail) -> None:
        del support_email
        raise EmailDeliveryNotConfigured("SMTP delivery is not configured")

    def send_mentorship(self, mentorship_email: MentorshipEmail) -> None:
        del mentorship_email
        raise EmailDeliveryNotConfigured("SMTP delivery is not configured")

    def send_pipeline_report(self, report: PipelineReportEmail) -> None:
        del report
        raise EmailDeliveryNotConfigured("SMTP delivery is not configured")


class SmtpEmailProvider:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
        recipient_email: str,
        use_ssl: bool,
        timeout: int,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email
        self.recipient_email = recipient_email
        self.use_ssl = use_ssl
        self.timeout = timeout

    def _send(self, *, subject: str, content: str, reply_to: str | None = None) -> None:
        email = EmailMessage()
        email["From"] = self.from_email
        email["To"] = self.recipient_email
        if reply_to:
            email["Reply-To"] = reply_to
        email["Subject"] = subject
        email.set_content(content)
        context = ssl.create_default_context()
        if self.use_ssl:
            with smtplib.SMTP_SSL(
                self.host, self.port, timeout=self.timeout, context=context
            ) as client:
                client.login(self.username, self.password)
                client.send_message(email)
            return
        with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as client:
            client.starttls(context=context)
            client.login(self.username, self.password)
            client.send_message(email)

    def send_support(self, support_email: SupportEmail) -> None:
        self._send(
            subject=f"[TechRole Support] {support_email.subject}",
            reply_to=support_email.reply_to,
            content="\n".join(
                (
                    f"Номер обращения: {support_email.public_id}",
                    f"Имя: {support_email.name}",
                    f"Email для ответа: {support_email.reply_to}",
                    f"Тема: {support_email.topic}",
                    "",
                    support_email.message,
                )
            ),
        )

    def send_mentorship(self, mentorship_email: MentorshipEmail) -> None:
        reply_to: str | None = None
        try:
            reply_to = str(TypeAdapter(EmailStr).validate_python(mentorship_email.contact))
        except ValidationError:
            pass
        self._send(
            subject=f"[TechRole Mentorship] Новая заявка: {mentorship_email.name}",
            reply_to=reply_to,
            content="\n".join(
                (
                    f"Номер заявки: {mentorship_email.public_id}",
                    f"Имя: {mentorship_email.name}",
                    f"Контакт: {mentorship_email.contact}",
                    f"Направление: {mentorship_email.direction}",
                    f"Текущий уровень: {mentorship_email.level}",
                    (
                        f"Предлагаемая стоимость: {mentorship_email.proposed_budget_rub:,} ₽".replace(",", " ")
                        if mentorship_email.proposed_budget_rub is not None
                        else "Предлагаемая стоимость: не указана"
                    ),
                    "",
                    "Текущая ситуация и цель:",
                    mentorship_email.context,
                    "",
                    "Кандидат подтвердил готовность выделять около 20 часов в неделю.",
                )
            ),
        )

    def send_pipeline_report(self, report: PipelineReportEmail) -> None:
        label = "Успех" if report.status == "success" else "Требует внимания"
        self._send(
            subject=f"[TechRole Nightly] {label}: сбор данных",
            content="\n".join(
                (
                    f"Статус: {report.status}",
                    f"Начало: {report.started_at}",
                    f"Завершение: {report.finished_at}",
                    "",
                    report.summary,
                )
            ),
        )


def _smtp_provider() -> SmtpEmailProvider:
    return SmtpEmailProvider(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        from_email=str(settings.smtp_from_email or settings.smtp_username),
        recipient_email=str(settings.support_recipient_email),
        use_ssl=settings.smtp_use_ssl,
        timeout=settings.smtp_timeout_seconds,
    )


def get_email_provider() -> EmailProvider:
    if not settings.support_email_enabled:
        return DisabledEmailProvider()
    return _smtp_provider()


def get_nightly_email_provider() -> EmailProvider:
    if not settings.nightly_report_email_enabled:
        return DisabledEmailProvider()
    return _smtp_provider()
