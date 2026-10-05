# 项目架构

本项目包含两个独立运行的版本：根目录的静态网页游戏，以及 `iPadApp/` 中用 SwiftUI 和 WKWebView 包装的 iPad App。两者分别保存自己的页面、脚本、样式和素材；当前没有资源同步脚本，也没有共享构建产物。

运行入口见 [README.md](../README.md)，玩家操作见 [gameplay.md](gameplay.md)，贡献流程见 [CONTRIBUTING.md](../CONTRIBUTING.md)，验证方法见 [testing.md](testing.md)。

## 目录与版本边界

```text
index.html                       网页版页面与脚本顺序
js/                              网页版游戏逻辑
css/                             网页版布局与面板样式
assets/                          网页版图片与声音
tests/                           网页版集成回归
iPadApp/
  NuannuanFarm.xcodeproj/         Xcode 工程
  NuannuanFarm/
    FarmApp.swift                App 生命周期与方向控制
    FarmRootView.swift           原生首页、说明与游戏容器
    GameController.swift         WebKit、资源加载与设备存档
    Game/                        iPad 独立的完整网页游戏
  scripts/                       构建与模拟器回归脚本
  tests/                         iPad 状态、资源与原生回归
docs/                            当前使用和开发文档
```

| 方面 | 网页版 | iPad 版 |
| --- | --- | --- |
| 页面入口 | 根目录 `index.html` | `NuannuanFarm/Game/index.html` |
| 运行环境 | 浏览器，静态服务即可 | SwiftUI 首页 + 本地 WKWebView |
| 操作 | 键盘、点击、页面触屏按钮 | 点击寻路与按需显示的动作按钮 |
| 游戏代码 | 根目录 `js/` | `Game/js/` 中的独立副本与 iPad 适配 |
| 生活进度 | 本次页面会话 | 设备上的完整状态检查点 |
| 图鉴 | 浏览器 `localStorage` | 图鉴记录同时包含在生活存档中 |
| 网络服务 | 无业务后端 | 从 App 包加载，不启动 HTTP 服务 |

修改一个版本不会自动修改另一个版本。修复共同玩法时，先判断另一版本是否有相同问题，再分别修改和验证；不要用整目录覆盖的方式同步，以免丢掉 iPad 的触屏、生命周期和存档差异。

## 按功能定位代码

下表链接到网页版入口。iPad 的共同玩法位于 `Game/js/` 中对应的独立文件；该版本额外的接口在下文说明。

| 入口 | 职责与协作脚本 |
| --- | --- |
| [game.js](../js/game.js) | 共享核心状态、寻路、输入、互动派发、主循环和切图 |
| [world.js](../js/world.js) | 农场与房屋互动点、地面边界、家具及阳台门 |
| [scenery.js](../js/scenery.js) | 背景、门板、布料材质和围栏遮挡裁切 |
| [farm.js](../js/farm.js) | 围栏门、动物走动、步态、喂养与成长；`barn.js` 管理棚内场景 |
| [animal-travel.js](../js/animal-travel.js) | 农场动物归属与骑马请求；`herding.js` 管理避雨引导 |
| [pets.js](../js/pets.js) | 猫狗走动、朝向、牵绳和基础绘制；`play.js` 管理玩球与捕猎 |
| [pet-care.js](../js/pet-care.js) | 猫包、抱背、上床、洗澡；`pet-eating.js` 和 `animal-care.js` 管理进食及如厕 |
| [home.js](../js/home.js) | 衣柜、被子、睡觉、闹钟、窗帘与添粮；`late-sleep.js` 处理午夜睡眠 |
| [living.js](../js/living.js) | 洗手、沙发、烹饪、端菜和饭桌；`bath.js`、`toilet.js` 管理卫生间动作 |
| [fridge.js](../js/fridge.js) | 冰箱、食物批次、保鲜与食材预扣/退款 |
| [explore.js](../js/explore.js) | 岔路、森林、聚会和集市地图、交友、共享背包；`market.js` 处理交易 |
| [forest-adventure.js](../js/forest-adventure.js) | 森林动物、捕虫和木材收集；`discoveries.js` 管理图鉴和树叶 |
| [buildings.js](../js/buildings.js) | 公共建筑、寄养、暖暖健康及诊疗；`pet-health.js` 管理宠物疾病与兽医 |
| [medicine.js](../js/medicine.js) | 按病人区分的处方、药袋、取药和多日疗程 |
| [night.js](../js/night.js) | 昼夜、宠物作息与夜色；`seasons.js`、`meteor.js`、`fireflies.js` 管理气候与自然效果 |
| [belongings.js](../js/belongings.js) | 图鉴界面、鞋架与袜子；`plants.js`、`air-conditioner.js` 管理室内养护 |
| [fishing.js](../js/fishing.js) | 钓鱼流程、拉力、鱼种和捕获展示；`swing.js` 管理秋千 |
| [tv.js](../js/tv.js) | 电视节目与预览；`music.js`、`voices.js` 管理音乐和语音 |
| [drawer.js](../js/drawer.js) | 活动菜单开合与焦点；`seasonal-friends.js` 管理朋友季节服装 |

