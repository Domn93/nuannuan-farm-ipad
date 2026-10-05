import Combine
import SwiftUI
import WebKit

@MainActor
final class GameController: NSObject, ObservableObject, WKNavigationDelegate, WKScriptMessageHandler {
    @Published private(set) var isReady = false
    @Published private(set) var isPlaying = false
    @Published private(set) var hasSave = false
    @Published private(set) var saveCaption = "小动物们已经等不及啦！"
    @Published private(set) var failure: String?
    @Published private(set) var saveFailure: String?

    let webView: WKWebView
    private let saveURL: URL
    private var active = true
    private var loadTimeout: Task<Void, Never>?
    #if DEBUG
    private let regressionEnabled = ProcessInfo.processInfo.arguments.contains("--regression")
    private var regressionIndex = 0
    private var regressionResults: [[String: Any]] = []
    #endif

    override init() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        saveURL = documents.appendingPathComponent("farm-save.json")
        let configuration = WKWebViewConfiguration()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--regression") {
            configuration.websiteDataStore = .nonPersistent()
        }
        #endif
        let gameRoot = Bundle.main.resourceURL!.appendingPathComponent("Game")
        configuration.setURLSchemeHandler(FarmAssetHandler(root: gameRoot), forURLScheme: "farm")
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        webView.navigationDelegate = self
        // 页面本身由 CSS 固定；保留 WebKit 的滚动手势，活动菜单和长弹窗才可滑动。
        webView.scrollView.isScrollEnabled = true
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.97, green: 0.96, blue: 0.92, alpha: 1)
        #if DEBUG
        webView.isInspectable = true
        #endif
        configuration.userContentController.add(self, name: "farm")
        loadGame()
    }

    func loadGame() {
        loadTimeout?.cancel()
        failure = nil
        isReady = false
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Game"),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            failure = "农场资源没有找到，请重新安装完整的 App。"
            return
        }

        #if DEBUG
        let saved = regressionEnabled ? nil : readSave()
        #else
        let saved = readSave()
        #endif
        webView.configuration.userContentController.removeAllUserScripts()
        let bootstrap = """
            window.ipadAppPaused = true;
            window.ipadSavedGame = \(saved ?? "null");
            // 资源由本地 scheme handler 提供 CORS 响应，换鞋和冬景的像素读取仍可使用。
            const FarmOriginalImage = window.Image;
            window.Image = function(...args) {
                const image = new FarmOriginalImage(...args);
                image.crossOrigin = 'anonymous';
                return image;
            };
            window.Image.prototype = FarmOriginalImage.prototype;
            const FarmOriginalAudio = window.Audio;
            window.Audio = function(...args) {
                const clip = new FarmOriginalAudio(...args);
                for (const event of ['loadeddata', 'playing', 'ended', 'error']) {
                    clip.addEventListener(event, () => {
                        window.ipadAudioDiagnostic = { event, source: args[0],
                            ready: clip.readyState, error: clip.error?.code || 0 };
                    });
                }
                return clip;
            };
            window.Audio.prototype = FarmOriginalAudio.prototype;
            """
        webView.configuration.userContentController.addUserScript(
            WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        webView.load(URLRequest(url: URL(string: "farm://local/index.html")!))
        loadTimeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(45))
            guard !Task.isCancelled, let self, !self.isReady else { return }
            self.failure = "农场准备得有些久，可以重新加载试试。"
        }
    }

    func enterFarm() {
        guard isReady, failure == nil else { return }
        isPlaying = true
        FarmAppDelegate.orientations = .landscape
        if let scene = webView.window?.windowScene {
            scene.windows.first?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscape))
        }
        applyPause()
    }

    func showHome() {
        webView.evaluateJavaScript("window.farmIPad?.save();")
        isPlaying = false
        FarmAppDelegate.orientations = .all
        webView.window?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
        applyPause()
    }

    func setActive(_ value: Bool) {
        active = value
        applyPause()
    }

    private func applyPause() {
        let paused = !isPlaying || !active
        webView.evaluateJavaScript("window.farmIPad?.setPaused(\(paused));")
        // 暂停时可以锁屏、回首页；不会继续推进游戏时间或播放声音。
        UIApplication.shared.isIdleTimerDisabled = isPlaying && active
    }

    private func readSave() -> String? {
        guard FileManager.default.fileExists(atPath: saveURL.path) else { return nil }
        do {
            let data = try Data(contentsOf: saveURL)
            guard let snapshot = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  snapshot["version"] as? Int == 1,
                  let json = String(data: data, encoding: .utf8) else {
                saveFailure = "旧存档暂时无法读取，已保留原文件。"
                return nil
            }
            updateSaveCaption(snapshot)
            return json
        } catch {
            saveFailure = "存档暂时无法读取，已保留原文件。"
            return nil
        }
    }

    private func updateSaveCaption(_ snapshot: [String: Any]) {
        let time = snapshot["farmTime"] as? [String: Any]
        let climate = snapshot["farmClimate"] as? [String: Any]
        let day = (time?["day"] as? Int ?? 0) + 1
        let season = climate?["season"] as? Int ?? 0
        let seasons = ["春天", "夏天", "秋天", "冬天"]
        hasSave = true
        saveCaption = "第 \(day) 天 · \(seasons[min(max(season, 0), 3)]) · 下次接着玩"
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.webView === webView,
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            loadTimeout?.cancel()
            isReady = true
            #if DEBUG
            if regressionEnabled {
                isPlaying = true
                runRegressionCase()
                return
            }
            #endif
            applyPause()
        case "home":
            showHome()
        case "save":
            #if DEBUG
            if regressionEnabled { return }
            #endif
            guard let snapshot = body["snapshot"] as? [String: Any], snapshot["version"] as? Int == 1 else { return }
            guard JSONSerialization.isValidJSONObject(snapshot) else {
                saveFailure = "这次进度还没存好，请保持 App 打开后再试。"
                webView.evaluateJavaScript("window.farmIPad?.saveResult(false);")
                return
            }
            do {
                let data = try JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
                try data.write(to: saveURL, options: .atomic)
                saveFailure = nil
                updateSaveCaption(snapshot)
                webView.evaluateJavaScript("window.farmIPad?.saveResult(true);")
            } catch {
                saveFailure = "这次进度还没存好，请保持 App 打开后再试。"
                webView.evaluateJavaScript("window.farmIPad?.saveResult(false);")
            }
        case "error":
            loadTimeout?.cancel()
            failure = "农场遇到了一个问题，可以重新加载。"
            #if DEBUG
            writeDiagnostic(body, name: "farm-error.json")
            webView.evaluateJavaScript("""
                (() => {
                    try { draw(); return { ready, result: '绘制正常' }; }
                    catch (error) { return { reason: String(error), stack: error.stack || '' }; }
                })()
                """) { [weak self] result, error in
                guard let details = result as? [String: Any] else { return }
                self?.writeDiagnostic(details, name: "farm-error-details.json")
            }
            #endif
        case "diagnostic":
            #if DEBUG
            writeDiagnostic(body, name: "farm-diagnostic.json")
            #endif
        default:
            break
        }
    }

    #if DEBUG
    private func runRegressionCase() {
        let root = Bundle.main.resourceURL!.appendingPathComponent("Game")
        do {
            let data = try Data(contentsOf: root.appendingPathComponent("tests/native-cases.json"))
            var cases = try JSONSerialization.jsonObject(with: data) as! [[String: Any]]
            if ProcessInfo.processInfo.arguments.contains("--performance") {
                cases = cases.filter { ($0["name"] as? String)?.contains("实际动画帧") == true }
            }
            guard regressionIndex < cases.count else { return }
            let testData = try JSONSerialization.data(withJSONObject: cases[regressionIndex])
            let test = String(data: testData, encoding: .utf8)!
            let runner = try String(contentsOf: root.appendingPathComponent("js/ipad-regression.js"), encoding: .utf8)
            webView.callAsyncJavaScript(runner + "\nreturn await window.runFarmRegressionCase(\(test));",
                                        arguments: [:], in: nil, in: .page) { [weak self] outcome in
                guard let self else { return }
                let value = try? outcome.get()
                let error: Error? = { if case .failure(let error) = outcome { return error }; return nil }()
                let result = value as? [String: Any] ?? ["passed": false, "reason": error?.localizedDescription ?? "测试无返回值"]
                self.regressionResults.append(result)
                self.regressionIndex += 1
                self.writeDiagnostic(["total": cases.count, "completed": self.regressionIndex,
                                      "results": self.regressionResults,
                                      "finished": self.regressionIndex == cases.count], name: "farm-regression.json")
                if self.regressionIndex < cases.count { self.loadGame() }
            }
        } catch {
            writeDiagnostic(["reason": error.localizedDescription, "finished": false], name: "farm-regression.json")
        }
    }

    private func writeDiagnostic(_ value: [String: Any], name: String) {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return }
        try? data.write(to: saveURL.deletingLastPathComponent().appendingPathComponent(name), options: .atomic)
    }
    #endif

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, url.scheme == "farm", url.host == "local" else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failure = "农场没有加载完成，请重新试试。"
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failure = "农场没有加载完成，请重新试试。"
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        isPlaying = false
        loadGame()
    }
}

