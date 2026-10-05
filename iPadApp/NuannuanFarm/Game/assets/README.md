# 插画素材与贴图约束

本页记录素材文件、绘制约束与生成过程。授权范围及待补来源见 [许可清单](../../../../THIRD_PARTY_NOTICES.md)，架构见 [architecture](../../../../docs/architecture.md)，当前验收入口见 [QA](../../../../QA.md)。

2026-09-27：修复新增物件的纯色色块、围栏错误遮挡和二维旋转门。新增素材由内置 imagegen 生成；原始图片保留，便于核对和回退。

| 文件 | 用途 |
| --- | --- |
| `farm-gate.png` | 围栏入口留出通道的原始农场参考，门由代码单独绘制 |
| `farm-background-wide-gate.png` | 当前农场底图，双扇宽门洞，无预画鱼竿、鱼线和浮漂，钓具由动作绘制 |
| `interior-furnished.png` | 厨房、移位沙发、饭桌和鞋架绘入同一张室内插画 |
| `interior-sofa.png` | 沙发朝向电视的布局参考；当前底图为 `interior-clear.png` |
| `pan.png` | 厨房炉灶上的透明铁锅，带天然木纹锅柄和锅沿 |
| `meal-dishes.png` | 透明 2×2 菜肴图集：蔬菜饭、蘑菇汤、煎鱼、肉菜饭；端菜与饭桌按菜名裁切 |
| `door-panels.png` | 独立透明门板：养殖场木栅门、阳台玻璃木门；不含墙、地面或门框 |
| `interior-clear.png` | 当前室内底图，移除原画衣柜和旧炉灶，避免动态家具与原画重复 |
| `home-furniture.png` | 独立透明衣柜框、门叶和小灶台，按各自轮廓裁切 |
| `dining-pose.png` | 粉、蓝裙的真实坐姿吃饭贴图，背对镜头面向桌子，膝盖弯曲 |
| `interior-door.png` | 同位置修复出的阳台门洞地板，仅取门洞区域，保留其他家具 |
| `kennel.png` | 透明木质狗窝，替代纯色三角屋顶和矩形墙体 |
| `bowl.png` | 透明陶瓷饭盆，食物仍由状态控制 |
| `litter.png` | 透明猫砂盆与颗粒猫砂 |
| `pet-bed.png` | 透明布料宠物床 |
| `medicine-pouch.png` | 医生交给暖暖的三天份小布药袋，内有两种虚构药水；诊后随身携带，回家可主动存入冰箱 |
| `cat-travel-carrier.png` | 装着布偶猫的旅行包，抱猫时随人物移动 |
| `cat-carrier-empty.png` | 同款空旅行包，在家里可拿取，带出门后随身携带 |
| `boarding-entrance.png` | 医院与面包店之间楼梯尽头的寄养所门口 |
| `pet-boarding-garden.png` | 寄养所内景原始参考，包含画入背景的小猫 |
| `pet-boarding-empty.png` | 当前寄养所内景，移除静态小猫；动态小猫由角色图集独立绘制 |
| `pet-hospital.png` | 独立宠物医院内景，不再复用人类医院背景；兽医与猫狗另行绘制 |
| `junction.png` | 左森林、右城市、直行找朋友的乡间岔路 |
| `junction-village.png` | 当前岔路背景；移开中央道路右侧村舍，露出通往远处村庄的小路 |
| `forest.png` | 林间空地，蘑菇为动态可采集物 |
| `city.png` | 小城广场与面包店，互动点对齐店面 |
| `friends.png` | 朋友聚会草地，人物为动态图集 |
| `pets-sleep.png` | 萨摩耶与布偶猫闭眼蜷卧的透明睡眠贴图，分别裁切完整轮廓 |
| `animals-sleep.png` | 原养殖场动物图集的闭眼版本，保持裁切位置与原图一致 |
| `animals-clean.png` | 清醒动物的静止图集，逐只测量轮廓，排除邻居的尾巴和腿 |
| `animals-rest.png` | 当前使用的睡姿图集：猪、牛、羊和鸡趴卧闭眼，马站着休息 |
| `livestock-gait.png` | 农场八种动物的四列八行完整步态图集，按每帧透明边界裁切 |
| `wildlife-gait.png` | 松鼠、兔子、小鹿的四列三行完整步态图集，按移动距离推进四帧 |
| `boarding-orange-cats.png` | 寄养所四只常驻橘猫专用透明步态图集，4 列 8 朝向，887 × 1774；玩家布偶猫继续使用原来的 `cat-walk.png` |
| `riding-down.png` | 羽绒服骑马四帧图集，与粉裙、蓝裙骑乘图按当前服装选用 |
| `riding-idle-plaid.png` | 骑乘待机透明 2×2 图集：上左粉色格纹裙、上右蓝色格纹裙、下左羽绒服、下右透明 |
| `fishing-blue.png` | 蓝裙钓鱼图集，包含抛竿、等候、提竿和收线姿势 |
| `fishing-down.png` | 羽绒服钓鱼图集，包含抛竿、等候、提竿和收线姿势 |
| `swing-blue.png` | 蓝裙坐秋千透明姿势，座位及绳索由秋千状态绘制 |
| `swing-down.png` | 羽绒服坐秋千透明姿势，座位及绳索由秋千状态绘制 |