## 启动和脚本依赖

游戏使用普通 `<script>` 标签，没有 ES 模块、打包器或运行时依赖安装步骤。脚本在同一个页面上下文中协作，既有顶层 `const` / `let` 状态，也有共享函数；顶层变量并不等同于 `window` 属性。

现有 HTML 中的加载顺序是依赖合同：

1. 功能脚本声明配置、状态、函数和 UI 监听。例如地图配置会被后续森林、建筑、图鉴等脚本补充。
2. `game.js` 初始化画布、人物、库存等核心状态，加载游戏图片，并启动主循环。
3. `drawer.js` 绑定活动菜单。
4. iPad 版额外在 `game.js` 前加载 `ipad-needs.js`，随后加载 `ipad-save.js` 和 `ipad.js`；核心素材准备好后，通过 `farm-ready` 事件恢复存档并通知原生首页。

功能脚本中的函数可以在执行时读取稍后初始化的共享状态，但在脚本顶层提前读取这些变量可能遇到初始化顺序错误。新增脚本应按真实依赖放入 HTML；不要任意增加 `async`，也不要只在其中一个入口更新加载顺序。

## 核心状态和一帧的执行

[game.js](../js/game.js) 集中管理核心运行状态：

| 状态 | 用途 |
| --- | --- |
| `scene`、`places` | 当前地图与该地图的互动点 |
| `player` | 脚位、朝向、步态和移动状态 |
| `pocket` | 当前可用库存与关系计数 |
| `keys`、`route`、`pendingPlace` | 按键、自动路线与到达后要执行的互动 |
| `busyUntil` | 动作对移动和普通互动的占用时间 |
| `clock` | 活跃游戏帧累计的秒数 |
| `farmTime`、`farmClimate` | 游戏日历、季节和天气，分别由功能脚本维护 |

`requestAnimationFrame` 驱动 `frame()`。每帧的 `dt` 以秒计，最多取 `0.04`，避免后台恢复或长帧造成一次过大的移动。符合运行条件时，先 `update(dt)`，再 `draw()`。

`update()` 的先后顺序有实际作用：先推进动作、门、生活系统和天气，再处理人物移动与到达互动，最后更新宠物、提示和效果。动作结束释放 `busyUntil`、门打开重建路线，都依赖这一顺序。改变调用位置应说明对应的行为影响。

`clock` 与 `farmTime.hour` / `farmTime.day` 表达不同时间：前者计动作和冷却，后者表达游戏日历。不能直接用浏览器壁钟替换动作计时；午睡、夜觉和跨日处理也不能靠修改一个计时字段完成。

## 坐标、碰撞和寻路

所有场景使用 **1536 × 1024** 的画布坐标。人物和多数动物的 `x` / `y` 表示脚下位置，画面缩放只改变显示，不改变世界坐标。

点击画布时，代码根据实际显示矩形及留白换算坐标。新增点击区域应沿用这套换算，不能直接把页面 `clientX` / `clientY` 当作地图坐标。

