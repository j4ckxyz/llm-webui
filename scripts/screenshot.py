#!/usr/bin/env python3
"""Capture screenshots of the LLM WebUI using Playwright.

This script:
  - Optionally starts a local uvicorn server
  - Waits for it to be responsive
  - Captures screenshots of key tabs and the Help modal

Usage:
  python scripts/screenshot.py --start-server --port 8765 --out docs/screenshots

Requirements:
  pip install playwright
  python -m playwright install chromium
"""

import argparse
import os
import signal
import subprocess
import sys
import time
import urllib.request
from contextlib import closing
from pathlib import Path

from playwright.sync_api import sync_playwright


def wait_for_http(url: str, timeout: float = 15.0, interval: float = 0.3):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with closing(urllib.request.urlopen(url)) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(interval)
    return False


def start_server(port: int) -> subprocess.Popen:
    env = os.environ.copy()
    cmd = [sys.executable, "-m", "uvicorn", "llm_webui.server:app", "--port", str(port), "--log-level", "warning"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc


def take_screenshots(base_url: str, out_dir: Path, width: int = 1440, height: int = 900):
    out_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
        page = context.new_page()

        def capture(name: str):
            path = out_dir / f"{name}.png"
            page.screenshot(path=str(path), full_page=True)
            print("Saved", path)

        # Open homepage
        page.goto(base_url, wait_until="domcontentloaded")
        # Hide loading overlay if present
        page.evaluate("""
            const el = document.getElementById('loading-overlay');
            if (el) el.classList.add('d-none');
        """)
        capture("01_prompt")

        # Open Help modal
        try:
            page.click('#open-help', timeout=2000)
            time.sleep(0.5)
            capture("00_help_modal")
            # Close modal
            page.keyboard.press('Escape')
        except Exception:
            pass

        # Chat tab
        page.click('[data-tab="chat"]')
        time.sleep(0.5)
        capture("02_chat")

        # Models tab
        page.click('[data-tab="models"]')
        time.sleep(1.0)
        capture("03_models")

        # Templates tab
        page.click('[data-tab="templates"]')
        time.sleep(0.5)
        capture("04_templates")

        # Logs tab
        page.click('[data-tab="logs"]')
        time.sleep(0.5)
        capture("05_logs")

        context.close()
        browser.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-server", action="store_true", help="Start uvicorn llm_webui.server:app locally")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--out", default="docs/screenshots", help="Output directory for screenshots")
    args = parser.parse_args()

    proc = None
    base_url = f"http://{args.host}:{args.port}/"
    try:
        if args.start_server:
            proc = start_server(args.port)
            ok = wait_for_http(base_url)
            if not ok:
                print("Server did not become ready in time", file=sys.stderr)
                sys.exit(1)

        take_screenshots(base_url, Path(args.out))
    finally:
        if proc is not None:
            try:
                if proc.poll() is None:
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
            except Exception:
                pass


if __name__ == "__main__":
    main()
