# 素材来源与许可

根 [MIT License](LICENSE) 适用于项目代码和文档。插画、音频、字体、应用图标与截图不自动适用 MIT；以下各类素材按其自身许可或已记录的来源处理。文件复制到 iPad 包内不改变原许可。

## 动物叫声

网页版与 iPad 包内均保存同一套经过处理的本地 MP3。署名、来源、加工说明与许可同时保存在两份资源目录中，分发其中一个版本时保留对应说明。

| 文件 | 作者与原始作品 | 许可 |
| --- | --- | --- |
| `dog.mp3` | Daniel Simion · [Labrador Barking Dog](https://soundbible.com/2215-Labrador-Barking-Dog.html) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `dog-v2.mp3` | Broadbeer · [George vuf 1996](https://commons.wikimedia.org/wiki/File:George_vuf_1996.ogg) | Public domain |
| `cat.mp3` | Mike Koenig · [Cat Meowing](https://soundbible.com/1290-Cat-Meowing.html) | CC BY 3.0 |
| `horse.mp3` | Mike Koenig · [Horse Neigh](https://soundbible.com/1296-Horse-Neigh.html) | CC BY 3.0 |
| `chicken.mp3` | Caroline Ford · [Hen Chicken](https://soundbible.com/1022-Hen-Chicken.html) | CC BY 3.0 |
| `cow.mp3` | Secretlondon · [Farm animals / Mudchute cow](https://opengameart.org/content/farm-animals) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `sheep.mp3` | Secretlondon · Farm animals / Mudchute sheep（同上来源） | CC BY-SA 3.0 |
| `pig.mp3` | Secretlondon · Farm animals / Mudchute pig（同上来源） | CC BY-SA 3.0 |

加工包含高低频过滤、适度降噪、音量统一及淡入淡出；初版狗叫截短，第二版保留短吠并间隔重复。处理后牛、羊、猪录音继续采用 CC BY-SA 3.0；猫、马、鸡及初版狗叫继续采用 CC BY 3.0，不标为原创录音。

- [Web 录音说明](assets/animals-audio/README.md)
- [iPad 录音说明](iPadApp/NuannuanFarm/Game/assets/animals-audio/README.md)

## iPad 字体

| 字体与文件 | 上游来源 | 随包许可原文 |
| --- | --- | --- |
| ZCOOL KuaiLe（站酷快乐体） | [googlefonts/zcool-kuaile](https://github.com/googlefonts/zcool-kuaile) | [OFL.txt](iPadApp/NuannuanFarm/Game/fonts/OFL.txt) |
| Noto Emoji | [google/fonts · notoemoji](https://github.com/google/fonts/tree/main/ofl/notoemoji) | [NotoEmoji-OFL.txt](iPadApp/NuannuanFarm/Game/fonts/NotoEmoji-OFL.txt) |

两款字体采用 SIL Open Font License 1.1，保留随包版权声明与原文。修改、改名或单独分发字体时，以各自 OFL 文件为依据。[字体用途说明](iPadApp/NuannuanFarm/Game/fonts/README.md) 记录标题、按钮和图标的使用方式。

## 插画、图集、图标与截图

仓库现有记录说明背景、人物、动物及新增家具使用图片生成工具生成或编辑，图集裁切、原参考风格和部分提示词见 [素材规范](assets/README.md)；iPad 图标由 [make-icon.swift](iPadApp/scripts/make-icon.swift) 本地绘制。

当前记录尚未完整列出原始参考图取得方式和授权依据，因此不把所有插画标为原创，也不在本次整理中为图像补授统一许可证。预览图及 QA 截图包含这些素材，同样不能作为全部素材已获再许可的证明。

**待维护者补齐：** 原始参考图来源及许可、生成或编辑记录对应的最终文件、对这些图像适用的分发条款。新增图片应在对应资源说明中直接记录这些信息。

## 合成语音

`assets/voices/` 与 iPad 对应副本保存暖暖的短句 MP3；现有说明记录 `zh-CN-XiaoxiaoNeural` 声线与生成参数。微软 [语音支持文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) 列出该声线，但声线名称不能证明这批文件使用了哪种服务或适用的输出授权。

- [Web 语音说明](assets/voices/README.md)
- [iPad 语音说明](iPadApp/NuannuanFarm/Game/assets/voices/README.md)

**待维护者补齐：** 实际生成服务、当时适用的使用及输出再分发条款。当前没有为这批 MP3 提供独立再分发许可证，不能据根 MIT 许可推定可商用、再许可或用于其他项目。

## 分发时保留什么

分发代码和文档时保留 MIT 原文；分发动物录音和字体时，一并提供对应目录的来源说明、作者署名、修改说明与许可原文或链接。插画和语音的上述缺口应在公开分发前补齐，或替换为已有明确授权记录的素材。

本清单核对日期为 2026-10-05。它记录已确认依据与尚缺信息，不将“已放入仓库”当作第三方素材的授权证明。