struct FarmWebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

// 单一的安装包资源入口：不启动网络服务器，不使用 WebKit 私有安全开关。
// 对图片开放 CORS 是为了原有换鞋/冬景的 Canvas 像素处理；可读取范围只有 Game。
@MainActor
final class FarmAssetHandler: NSObject, WKURLSchemeHandler {
    private let root: URL

    init(root: URL) {
        self.root = root.resolvingSymlinksInPath()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.scheme == "farm", url.host == "local" else {
            urlSchemeTask.didFailWithError(URLError(.unsupportedURL))
            return
        }
        let relativePath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let file = root.appendingPathComponent(relativePath).resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/"),
              ["GET", "HEAD", "OPTIONS"].contains(urlSchemeTask.request.httpMethod ?? "GET") else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        do {
            let data = try Data(contentsOf: file, options: .mappedIfSafe)
            let types = ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
                         "css": "text/css; charset=utf-8", "json": "application/json",
                         "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                         "mp3": "audio/mpeg", "wav": "audio/wav", "svg": "image/svg+xml", "ttf": "font/ttf"]
            var headers = ["Content-Type": types[file.pathExtension] ?? "application/octet-stream",
                           "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                           "Access-Control-Allow-Headers": "Range", "Accept-Ranges": "bytes", "Cache-Control": "no-store"]
            var status = 200
            var payload = data
            if let range = urlSchemeTask.request.value(forHTTPHeaderField: "Range"), range.hasPrefix("bytes="),
               !data.isEmpty {
                let bounds = range.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
                if bounds.count == 2 {
                    let start = bounds[0].isEmpty ? max(0, data.count - (Int(bounds[1]) ?? data.count)) : Int(bounds[0]) ?? 0
                    let end = bounds[0].isEmpty || bounds[1].isEmpty ? data.count - 1 : min(Int(bounds[1]) ?? data.count - 1, data.count - 1)
                    if start >= 0, start <= end, start < data.count {
                        payload = data.subdata(in: start..<(end + 1))
                        status = 206
                        headers["Content-Range"] = "bytes \(start)-\(end)/\(data.count)"
                    } else {
                        status = 416
                        payload = Data()
                        headers["Content-Range"] = "bytes */\(data.count)"
                    }
                }
            }
            headers["Content-Length"] = String(payload.count)
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
            urlSchemeTask.didReceive(response)
            if urlSchemeTask.request.httpMethod != "HEAD", urlSchemeTask.request.httpMethod != "OPTIONS" {
                urlSchemeTask.didReceive(payload)
            }
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // 文件响应在 start 的同一次调用中完成，没有需取消的异步任务。
    }
}
