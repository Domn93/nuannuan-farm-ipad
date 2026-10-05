import SwiftUI

@main
struct FarmApp: App {
    @UIApplicationDelegateAdaptor(FarmAppDelegate.self) private var appDelegate
    @StateObject private var game = GameController()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            FarmRootView(game: game)
                .font(.system(.body, design: .rounded))
                .preferredColorScheme(.light)
                .onChange(of: scenePhase) { _, phase in
                    game.setActive(phase == .active)
                }
        }
    }
}

@MainActor
final class FarmAppDelegate: NSObject, UIApplicationDelegate {
    static var orientations: UIInterfaceOrientationMask = .all

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        Self.orientations
    }
}
