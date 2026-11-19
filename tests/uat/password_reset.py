"""Exercise recovery against a disposable 4DPocket and MailHog instance."""

import json
import os
import time
from email import policy
from email.parser import BytesParser
from urllib.parse import urlencode, urlsplit
from urllib.request import urlopen
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("SMOKE_BASE_URL", "http://127.0.0.1:4040").rstrip("/")
MAIL = os.environ.get("SMOKE_INBOX_URL", "http://127.0.0.1:8025").rstrip("/")


def reset_link_for(address: str) -> str:
    search = urlencode({"kind": "to", "query": address})
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        with urlopen(f"{MAIL}/api/v2/search?{search}", timeout=3) as response:
            messages = json.load(response)["items"] or []
        for message in messages:
            if message["Content"]["Headers"]["Subject"] != ["Reset your 4DPocket password"]:
                continue
            with urlopen(f"{MAIL}/api/v1/messages/{message['ID']}/download", timeout=3) as response:
                email = BytesParser(policy=policy.default).parse(response)
            link = next(line.strip() for line in email.get_body(preferencelist=("plain",)).get_content().splitlines() if line.startswith(f"{BASE}/reset-password#token="))
            assert urlsplit(link).path == "/reset-password"
            return link
        time.sleep(0.2)
    raise AssertionError("The SMTP inbox did not receive the password reset email")


def main() -> None:
    suffix = uuid4().hex[:10]
    original_password = f"Before!{uuid4()}"
    new_password = f"After!{uuid4()}"
    username = f"recovery_{suffix}"
    email = f"{username}@example.com"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get("SMOKE_CHROMIUM_PATH"))
        try:
            original = browser.new_context()
            registered = original.request.post(
                f"{BASE}/api/v1/auth/register",
                data={"email": email, "username": username, "password": original_password},
            )
            assert registered.status == 201
            original_credentials = {"username": username, "password": original_password}
            assert original.request.post(f"{BASE}/api/v1/auth/login", form=original_credentials).ok
            assert original.request.get(f"{BASE}/api/v1/auth/me").ok

            page = browser.new_page()
            page.goto(f"{BASE}/login", wait_until="domcontentloaded")
            page.get_by_role("link", name="Forgot password?").click()
            page.get_by_label("Email or Username").fill(username)
            page.get_by_role("button", name="Send reset link").click()
            expect(page.get_by_role("status")).to_contain_text("If that account exists")

            link = reset_link_for(email)
            page.goto(link, wait_until="domcontentloaded")
            page.get_by_label("New password", exact=True).fill(new_password)
            page.get_by_label("Confirm new password").fill(new_password)
            page.get_by_role("button", name="Reset password").click()
            expect(page.get_by_role("status")).to_have_text("Password reset. Sign in with your new password.")
            expect(page).to_have_url(f"{BASE}/login")
            if screenshot := os.environ.get("SMOKE_SCREENSHOT"):
                page.screenshot(path=screenshot, animations="disabled")

            assert original.request.get(f"{BASE}/api/v1/auth/me").status == 401
            assert page.request.post(f"{BASE}/api/v1/auth/login", form=original_credentials).status == 401
            page.get_by_label("Email or Username").fill(username)
            page.get_by_label("Password", exact=True).fill(new_password)
            page.get_by_role("button", name="Sign in", exact=True).click()
            expect(page.get_by_role("heading", name="Recent Items")).to_be_visible()

            page.goto(link, wait_until="domcontentloaded")
            page.get_by_label("New password", exact=True).fill(new_password)
            page.get_by_label("Confirm new password").fill(new_password)
            page.get_by_role("button", name="Reset password").click()
            expect(page.get_by_role("alert")).to_contain_text("invalid, expired, or already used")
        finally:
            browser.close()

    print("Password reset passed through Chromium and SMTP, including single use and credential rotation")


if __name__ == "__main__":
    main()