## 生成提示与保留约束

2026-10-01 寄养猫（内置 imagegen 编辑）：以 `cat-walk.png` 为姿势参考，保留四列八行、32 帧、朝向和透明底；全身改为橘色虎斑、深橘条纹及琥珀眼，不保留布偶猫的白身、深色重点脸和蓝眼。第二次编辑增加帧间留白，逐帧测量完整轮廓并保留原始比例与脚位，避免尾巴和邻帧相互截断。输出另存为 `boarding-orange-cats.png`，不替换玩家猫素材。

共同提示：温暖、细腻的日式田园绘本插画，天然木纹、布料褶皱、陶瓷釉面和柔和接触阴影；阳光从左上方照射；不使用扁平矢量色块、文字、界面、人物或动物。背景为 1536 × 1024，保持下半场开放可走；物件使用真实透明背景。

- 农场修改：只移除养殖场右前方的一段围栏，保留两侧柱子，让沙地自然过渡到草地；不把活动门画入背景。
- 室内修改：保留床、衣柜、电视、卫生间、阳台与原有墙体位置；把左侧旧沙发改为厨房，客厅放置横向绿色沙发、饭桌和鞋架。动态阳台门独立使用原图门板木纹。
- 沙发朝向修正（内置 imagegen 编辑）：只转动绿色沙发，让座垫正面朝北方电视、后背靠近画面下方；将电视和电视柜向右移到座位正前方。保留其他家具、房间和画风；依据成图同步电视屏幕、碰撞和互动坐标，坐下使用人物背面贴图。
- 铁锅（内置 imagegen）：单个深灰铸铁浅锅，俯视三分之四角度，木纹长柄向右上、左侧小耳柄，空锅、细腻金属锅沿、真实透明背景，无食物、炉灶或背景。代码按原始比例放在炉灶上，食材、火光、搅拌和蒸汽随做饭状态绘制。
- 四种菜（内置 imagegen）：透明 2×2 图集，左上蔬菜饭、右上蘑菇汤、左下整条煎鱼、右下肉菜饭；每格仅一份食物和餐盘，统一三分之四俯视角、大小、乡村绘本笔触，不画桌面、人物、文字或网格。代码按四格独立裁切。
- 狗窝：小型木质屋体、陶瓦顶、拱形入口、可见软垫；完整物体和小范围接触阴影。
- 饭盆：空的浅绿色釉面陶瓷饭盆，奶油色内壁，俯视三分之四角度，不画地板和垫子。
- 猫砂盆：低矮开口圆角托盘、米色颗粒猫砂、边缘的小铲子，不画猫、地板和排泄物。
- 宠物床：椭圆形绿色布料围边、奶油色绗缝软垫，保留织物褶皱和缝线。
- 岔路：左侧林地、右侧村落、中央远景小路，前景为开放草地。
- 岔路去村庄（内置 imagegen 编辑）：以 `junction.png` 为输入，仅移开中央上坡路右侧的小村舍和周围院子，用草地、野花和通向远处村庄的小路补齐；保留左边森林、右边集市摊位、远山、围栏和前景岔路。成图为 `junction-village.png`，原图保留。
- 森林：阳光照入的林间空地，两侧树木，中央开放小路，不预画可采集蘑菇。
- 城市：低层奶油色与绿色商店、烘焙摊、宽阔石板广场，底部中央留出口。
- 朋友：花边草坪、远处树木、中央开放草地，不预画朋友或阻挡通路的桌椅。
- 宠物睡眠（内置 imagegen）：参照原宠物画风，白色萨摩耶保留绿色项圈，布偶猫保留奶油与棕色毛色；闭上双眼、自然蜷卧、头枕前爪，透明背景，不添加文字。
- 养殖场睡眠（内置 imagegen 编辑）：沿用原图集所有动物的位置、大小与轮廓，只将眼睛改为自然闭合，嘴巴闭合；保留透明背景和原有细腻笔触。
- 2026-09-27 睡姿修正（内置 imagegen）：保留猪、成年羊、小羊、马、牛、公鸡、白鸡、棕鸡的身份和朝向，分别生成清醒与睡眠图集；除马外都将腿收在身下、趴卧闭眼，马站立放松。再清理背景和边缘，保留真实透明通道。旧图保留作参考，新图各自维护裁切范围，不强行按等分单元裁切。

