import SwiftUI

private let ink = Color(red: 0.21, green: 0.29, blue: 0.22)
private let meadow = Color(red: 0.39, green: 0.49, blue: 0.31)
private let paper = Color(red: 0.98, green: 0.97, blue: 0.94)

struct FarmRootView: View {
    @ObservedObject var game: GameController
    @State private var helpOpen = false
    @State private var aboutOpen = false

    var body: some View {
        ZStack {
            paper.ignoresSafeArea()
            FarmWebView(webView: game.webView)
                .ignoresSafeArea()
                .opacity(game.isPlaying ? 1 : 0)
                .allowsHitTesting(game.isPlaying)
                .accessibilityHidden(!game.isPlaying)

            if !game.isPlaying {
                home
                    .transition(.opacity)
            }
            if game.isPlaying, let failure = game.failure {
                VStack(spacing: 20) {
                    Image(systemName: "leaf.circle").font(.system(size: 54)).foregroundStyle(meadow)
                    Text(failure).font(.title3)
                    Button("回到首页") { game.showHome() }.buttonStyle(.borderedProminent).tint(meadow)
                }
                .padding(40)
                .background(paper, in: RoundedRectangle(cornerRadius: 28))
                .shadow(radius: 30)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: game.isPlaying)
        .statusBarHidden(game.isPlaying)
        .persistentSystemOverlays(game.isPlaying ? .hidden : .automatic)
        .sheet(isPresented: $helpOpen) { help }
        .sheet(isPresented: $aboutOpen) { about }
    }

    private var home: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width > geometry.size.height
            Group {
                if wide {
                    HStack(spacing: 0) {
                        cover.frame(width: geometry.size.width * 0.53)
                        welcome.padding(38).frame(maxWidth: .infinity)
                    }
                } else {
                    VStack(spacing: 0) {
                        cover.frame(height: geometry.size.height * 0.43)
                        welcome.padding(30).frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
            .background(paper)
            .clipShape(RoundedRectangle(cornerRadius: 30))
            .padding(20)
        }
    }

    private var cover: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                if let url = Bundle.main.resourceURL?.appendingPathComponent("Game/assets/farm-background-wide-gate.png"),
                   let image = UIImage(contentsOfFile: url.path) {
                    Image(uiImage: image)
                        .resizable().scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                        .accessibilityHidden(true)
                }
                LinearGradient(colors: [.clear, ink.opacity(0.8)], startPoint: .center, endPoint: .bottom)
                VStack(alignment: .leading, spacing: 12) {
                    Label("小动物们，暖暖来啦！", systemImage: "sun.max")
                        .font(.system(size: 14, weight: .medium))
                    Text("太阳晒晒脸，\n小狗摇摇尾巴。")
                        .font(.custom("ZCOOLKuaiLe-Regular", size: geometry.size.height < 380 ? 26 : 34))
                        .lineSpacing(8)
                }
                .foregroundStyle(.white)
                .padding(32)
            }
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 8) {
                Image(systemName: "leaf.fill").foregroundStyle(meadow)
                Text("今天也来玩一会儿！")
                    .font(.custom("ZCOOLKuaiLe-Regular", size: 17))
                    .foregroundStyle(meadow)
            }
            Text("暖暖的\n小农场")
                .font(.custom("ZCOOLKuaiLe-Regular", size: 46))
                .lineSpacing(4).foregroundStyle(ink)
            Text("喂喂小动物，去森林转个弯。\n肚子咕噜噜？回家吃饭啦！")
                .font(.system(size: 15)).lineSpacing(7).foregroundStyle(ink.opacity(0.7))
            HStack(spacing: 16) {
                Label("不用联网", systemImage: "wifi.slash")
                Label("点点就能玩", systemImage: "hand.tap")
            }
            .font(.system(size: 12)).foregroundStyle(meadow)
            Divider().overlay(meadow.opacity(0.15))
            Text(game.saveCaption).font(.system(size: 13)).foregroundStyle(ink.opacity(0.65))

