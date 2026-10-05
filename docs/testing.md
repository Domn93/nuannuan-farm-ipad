# 测试指南

所有命令从仓库根目录运行。Node.js 检查使用内置模块，无需 `npm install`；使用 Node.js 22 及以上。iPad 构建需要 macOS 和完整 Xcode，模拟器回归还需要 Python 3 与已安装的 iPad 运行时。

## 选择检查范围

| 检查 | 验证内容 | 副作用与限制 |
| --- | --- | --- |
| `tests/game-check.cjs` | 网页版玩法、寻路、库存、动物和动作状态边界 | 只读；使用模拟 DOM、Canvas 和独立 VM 上下文 |
| `iPadApp/tests/ipad-check.cjs` | iPad 存档、暂停、小状态及资源独立性 | 只读；不运行真实 WebKit 或音频设备 |
| `iPadApp/tests/audio-check.cjs` | 中断后恢复、迟到 resume、旧音频请求竞争 | 只读；控制模拟音频 API 的完成时机 |
| `iPadApp/tests/native-regression.cjs` | 提取并检查 WKWebView 回归用例语法 | 覆盖随包 `native-cases.json`，此步骤不执行玩法断言 |
| `iPadApp/scripts/build.sh` | Swift 编译、资源打包、模拟器或真机架构 | 写入 `iPadApp/build`，不安装或启动 App |
| `iPadApp/scripts/regression.sh` | 在真实 WKWebView 中执行功能、绘制、布局和短时性能检查 | 生成夹具、构建并安装 App，终止其当前进程，覆盖回归报告 |

Node 检查通过只能证明对应模拟环境中的断言通过。截图、字体、触摸、扬声器效果和设备长期运行性能，需要实际游玩验收。网页与 iPad 包内游戏为独立副本，运行其中一版的检查不能证明另一版通过。

## 只读自动检查

统一检查入口包含 HTML 本地资源、JavaScript 语法、本地文档链接及网页、iPad、音频三项现有回归。链接检查不联网，也不校验页内锚点：

```sh
node scripts/check.mjs
```

仅检查文档链接：

```sh
node scripts/check.mjs --docs-only
```

也可单独运行对应回归：

```sh
node tests/game-check.cjs
node iPadApp/tests/ipad-check.cjs
node iPadApp/tests/audio-check.cjs
```

脚本断言失败会以非零状态退出。`game-check.cjs` 和 `ipad-check.cjs` 在首个失败处退出，后续场景不会运行；记录失败用例、实际值、期望值和退出状态，不能将已执行的部分推断为完整通过。

需要检查回归生成器和 shell 脚本语法而不生成文件时：

```sh
node --check iPadApp/tests/native-regression.cjs
zsh -n iPadApp/scripts/build.sh
zsh -n iPadApp/scripts/regression.sh
```

`iPadApp/tests/native-extra.cjs` 是用例文本，由生成器提取，不能单独执行。音频时序检查也不包含在 `ipad-check.cjs` 中，需分别运行。

## 生成 iPad 用例

```sh
node iPadApp/tests/native-regression.cjs
git diff -- iPadApp/NuannuanFarm/Game/tests/native-cases.json
```

生成器读取 `core-cases.json`、`ipad-check.cjs` 与 `native-extra.cjs`，将模拟事件转为真实 DOM 事件，并为真实碰撞、药物站位等场景准备确定的初始状态。输出写入 `iPadApp/NuannuanFarm/Game/tests/native-cases.json`，供 Debug App 使用。

输出“已生成”表示提取和语法检查成功，不表示用例已经执行。变更用例来源后重新生成，审阅生成文件的差异；不要直接修改生成文件来绕过失败。

## iPad 构建

工程、Scheme、最低系统和签名说明见 [iPad README](../iPadApp/README.md)。若 Xcode 不在标准安装位置，先设置工具链；将示例路径替换为实际安装位置：

```sh
export DEVELOPER_DIR="/path/to/Xcode.app/Contents/Developer"
xcodebuild -version
```

已有 `DEVELOPER_DIR` 优先于脚本内的自动选择；脚本不会改动系统 `xcode-select`。

```sh
./iPadApp/scripts/build.sh simulator
./iPadApp/scripts/build.sh archive
```

- `simulator` 使用 Debug、`iphonesimulator` 和通用模拟器目标，产物为 `iPadApp/build/DerivedData/Build/Products/Debug-iphonesimulator/NuannuanFarm.app`。
- `archive` 使用 Release 和通用 iOS 真机目标，产物为 `iPadApp/build/NuannuanFarm.xcarchive`。
- 两项均设置 `CODE_SIGNING_ALLOWED=NO`。归档用于验证构建与资源，不是可直接安装的签名 IPA。