地图地面由 [world.js](../js/world.js)、[explore.js](../js/explore.js)、[barn.js](../js/barn.js) 和 [buildings.js](../js/buildings.js) 中的区域判断控制。`canWalk()` 在脚位周围取样；骑马使用更大的占地范围，并额外检查水边。自动路线使用网格寻路，默认网格为 24 像素；房屋、公共建筑，以及农场骑乘等动物移动状态使用 12 像素网格，为家具和门洞保留通行精度。

`walkTo()` 起步前重建网格，记录到达后的 `pendingPlace`；手动移动取消自动路线。动物进入原路线时，移动更新会尝试重新寻路。围栏门和阳台门有独立开门状态，跨门路线先走到门前，开门后再继续。

改动家具、门、人物或互动点时，应同时核对四件事：图像锚点、可行走边界、互动站位、点击区域。让其中一项单独偏移，容易出现能点到但走不到、穿门或脚底漂浮的问题。

## 动作会话与清理

动作按功能维护会话，例如 `fishingSession`、`swingSession`、`livingSession`、`sleepSession`、`petVetVisit`。项目没有统一动作框架；现有开始、更新和结束函数直接表达各自规则。

`busyUntil` 使用 `clock`；有限值表示等待到指定游戏秒数，`Infinity` 表示需要明确结束的持续动作。结束时需要清理本动作持有的状态、临时互动点、输入与声音，并释放相应占用。不要只把会话设为 `null` 就假定动作已完全结束。

几个需要保留的结算边界：

- 钓鱼落鱼完成后才增加库存；失败或取消不发奖励。
- 集市打包完成时同时扣金币、发物品；离开场景会取消未完成交易。
- 做饭通过 `reserveCookingIngredient()` 预扣原料。煮熟前取消，由 `refundCookingIngredient()` 退回原储存位置和原批次日期；煮熟后取消端菜，保存的是已做好的饭。
- 医生和兽医完成检查后才开处方；离开诊疗过程不会算作完成。
- 宠物药实际喂下后才扣除和推进疗程；取消走近、异图或寄养状态不能提前消耗药。
- 浇水动作完成后才补水或换苗；取消不会完成照料。

## 地图切换和角色归属

`changeScene()` 先清理旧场景的动作、临时对象、菜单与声音，再更新 `scene` / `places`，设置安全到达位置，清空路线和输入，重建地图网格并刷新 UI。

背包、衣服、动物成长、健康及朋友关系保留本次会话的状态；转场动画、未完成互动和临时路线不会直接带到新地图。公共建筑保存 `buildingReturn`，用于返回原门附近；室外返回先寻路到出口，再执行切换。

动物与宠物有地图归属，互动必须检查 `animalIsHere()` / `petIsHere()`。牵绳、猫包和骑乘是明确的同行方式；寄养中的自家猫狗留在寄养所，重新进入时继续使用同一对象。未同行的宠物不能因为玩家换图而凭空出现在身边。

`animal-travel.js` 保留部分旧动作状态处理，但当前入口只允许小马骑出去。羊、猪、牛和鸡的抱出、推行等方式已经在请求入口拒绝；不能把残留实现当作开放功能。

## 绘制与素材

`draw()` 的主要层次为静态背景 → 身后角色与遮挡 → 暖暖 → 身前角色与遮挡 → 动作、夜色和提示。角色前后关系以脚位的 y 坐标分组；门板和围栏也要分前后层。

素材路径相对页面入口，而不是相对脚本文件。例如 `js/home.js` 中的 `assets/…` 对应同版本 HTML 旁的 `assets/`。图集裁切范围与图片共同维护，换图或换帧时仍须保持脚位、门铰链和家具锚点一致。

围栏裁切只恢复需要遮住人物的木梁、柱子等部分，不能重画整片背景覆盖角色。被子在床上人物之后绘制。鞋袜换色、盆栽叶片和冬景用到 Canvas 像素处理，并缓存生成结果；不要在每帧重复读写整张图片。

素材绘制与裁切约束见 [assets/README.md](../assets/README.md)，来源与许可范围见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

## 菜单、暂停和声音

菜单是否阻止输入、是否暂停世界，是两个独立规则：

