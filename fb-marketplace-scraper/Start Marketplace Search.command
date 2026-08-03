#!/bin/bash
# Double-click launcher for macOS (first time: right-click -> Open).
# Every path below is absolute, so the working directory doesn't matter.
# Resolved with shell builtins only, so a broken PATH can't confuse it.
HERE="${0%/*}"
[ "$HERE" = "$0" ] && HERE="."
HERE="$(cd "$HERE" 2>/dev/null && pwd)" || HERE="${0%/*}"

fail() {
  echo
  echo "  $1"
  echo
  read -r -p "Press Enter to close... "
  exit 1
}

# Launching from inside the .zip extracts this file alone to a temp folder,
# leaving the rest of the project behind. Catch that before pip does.
for needed in app.py scraper.py static/index.html; do
  if [ ! -f "$HERE/$needed" ]; then
    fail "This folder is missing files it needs to run ($needed).

  The usual cause: the app was started from inside the zip file.

  To fix it: double-click the zip to unpack it, open the extracted
  \"Marketplace Search\" folder, and start the app from THERE.

  Current folder: $HERE"
  fi
done

cd "$HERE" || fail "Could not open the app folder: $HERE"

command -v python3 >/dev/null 2>&1 || fail "Python 3 is required. Install it from https://www.python.org/downloads/ and run this again."

if [ ! -x "$HERE/.venv/bin/python" ]; then
  echo
  echo "  First-time setup: downloading what the app needs."
  echo "  This can take a few minutes and only happens once."
  echo
  python3 -m venv "$HERE/.venv" || fail "Could not set up Python. Check your internet connection and try again."
  if [ -f "$HERE/requirements.txt" ]; then
    "$HERE/.venv/bin/python" -m pip install --disable-pip-version-check -r "$HERE/requirements.txt" \
      || fail "Download failed. Check your internet connection, delete the .venv folder in here, and try again."
  else
    "$HERE/.venv/bin/python" -m pip install --disable-pip-version-check "playwright>=1.45" \
      || fail "Download failed. Check your internet connection, delete the .venv folder in here, and try again."
  fi
  "$HERE/.venv/bin/python" -m playwright install chromium \
    || fail "Browser download failed. Check your internet connection, delete the .venv folder in here, and try again."
fi

echo
echo "  Starting Marketplace Search — your web browser will open in a moment."
echo "  Keep this window open while you use the app; close it when you're done."
echo
"$HERE/.venv/bin/python" "$HERE/app.py"
