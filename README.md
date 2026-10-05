# 暖暖的小农场 · Nuannuan Farm

一个绘本风格的休闲农场游戏：采集花草、照顾猫狗、骑马探索，也可以回家做饭、换衣和睡觉。仓库同时维护无需构建的 Canvas 网页版，以及内置完整离线资源的 iPad App。

![暖暖的小农场](preview.png)

## 两个版本

| | 网页版 | iPad App |
| --- | --- | --- |
| 入口 | [index.html](index.html) | [Xcode 工程](iPadApp/NuannuanFarm.xcodeproj) |
| 技术 | HTML、CSS、经典 JavaScript、Canvas 2D、Web Audio | SwiftUI、WKWebView、本地资源协议 |
| 操作 | 键盘、点击寻路与互动按钮 | 触屏寻路与按需显示的动作按钮 |
| 保存 | 图鉴保存到浏览器；生活状态刷新后重置 | 在完整动作检查点保存生活状态，重新打开可继续 |
| 运行要求 | 支持 Canvas 2D 与 Web Audio 的现代浏览器 | iPadOS 17+；构建需要 macOS 与完整 Xcode |

两个版本的游戏代码和素材分别保存在根目录与 `iPadApp/NuannuanFarm/Game/`，独立维护，修改一边不会自动同步另一边。

## 快速开始：网页版

需要 Python 3 启动静态服务；游戏运行本身没有 npm 依赖，也不需要后台服务。

```sh
git clone https://github.com/Domn93/nuannuan-farm-ipad.git
cd nuannuan-farm-ipad
python3 -m http.server 8765 --bind 127.0.0.1
```

在浏览器打开 [本地农场](http://127.0.0.1:8765/)。首次点击或按键后可开启声音；页面隐藏时停止声音。静态服务用 `Ctrl+C` 结束。

也可以直接打开 `index.html`，但开发与验收统一使用 HTTP 服务，避免不同浏览器的本地文件与存储策略影响结果。

## 快速开始：iPad

```sh
open iPadApp/NuannuanFarm.xcodeproj
```

选择共享的 `NuannuanFarm` Scheme 和 iPad 模拟器后运行。真机需要在 Xcode 中配置自己的签名团队。构建命令、设备要求、离线加载与存档说明见 [iPad 指南](iPadApp/README.md)。

## 开始游玩

- 方向键或 WASD 移动，Shift 小跑；也可以点击地面自动寻路。
- 附近动作按 E，多个动作按提示使用 E / R / T / Y，或直接点击动作按钮。
- 右上角「☰ 活动」打开地图、照料、背包、衣柜与生活入口。
- 猫旅行包在家中卧室；拿上后去寄养所接回布偶猫。牵狗或抱猫时可继续互动，长按 E 或按 Q 松开。
- 钓鱼时等待浮漂下沉再提竿，按住 E 收线，拉力变红就松开。

更多生活流程、地图路线、取消动作与保存规则见 [玩法指南](docs/gameplay.md)。iPad 使用对应的屏幕按钮完成持续动作。

## 项目结构

```text
index.html          网页入口与脚本加载顺序
js/                 按玩法划分的经典脚本
css/                网页样式
assets/             网页图像与本地音频
tests/              网页行为回归
scripts/check.mjs   两版本共用的只读开发检查
iPadApp/            原生 App、独立游戏副本、构建与回归脚本
docs/               玩法、架构、测试指南与历史验收
.github/            CI、Issue 与 Pull Request 模板
```

## 开发与验证

开发检查需要 Node.js 22+，只使用 Node 内置模块，无需 `npm install`：

```sh
node scripts/check.mjs
```

检查文档本地链接、两个游戏入口的资源与脚本语法，并运行网页版、iPad 存档及音频回归。GitHub Actions 在 Node.js 22 / 24 上执行同一入口。它不构建 Xcode 工程，也不替代浏览器、真实 WebKit 或真机体验验收。

| 文档 | 内容 |
| --- | --- |
| [贡献指南](CONTRIBUTING.md) | 开发流程、代码风格、提交与 PR 要求 |
| [架构说明](docs/architecture.md) | 脚本依赖、状态、坐标、动作与存档边界 |
| [测试指南](docs/testing.md) | 自动检查、模拟器回归、手动验收与证据 |
| [验收记录](QA.md) | 本次检查结论与历史记录索引 |
| [素材规范](assets/README.md) | 图集、锚点、裁切与素材维护 |

## 许可与素材来源

项目代码与文档采用 [MIT License](LICENSE)。音频、字体、插画和截图不自动适用代码许可证，须按 [素材来源与许可](THIRD_PARTY_NOTICES.md) 逐项处理。

第三方动物录音与字体保留原署名、来源和许可。AI 插画参考来源及合成语音的完整再分发依据仍有待补齐；当前记录不构成这些素材可任意商用或再许可的声明。

欢迎通过 [Issues](https://github.com/Domn93/nuannuan-farm-ipad/issues) 报告问题或提交改进。描述问题时请注明 Web / iPad 版本、复现步骤与实际结果。