| 界面 | 游戏输入 | 世界更新 |
| --- | --- | --- |
| 帮助、背包、图鉴、鞋架、鱼展示、宠物照料、闹钟、农场照料对话框 | 阻止 | 暂停 |
| 冰箱、小药袋、电视对话框 | 阻止 | 继续 |
| 衣柜、厨房选择、活动菜单 | 由各输入入口和面板状态判断控制 | 继续；自动午睡、用餐和拉帘等待选择结束 |
| 页面进入后台 | 清理按键和长按状态 | 暂停 |
| iPad 回首页或 App 不活跃 | 原生桥接暂停并清理输入 | 暂停 |

菜单策略集中在 `game.js` 的 `pausedGameDialogs`、`gameDialogs` 和 `gameChoicePanels`。新增面板要明确放入哪一类，并验证关闭后焦点和操作恢复；不要用一个“打开了面板”条件替代全部暂停规则。

背景音乐由 Web Audio 合成，动物及人物语音包含本地录音。声音从实际用户操作启动；切到后台、iPad 回首页或动作结束时，相关停止函数清理音乐、说话、冲水或洗澡声音。睡眠准备开始后会清除人物语音和气泡。

## 存档合同

### 网页版

生活状态只在当前页面会话内保留，刷新后重新开始。图鉴的发现集合和捕获计数独立写入 `localStorage` 的 `nuannuan-discoveries-v1`；消耗物品不会消除图鉴记录。存储不可用或图鉴记录损坏时，游戏仍可在当前会话中运行。

### iPad 版

[ipad-save.js](../iPadApp/NuannuanFarm/Game/js/ipad-save.js) 提供 `canSaveIPadLife()`、`captureIPadLife()` 和 `restoreIPadLife()`。[ipad.js](../iPadApp/NuannuanFarm/Game/js/ipad.js) 每五秒尝试保存，回首页或后台也尝试保存。

保存要求当前没有做饭、洗澡、诊疗、睡眠、开门等未完成动作。稳定的牵狗、骑乘、抱或背宠物状态可以进入检查点；未完成动作不会强行序列化。关闭 App 后恢复最近成功保存的完整检查点，不保证恢复到离开时的每一帧。

存档覆盖位置、背包与食物批次、日期天气、衣服鞋袜、家具状态、动物成长与喂养、宠物及药物疗程、朋友关系、盆栽、图鉴、电视和部分采集冷却。路线、NPC 随机走动、动作中间帧与临时动画不序列化。

快照带 `version: 1`，采集时通过 JSON 克隆与运行对象断开引用。恢复时先验证地图、坐标、库存和数组数量等核心字段；先建立地图，再恢复宠物与同行状态，最后重建网格及界面。无法通行的位置不会强行应用。

原生 `GameController` 将快照原子写入 App 的 `Documents/farm-save.json`，并把成功或失败回传给页面；失败不会标记成成功检查点。无法读取的原存档会保留。仅用浏览器预览 iPad 页面时，生活状态改写入独立的 `nuannuan-ipad-life-v1` 键。两个版本没有云同步或存档互导功能，卸载 App 会删除设备存档。

## iPad 原生边界

`GameController` 通过 `FarmAssetHandler` 处理 `farm://local/` 请求，只允许访问 App 包内 `Game/` 下的文件。资源响应提供 MIME、CORS 和音频 Range 支持，使本地 Canvas 像素处理和录音播放继续工作；页面导航也限制在该本地来源。

原生与页面通过 `window.webkit.messageHandlers.farm` 交换准备完成、首页请求、存档、错误及诊断消息。原生控制暂停和方向，游戏规则继续由 JavaScript 维护。Debug 回归使用独立的非持久 WebKit 数据存储，并跳过玩家生活存档读写。

iPad 构建、签名和模拟器操作见 [README.md](../iPadApp/README.md)。

## 改动时如何验证

先在目标版本中定位入口、状态拥有者和结束路径，再核对对应回归。涉及公共玩法时分别验证网页与 iPad；涉及贴图、点击和触屏时，补实际浏览器或模拟器交互。VM 中成功调用 `draw()` 不能证明画面没有重影，历史帧率也不能作为新改动的性能结果。

命令、覆盖范围和验证记录的写法统一见 [testing.md](testing.md)。