## 后续维护

厨房锅、火焰、食材和手部动作共享 `kitchenLayout` 的位置变换。移动小灶台时同步修改 `onHouseFloor` 的脚位碰撞区域；不要只移动锅或只修改互动点。衣柜柜体和门叶来自独立图集，底图中不得保留另一套衣柜。

2026-09-27 门与动作重影修正：门板使用 `drawGroundedDoor`，原点固定在铰链底部，投影两端的脚位而非把远端向上抬。阳台门沿侧墙方向关闭，向阳台打开；养殖场门向外打开。每扇门每帧只绘制一次。上马前的马和人物与骑乘图、上下床时的站姿与躺姿都互斥显示，不再半透明交叠。

绘制代码集中在 `js/scenery.js` 维护素材、门板投影和围栏裁切范围。物件须按原始宽高比缩放；所有图像在启动前解码完成。

鱼类素材 `fish-species.png` 为透明 2×2 图集：左上鲫鱼、右上鲤鱼、左下鲈鱼、右下草鱼；虹鳟沿用 `trout.png`。鱼种与大小在抛竿时确定，水中、上岸和收藏弹窗共用 `drawCaughtFish`，成功上岸后才计入本次游玩的已发现鱼种。

朋友素材 `friend-characters.png` 包含小禾、米米、豆豆、林阿姨、陈叔叔五个独立人物。每人四帧：正面站姿、侧面迈左脚、侧面站姿、侧面迈右脚；实际行高不同，必须使用 `js/explore.js` 的 `friendSpriteRegions` 裁切，不能按五等分行。各人的脚底固定到地面坐标，名字只在互动中显示。

`barn-interior.png` 为单入口养殖场内景，使用原动物状态，不创建第二批动物。当前森林与集市背景为 `forest-v2.png` 和 `market-v3.png`，原背景与 `market-v2.png` 保留；中央通道的碰撞范围见 `onExploreGround`。`forest-wildlife.png` 包含松鼠、兔子、小鹿的静止姿势、可伐树、树桩和蝴蝶，按 `forestWildlifeRegions` 的独立透明边界裁切，不能等分图集。森林动作完成后才发放虫子或木材，取消不会获得物品。

动物每帧绘制一次完整轮廓。移动时使用四帧步态，步频随实际行走距离推进；站立与睡眠使用独立素材，切换时保持脚下位置。不要将宽矩形切成“腿”并分别旋转，矩形可能包含尾巴或邻居边缘，会形成重复轮廓。睡姿使用独立范围并按真实宽高比绘制，不压扁站姿。前后两遍绘制按脚位互斥分组。

2026-09-30 至 2026-10-01 真实感修复：`livestock-gait.png` 为四列八行，行序依次为猪、成年羊、羔羊、马、牛、公鸡、白鸡、棕鸡；`wildlife-gait.png` 为四列三行，行序依次为松鼠、兔子、小鹿。每帧都包含完整身体与四脚/两脚，不拆拼身体部位，裁切配置分别在 `livestockGaitRegions` 和 `wildlifeGaitRegions` 维护。

蓝裙和羽绒服的钓鱼、秋千素材使用内置 imagegen 编辑原动作图，保留人物身份、动作阶段和透明背景，只改变相应服装。钓鱼四帧分别测量裁切范围，不能直接套用粉裙边界；秋千人物只绘制一次，绳索、座位与人物共用摆角。骑马、钓鱼、秋千入口要求外出服装，睡衣和浴袍不会悄悄切为裙子。

骑马静止使用 `riding-idle-plaid.png`，四蹄自然着地，人物保留粉色格纹裙、蓝色格纹裙或羽绒服。图集为 2×2：上左粉裙、上右蓝裙、下左羽绒服、下右透明；按 `idleRidingRegions` 中的实际轮廓裁切，不能套用骑行图的裁切范围。停下和移动时分别选择待机图与骑行四帧，保持相同脚下锚点。`riding-idle.png`、`riding-idle-v2.png`、`riding-idle-2x2.png`、`riding-idle-clean.png` 是生成过程参考，未接入游戏；不要把带背景光晕或圆点裙的过程图替换成当前待机素材。

