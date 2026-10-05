#!/bin/zsh
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${DEVELOPER_DIR:-}" ]]; then
  if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  elif [[ -d "$HOME/Downloads/Xcode.app/Contents/Developer" ]]; then
    export DEVELOPER_DIR="$HOME/Downloads/Xcode.app/Contents/Developer"
  fi
fi

case "${1:-simulator}" in
  simulator)
    xcodebuild -project "$APP_ROOT/NuannuanFarm.xcodeproj" -scheme NuannuanFarm \
      -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$APP_ROOT/build/DerivedData" CODE_SIGNING_ALLOWED=NO build
    ;;
  archive)
    # 提供真机架构的完整归档；签名与可安装 IPA 需在 Xcode 中选择本人团队。
    xcodebuild -project "$APP_ROOT/NuannuanFarm.xcodeproj" -scheme NuannuanFarm \
      -configuration Release -destination 'generic/platform=iOS' \
      -derivedDataPath "$APP_ROOT/build/DerivedData" -archivePath "$APP_ROOT/build/NuannuanFarm.xcarchive" \
      CODE_SIGNING_ALLOWED=NO archive
    ;;
  *) print -u2 '用法：./scripts/build.sh simulator | archive'; exit 2 ;;
esac