            if let failure = game.failure {
                Text(failure).font(.footnote).foregroundStyle(.red)
                Button("重新准备农场") { game.loadGame() }
                    .buttonStyle(.borderedProminent).tint(meadow)
            } else {
                Button(action: game.enterFarm) {
                    HStack {
                        Text(game.isReady ? (game.hasSave || game.isPlaying ? "接着玩！" : "出发，去农场！") : "小农场正在伸懒腰…")
                        Spacer()
                        if game.isReady { Image(systemName: "arrow.right") }
                        else { ProgressView().tint(.white) }
                    }
                    .font(.custom("ZCOOLKuaiLe-Regular", size: 21))
                    .padding(.horizontal, 22).padding(.vertical, 18)
                    .foregroundStyle(.white).background(meadow, in: RoundedRectangle(cornerRadius: 18))
                }
                .disabled(!game.isReady)
                .accessibilityIdentifier("enter-farm")
            }
            if let saveFailure = game.saveFailure {
                Text(saveFailure).font(.footnote).foregroundStyle(.orange)
            }
            HStack(spacing: 24) {
                Button("怎么玩") { helpOpen = true }
                Button("这里有什么？") { aboutOpen = true }
            }
            .font(.system(size: 13, weight: .medium)).foregroundStyle(meadow)
            Text("不着急，小脚丫慢慢走。")
                .font(.system(size: 12)).foregroundStyle(ink.opacity(0.55))
        }
        .frame(maxWidth: 430, alignment: .leading)
    }

    private var help: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    helpItem("hand.tap", "小脚丫，出发！", "点一下地面，暖暖就走过去。再点另一个地方，就会换个方向走。想歇一歇？点「停一下」！")
                    helpItem("sparkles", "今天玩点啥？", "走近小动物或家具，下面就会冒出动作按钮。点它试试！右上角的「活动」里，还有好多事情可以做。")
                    helpItem("fish", "鱼儿上钩啦！", "浮漂一沉，就点提竿，再按住收线。拉力变红，快松手！荡秋千时按住用力。想休息，就点「停一下」。")
                    helpItem("pawprint", "猫猫狗狗一起玩", "抱完猫猫，点放下；遛完狗狗，点松绳。布偶猫还在寄养所等你呢，接它前记得回家拿猫包！")
                    helpItem("fork.knife", "小肚子，搓泡泡", "左上角两条小状态，越满越舒服！小肚子咕咕叫，就吃背包里的饭、面包或水果，也可以回家坐好吃饭。干净度变少啦？去浴缸搓搓泡泡，洗干净再出发！")
                    helpItem("bookmark", "下次接着玩", "玩好的事情会自动记住。回首页再进来，还能接着玩。完全关掉后，会回到上次记住的地方。做饭、洗澡这些事，最好先做完再关哦。锁屏时大家也会休息。")
                }
                .padding(30)
            }
            .background(paper)
            .navigationTitle("点点玩，慢慢学")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("知道啦") { helpOpen = false } } }
        }
        .tint(meadow)
    }

    private func helpItem(_ icon: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon).font(.title2).foregroundStyle(meadow).frame(width: 32)
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.custom("ZCOOLKuaiLe-Regular", size: 21)).foregroundStyle(ink)
                Text(text).font(.body).foregroundStyle(ink.opacity(0.7)).lineSpacing(5)
            }
        }
    }

    private var about: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("一座小农场，一群好朋友。")
                        .font(.custom("ZCOOLKuaiLe-Regular", size: 25)).foregroundStyle(ink)
                    Text("小羊咩咩，小狗汪汪，猫猫还想玩毛线球！和暖暖去采花、钓鱼、荡秋千，再去村庄和森林找朋友。天黑了，就回家洗澡、吃饭、钻进软软的被窝。")
                        .foregroundStyle(ink.opacity(0.7)).lineSpacing(8)
                    Label("不用联网，小农场也一直在。", systemImage: "wifi.slash")
                    Label("这台 iPad 会记住你玩到哪里。删掉游戏，记录也会一起离开哦。", systemImage: "ipad")
                    Text("暖暖的小农场\n版本 1.0 · iPad 独立版")
                        .font(.footnote).foregroundStyle(ink.opacity(0.5))
                }
                .padding(30)
            }
            .background(paper).navigationTitle("这里有什么？").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("知道啦") { aboutOpen = false } } }
        }
        .tint(meadow)
    }
}
