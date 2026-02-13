import logging

logger = logging.getLogger(__name__)

class NotificationAdapter:
    async def send_telegram(self, user_id, message):
        logger.info(f"[TELEGRAM] Sending alert to user {user_id}: {message}")
        # Actual integration with Telegram Bot API would go here
        return True

    async def send_email(self, user_id, subject, body):
        logger.info(f"[EMAIL] Sending alert to user {user_id} with subject '{subject}': {body}")
        # Actual integration with SMTP/SendGrid would go here
        return True