`farm-background-clean.png` 使用内置 imagegen 编辑农场背景，去除预画的鱼竿、鱼线和红浮漂，并补齐原处的岸边与水面。当前底图 `farm-background-wide-gate.png` 继续在此基础上拓宽围栏门洞，左、右门柱约在 x459、x601；净通道约 x468..594，容得下骑乘四蹄。门板由两扇等宽木门动态绘制，每扇保持原图比例；门洞、木栏遮挡与碰撞边界一起维护。其余建筑、水域与道路保持原位置，动态钓具统一由钓鱼会话绘制。

家具坐标改变后必须同步核对碰撞和互动点。不要用复制其他位置的地面来擦除旧家具；使用编辑后的完整背景。门绕竖直铰链运动，竖杆保持直立，不能对整个门做二维旋转。遮挡层只包含物件本体，不得含大块草地或沙地。

室内寻路采用 12 像素网格，室外默认 24 像素，农场骑乘等动物移动状态使用 12 像素；不要用粗网格漏掉家具之间真实可走的窄通道。发布脚本变更时更新页面中的资源版本，避免浏览器混用旧绘制脚本。

`hospital.png` 与 `bakery-interior.png` 使用内置 imagegen 生成，1536×1024，作为完整房间背景绘制一次。医院床在左边，诊桌在右后方；面包店烤炉与货架靠后墙，柜台靠右，中央地面及底部唯一入口留空。人物和门叶单独绘制，不能复制底图家具覆盖人物。

生成提示：两张都是 warm hand-painted storybook anime rural interior game background, elevated roofless dollhouse view, no people, no animals, no text or UI, broad empty central wooden floor, one bottom-center entrance, grounded furniture, coherent perspective。医院增加 cream walls, sage accents, left examination bed, rear-right reception desk and medicine cabinet；面包店增加 timber walls, back-wall bread ovens and shelves, upper-right bread counter, golden afternoon light。

`doctor.png` 由内置 imagegen 生成，独立透明全身人物，有效裁切为 x267、y21、宽493、高1491。提示：single full-body rural male doctor sprite, transparent background, warm hand-painted anime storybook style, glasses, white coat, sage shirt, brown trousers, stethoscope, holding a small chart, relaxed standing, full feet visible, no text or other characters。不要按整图宽度绘制，否则透明留白会缩小医生。

`village-house.png` 由内置 imagegen 生成，1536×1024，作为邻居村舍独立内景。提示：warm amber and sage village cottage, elevated roofless dollhouse view, open central wooden floor, left kitchenette, upper fireplace and bookshelves, right dining table, bottom-center exterior doorway, no people, pets, text, pink bed, bathtub or balcony。门口和中央站位保留可走地面，不复用暖暖家的内景。

`veterinarian.png` 由内置 imagegen 生成，1024×1536 透明人物，绘制时裁切 x210、y15、宽590、高1490。提示：single full-body friendly female veterinarian sprite, auburn braid, teal scrubs and cream jacket, paw badge, stethoscope, bandage and chart, transparent background, hand-painted storybook style, no animal, text or scenery。宠物医院使用她，村庄医院仍使用 `doctor.png`。

2026-09-30：宠物医院改用独立背景 `pet-hospital.png`，人类医院保留 `hospital.png`。寄养所当前底图为 `pet-boarding-empty.png`，原来画入背景的小猫已移除，屋内小猫使用完整猫图集，按照脚位分前后层绘制，并交替走动与停留；不能再同时绘制旧静态猫和动态猫。

`bed-poses-awake.png` 使用内置 imagegen 编辑原睡姿图集，仅把右侧睡衣人物改为睁眼、轻轻微笑，保留尺寸、位置、轮廓及透明背景。拉被子和起床使用睁眼版本，盖好后使用原闭眼版本，每帧只画其中一张。睡觉时被沿停在腰部约 y214，脸、睡衣和双手不能被遮住。

`quilt-handmade-wide.png` 使用内置 imagegen 生成，1448×1086 透明素材。提示：wide 4:3 isolated handmade quilt game sprite, nearly square top-down bed surface, blush pink and ivory patchwork, embroidered flowers, stitched quilting, soft padding, naturally wavy cloth edge, scalloped border and turned-over linen hem, no bed, people, text, cast shadow or background。通过裁切同一素材的下半部表现从床尾向上铺开；其他颜色仅对被子贴图调整色相，保留布料纹理。

2026-09-27 已记录的验证：内置浏览器实走农场、屋内、岔路、森林、城市、朋友六张地图；实际验证围栏通行、阳台门、衣柜换衣、坐沙发、采蘑菇、领取食物和交友。另用脚本检查家具碰撞及 20 条室内往返路径，确认当时启动素材的尺寸、透明通道和资源地址，页面错误日志为空。这份历史记录不能替代本次新增素材的浏览器验收；当前验收结果统一见 [QA](../../../../QA.md)。
