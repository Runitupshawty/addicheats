#!/bin/bash
# Builds a "Marketplace Search" app icon on the Desktop that starts the app
# in this folder. macOS counterpart of "Create Desktop Shortcut.bat".
HERE="${0%/*}"
[ "$HERE" = "$0" ] && HERE="."
HERE="$(cd "$HERE" 2>/dev/null && pwd)" || HERE="${0%/*}"

done_msg() {
  echo
  echo "  $1"
  echo
  read -r -p "Press Enter to close... "
}

fail() { done_msg "$1"; exit 1; }

LAUNCHER="$HERE/Start Marketplace Search.command"
[ -f "$LAUNCHER" ] || fail "Can't find \"Start Marketplace Search.command\" next to this file.
  Make sure you extracted the whole folder from the zip, then run this
  from inside the extracted \"Marketplace Search\" folder."

DESKTOP="$HOME/Desktop"
[ -d "$DESKTOP" ] || fail "Couldn't find your Desktop folder at $DESKTOP."

APP="$DESKTOP/Marketplace Search.app"

# Only replace a bundle we recognise as one of ours.
if [ -e "$APP" ]; then
  if [ -f "$APP/Contents/MacOS/launch" ]; then
    rm -rf "$APP" || fail "Couldn't replace the existing shortcut at $APP."
  else
    fail "Something else already exists on your Desktop named
  \"Marketplace Search.app\", and it isn't a shortcut this made.
  Rename or remove it yourself, then run this again."
  fi
fi

mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" \
  || fail "Couldn't create the shortcut on your Desktop."

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key><string>Marketplace Search</string>
	<key>CFBundleDisplayName</key><string>Marketplace Search</string>
	<key>CFBundleExecutable</key><string>launch</string>
	<key>CFBundleIconFile</key><string>icon</string>
	<key>CFBundleIdentifier</key><string>local.marketplacesearch.launcher</string>
	<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleShortVersionString</key><string>1.0</string>
	<key>CFBundleVersion</key><string>1</string>
	<key>LSMinimumSystemVersion</key><string>10.13</string>
	<key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# $LAUNCHER is baked in now; \$TARGET stays literal for run time.
cat > "$APP/Contents/MacOS/launch" <<EOF
#!/bin/bash
TARGET="$LAUNCHER"
if [ ! -f "\$TARGET" ]; then
  osascript -e 'display alert "Marketplace Search" message "The Marketplace Search folder was moved, renamed or deleted. Open the folder and run Create Desktop Shortcut again to fix this icon."' >/dev/null 2>&1
  exit 1
fi
open -a Terminal "\$TARGET"
EOF
chmod +x "$APP/Contents/MacOS/launch" || fail "Couldn't finish creating the shortcut."

if [ -f "$HERE/icon.icns" ]; then
  cp "$HERE/icon.icns" "$APP/Contents/Resources/icon.icns"
fi

touch "$APP"  # nudge Finder into picking up the new icon

done_msg "Done! A \"Marketplace Search\" icon is now on your Desktop.

  Double-click it any time to start the app.

  Note: the very first time you start the app, macOS may block it because
  it came from the internet. If that happens, open the
  \"Marketplace Search\" folder, right-click \"Start Marketplace Search\"
  and choose Open, just once. The Desktop icon works normally after that."
