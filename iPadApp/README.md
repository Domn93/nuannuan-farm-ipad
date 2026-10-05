# 暖暖的小农场 · iPad 版

种种菜，摸摸猫，肚子咕咕叫就回家吃饭。带着暖暖过一个慢悠悠的小日子。

![iPad 游戏画面](qa/game-11.jpg)

这是使用 SwiftUI 和 WKWebView 的独立 iPad 工程，随安装包提供完整游戏、图片、音频和字体。游玩不需要联网或启动网页服务器。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 开发系统 | macOS，安装完整 Xcode 及 iOS 模拟器运行时 |
| App 系统 | iPadOS 17.0 及以上，仅支持 iPad |
| 工程与 Scheme | `NuannuanFarm.xcodeproj` / `NuannuanFarm` |
| Swift | 工程使用 Swift 5 语言模式 |
| 自动检查 | Node.js 22 及以上，无需安装 npm 依赖 |
| 模拟器回归 | 另需 Python 3、已启动的 iPad 模拟器 |

历史构建和模拟器验收使用 Xcode 26.3、iPadOS 26.3，见 [iPad 验收记录](../docs/history/ipad-qa.md)。最低部署版本来自工程配置；iPadOS 17 和真实 iPad 尚无验收记录。

## 在 Xcode 中运行

从仓库根目录打开工程：

```sh
open iPadApp/NuannuanFarm.xcodeproj
```

选择 `NuannuanFarm` Scheme 和一台 iPad 模拟器，点击 Run。首页支持横竖屏；进入游戏后请求横屏，画布保持原画比例。窗口和全屏状态由系统管理。

安装到真机时，在 Target → Signing & Capabilities 中选择自己的 Team，再选择连接的 iPad 运行。按设备提示启用开发者模式。若默认 Bundle Identifier `com.nuannuan.farm` 与自己的签名配置冲突，改成唯一标识；更改标识会使用独立的 App 和存档空间。

## 命令行构建

以下命令均从仓库根目录运行：

```sh
./iPadApp/scripts/build.sh simulator
./iPadApp/scripts/build.sh archive
```

| 命令 | 构建目标 | 产物 |
| --- | --- | --- |
| `simulator` | Debug，通用 iOS Simulator，关闭代码签名 | `iPadApp/build/DerivedData/Build/Products/Debug-iphonesimulator/NuannuanFarm.app` |
| `archive` | Release，通用 iOS 真机，关闭代码签名 | `iPadApp/build/NuannuanFarm.xcarchive` |

归档命令用于检查真机架构和完整资源，生成未签名 `.xcarchive`。安装或分发需要选择有效签名团队，重新 Archive 并导出；此产物不能直接当作 IPA 安装。

脚本遵循已有 `DEVELOPER_DIR`；未设置时优先选择标准位置 `/Applications/Xcode.app`。`build.sh` 另检查用户下载目录中的 `Xcode.app`，`regression.sh` 则直接将该目录设为后备位置。因此，非标准安装应明确指定工具链，例如把下面的路径替换为实际 Xcode 安装位置：

```sh
export DEVELOPER_DIR="/path/to/Xcode.app/Contents/Developer"
xcodebuild -version
```

脚本不会修改系统 `xcode-select` 设置。

## 检查与回归

```sh
node iPadApp/tests/ipad-check.cjs
node iPadApp/tests/audio-check.cjs
```

两项检查只读取仓库文件，分别验证玩法与存档边界、音频恢复的异步竞争。完整命令、用例生成、真实 WKWebView 回归和副作用说明见 [测试指南](../docs/testing.md)。

`native-regression.cjs` 会生成并覆盖随包测试夹具；`regression.sh` 会构建、终止并安装模拟器 App、运行回归并更新报告。回归入口仅在 Debug 中启用，使用临时 WebKit 数据容器，不读写玩家生活存档。历史结果和截图见 [QA 索引](../QA.md)，每次改动后仍需重新验证。

## App 行为

- 原生首页、启动屏、玩法说明与关于页面；儿童文案和字体均随包提供。
- `WKURLSchemeHandler` 通过 `farm://local/` 读取包内资源，支持图片的 Canvas 像素读取和音频范围请求。
- 触屏点地面寻路；App 隐藏方向键与小跑按钮，钓鱼、秋千和宠物等动作按当前场景显示按钮。
- 返回首页或进入后台时暂停游戏时间与声音；再次进入保留当前会话。
- 小肚子随活动消耗，吃饭补充；干净度随脏污变化，洗澡后恢复。这两项跟随生活存档。

## 存档

App 每五秒尝试保存，返回首页和进入后台时也会尝试保存。做饭、洗澡、诊疗、睡眠等尚未完成的动作会延后保存，避免记录半途状态；完全关闭后从最近一次完整检查点恢复。

存档包含背包与食物批次、日期天气、衣物鞋袜、位置、动物成长和喂养、宠物健康与药物疗程、朋友关系、盆栽、图鉴及冰箱和饭桌库存。临时动画与 NPC 的随机走动不序列化。

生活存档以原子写入方式保存在 App 的 `Documents/farm-save.json`，没有云同步。卸载 App 会删除存档。Debug 回归报告写入同一 Documents 目录，但使用独立文件。

## 文件组织与维护

| 路径 | 用途 |
| --- | --- |
| `NuannuanFarm.xcodeproj` | Xcode 工程和共享 Scheme |
| `NuannuanFarm/FarmRootView.swift` | 原生首页、说明和关于页面 |
| `NuannuanFarm/GameController.swift` | 资源加载、生命周期、存档和 Debug 回归入口 |
| `NuannuanFarm/FarmApp.swift` | App 入口和方向控制 |
| `NuannuanFarm/Game` | 独立游戏和素材副本 |
| `NuannuanFarm/Game/css/ipad.css`、`js/ipad*.js` | App 布局、触屏、状态和存档适配 |
| `scripts` | 构建、回归和图标生成脚本 |
| `tests` | Node 检查和 WKWebView 用例来源 |
| `qa` | 历史报告与截图 |

`Game` 是仓库根目录网页版的独立副本，构建不会自动同步两份代码。修改共同玩法时，明确说明变更覆盖哪一版，分别运行对应检查；不要在构建脚本中隐式复制或覆盖另一版。

开发约定见 [贡献指南](../CONTRIBUTING.md)。素材来源与许可见 [素材说明](NuannuanFarm/Game/assets/README.md) 和 [字体说明](NuannuanFarm/Game/fonts/README.md)。