## 真实 WKWebView 回归

先在 Xcode 中启动一台 iPad 模拟器，再列出已启动设备并选择其 UUID。以下命令会安装和启动 Debug App，请使用用于测试的模拟器：

```sh
xcrun simctl list devices booted
SIMULATOR_ID="替换为已启动的 iPad 模拟器 UUID"
./iPadApp/scripts/regression.sh "$SIMULATOR_ID"
```

脚本按顺序执行：

1. 生成随包测试夹具。
2. 构建 Debug 模拟器包，日志写入 `iPadApp/build/regression-build.log`。
3. 终止所选设备上 `com.nuannuan.farm` 的当前进程，安装构建产物。
4. 删除设备中上一份 `Documents/farm-regression.json`，以 `--regression` 启动。
5. 等待最多四分钟；完成后覆盖 `iPadApp/qa/regression-latest.json`，输出通过数和失败原因。

回归开关仅在 Debug 编译中生效。App 使用临时 WebKit 数据容器，每个场景重新加载，并跳过读取或写入 `farm-save.json`。这保证测试夹具与生活存档隔离，但脚本仍会替换已安装的 App 并中断当前游戏。

报告中的 `finished: true` 表示用例执行完成；还需检查每个 `results[].passed`。脚本遇到用例失败、构建失败或超时均以非零状态退出。若超时，仓库中可能仍保留上一份报告；查看构建日志和设备 Documents 文件，不能将旧报告当成本次结果。

完成后审阅报告和工作区变化：

```sh
git diff -- iPadApp/qa/regression-latest.json iPadApp/NuannuanFarm/Game/tests/native-cases.json
git status --short
```

### 单独性能采样

在已安装上述 Debug 包的同一模拟器中，可单独运行性能用例：

```sh
xcrun simctl terminate "$SIMULATOR_ID" com.nuannuan.farm 2>/dev/null || true
xcrun simctl launch "$SIMULATOR_ID" com.nuannuan.farm --regression --performance
```

此操作覆盖设备 `Documents/farm-regression.json`，不会自动复制到仓库，也不会更新完整回归报告。保持 App 可见直至报告 `finished: true`，可用下面的命令读取设备报告：

```sh
DATA_ROOT="$(xcrun simctl get_app_container "$SIMULATOR_ID" com.nuannuan.farm data)"
cat "$DATA_ROOT/Documents/farm-regression.json"
```

性能用例采样实际 `requestAnimationFrame` 间隔和更新、Canvas 指令提交耗时，涵盖 12 张地图及附加天气、夜景。Canvas 调用耗时不等于 GPU 渲染耗时，短时模拟器 FPS 也不代表真实 iPad 的长期性能。报告用于观察和比较；当前脚本没有规定 FPS 通过阈值。

## 手动验收

网页端从仓库根目录启动静态服务，再用浏览器打开：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765`。使用 Codex 执行浏览器验收时采用其内置浏览器。iPad 端在 Xcode 运行到测试模拟器或设备。

每个改动至少选一个主要场景，写明初始状态、操作步骤、预期结果、实际结果及证据。失败后修正，再重测同一场景；自动回归补充检查其他玩法。

| 场景 | 观察重点 |
| --- | --- |
| 启动与布局 | 字体和图片完整，横竖屏与窗口布局可用，按钮可触达 |
| 移动与互动 | 地面寻路、门洞、家具及动物碰撞，动作可完成或取消 |
| 食物与医疗 | 购买、存取、烹饪、取消和给药的库存守恒；按实际界面步骤操作 |
| 声音与生命周期 | 用户触摸后播放，回首页/后台暂停，再次进入恢复；实际听辨音量与音质 |
| iPad 存档 | 动作完成后保存，终止再启动恢复，半途动作与坏存档处理 |
| 性能与稳定性 | 长时间游玩、复杂天气、连续转场，记录设备、系统、采样方法与异常 |

## 记录结果

记录日期、提交版本、工具版本、设备与系统、命令、退出状态，以及执行范围和未验证项。生成的报告只有在本次完整运行并审阅后才作为本次证据。模拟器通过不能替代真机签名、触摸体验、扬声器和旧系统验收。

[QA 索引](../QA.md) 汇总已有记录。`docs/history` 内文档和 `iPadApp/qa` 中的报告、截图保留历史验收证据，不是对当前提交的通过保证。
