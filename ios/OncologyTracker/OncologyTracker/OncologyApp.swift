import SwiftUI
import UserNotifications

@main
struct OncologyApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var webViewModel = WebViewModel()
    @StateObject private var reminderStore = ReminderStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(webViewModel)
                .environmentObject(reminderStore)
                .onAppear {
                    Task {
                        await reminderStore.refreshAuthorizationStatus()
                        await reminderStore.refreshPendingReminder()
                    }
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        NotificationScheduler.shared.configure(delegate: self)
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        NotificationCenter.default.post(name: .showTrackerHome, object: nil)
        completionHandler()
    }
}

extension Notification.Name {
    static let showTrackerHome = Notification.Name("showTrackerHome")
}
