#!/bin/zsh
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${DEVELOPER_DIR:-}" ]]; then
  if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  else
    export DEVELOPER_DIR="$HOME/Downloads/Xcode.app/Contents/Developer"
  fi
fi
SIMULATOR_ID="${1:?请传入已启动的 iPad 模拟器 UUID}"
mkdir -p "$APP_ROOT/build"
node "$APP_ROOT/tests/native-regression.cjs"
"$APP_ROOT/scripts/build.sh" simulator > "$APP_ROOT/build/regression-build.log" 2>&1
xcrun simctl terminate "$SIMULATOR_ID" com.nuannuan.farm 2>/dev/null || true
xcrun simctl install "$SIMULATOR_ID" "$APP_ROOT/build/DerivedData/Build/Products/Debug-iphonesimulator/NuannuanFarm.app"
DATA_ROOT="$(xcrun simctl get_app_container "$SIMULATOR_ID" com.nuannuan.farm data)"
REPORT_FILE="$DATA_ROOT/Documents/farm-regression.json"
rm -f "$REPORT_FILE"
xcrun simctl launch "$SIMULATOR_ID" com.nuannuan.farm --regression
# 测试运行中不会读取或写入生活存档，网页数据使用独立临时容器。
python3 - "$REPORT_FILE" "$APP_ROOT" <<'PY'
import json, pathlib, sys, time
report_path, root = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
started = time.monotonic()
while time.monotonic() - started < 240:
    try:
        report = json.loads(report_path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        report = {}
    if report.get('finished'):
        destination = root / 'qa' / 'regression-latest.json'
        destination.parent.mkdir(exist_ok=True)
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        failures = [case for case in report['results'] if not case.get('passed')]
        print(f"iPad WebKit：{len(report['results']) - len(failures)}/{report['total']} 通过")
        for case in failures:
            print(case['name'], case.get('reason', ''))
        sys.exit(bool(failures))
    time.sleep(2)
raise SystemExit('回归未在四分钟内完成，请检查模拟器和 farm-regression.json。')
PY
