#!/bin/bash
# Double-click launcher for macOS (first time: right-click -> Open).
cd "$(dirname "$0")" || exit 1

fail() {
  echo
  echo "  $1"
  echo
  read -r -p "Press Enter to close... "
  exit 1
}

command -v python3 >/dev/null 2>&1 || fail "Python 3 is required. Install it from https://www.python.org/downloads/ and run this again."

if [ ! -x ".venv/bin/python" ]; then
  echo
  echo "  First-time setup: downloading what the app needs."
  echo "  This can take a few minutes and only happens once."
  echo
  python3 -m venv .venv || fail "Could not set up Python. Check your internet connection and try again."
  .venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt || fail "Download failed. Check your internet connection, delete the .venv folder in here, and try again."
  .venv/bin/python -m playwright install chromium || fail "Browser download failed. Check your internet connection, delete the .venv folder in here, and try again."
fi

echo
echo "  Starting Marketplace Search — your web browser will open in a moment."
echo "  Keep this window open while you use the app; close it when you're done."
echo
.venv/bin/python app.py
