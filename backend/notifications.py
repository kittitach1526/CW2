import json
import os
import threading
import urllib.request


def send_discord_notification(message, details=None, webhook_url=None):
    """Send a notification message to a Discord webhook in a background thread.

    The webhook URL can be passed directly or set via the DISCORD_WEBHOOK_URL
    environment variable. If no URL is available, the call is a no-op.
    """
    url = webhook_url or os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        return

    payload = {"content": message}
    if details:
        details_text = json.dumps(details, ensure_ascii=False, default=str)
        if len(details_text) > 1000:
            details_text = details_text[:1000] + "..."
        payload["embeds"] = [
            {
                "title": "รายละเอียด",
                "description": f"```json\n{details_text}\n```",
                "color": 0x5865F2,
            }
        ]

    def _post():
        try:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status >= 400:
                    pass
        except Exception:
            pass

    thread = threading.Thread(target=_post, daemon=True)
    thread.start()
