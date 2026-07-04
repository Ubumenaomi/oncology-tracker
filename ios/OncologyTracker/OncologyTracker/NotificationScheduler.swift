import Foundation
import UserNotifications

struct PendingReminder: Equatable {
    let hour: Int
    let minute: Int
    let body: String

    var timeText: String {
        String(format: "%02d:%02d", hour, minute)
    }
}

final class NotificationScheduler {
    static let shared = NotificationScheduler()

    private let center = UNUserNotificationCenter.current()
    private let dailyReminderIdentifier = "workout.daily.reminder"
    private let testReminderIdentifier = "workout.test.reminder"
    private var configured = false

    private init() {}

    func configure(delegate: UNUserNotificationCenterDelegate? = nil) {
        guard !configured else { return }
        if let delegate {
            center.delegate = delegate
        }
        configured = true
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    func requestAuthorization() async -> Bool {
        do {
            return try await center.requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            return false
        }
    }

    func scheduleDailyReminder(hour: Int, minute: Int, workoutMinutes: Int) async throws {
        center.removePendingNotificationRequests(withIdentifiers: [dailyReminderIdentifier])

        let content = UNMutableNotificationContent()
        content.title = "Workout quest is waiting"
        content.body = "\(workoutMinutes) min movement break. Keep the streak alive."
        content.sound = .default
        content.categoryIdentifier = "workout"

        var dateComponents = DateComponents()
        dateComponents.hour = hour
        dateComponents.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(identifier: dailyReminderIdentifier, content: content, trigger: trigger)

        try await center.add(request)
    }

    func sendTestReminder(workoutMinutes: Int) async throws {
        center.removePendingNotificationRequests(withIdentifiers: [testReminderIdentifier])

        let content = UNMutableNotificationContent()
        content.title = "Workout quest is waiting"
        content.body = "\(workoutMinutes) min movement break. Keep the streak alive."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        let request = UNNotificationRequest(identifier: testReminderIdentifier, content: content, trigger: trigger)
        try await center.add(request)
    }

    func cancelDailyReminder() {
        center.removePendingNotificationRequests(withIdentifiers: [dailyReminderIdentifier])
    }

    func pendingDailyReminder() async -> PendingReminder? {
        let requests = await center.pendingNotificationRequests()
        guard
            let request = requests.first(where: { $0.identifier == dailyReminderIdentifier }),
            let trigger = request.trigger as? UNCalendarNotificationTrigger
        else {
            return nil
        }

        return PendingReminder(
            hour: trigger.dateComponents.hour ?? 0,
            minute: trigger.dateComponents.minute ?? 0,
            body: request.content.body
        )
    }
}
