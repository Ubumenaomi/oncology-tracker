import Foundation
import UserNotifications

@MainActor
final class ReminderStore: ObservableObject {
    @Published private(set) var isEnabled: Bool
    @Published private(set) var reminderMinutesSinceMidnight: Int
    @Published private(set) var workoutMinutes: Int
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var pendingReminder: PendingReminder?
    @Published var statusMessage: String?

    private enum DefaultsKey {
        static let isEnabled = "workoutReminder.isEnabled"
        static let reminderMinutesSinceMidnight = "workoutReminder.minutesSinceMidnight"
        static let workoutMinutes = "workoutReminder.workoutMinutes"
    }

    init(defaults: UserDefaults = .standard) {
        self.isEnabled = defaults.bool(forKey: DefaultsKey.isEnabled)
        let savedMinutes = defaults.object(forKey: DefaultsKey.reminderMinutesSinceMidnight) as? Int
        self.reminderMinutesSinceMidnight = savedMinutes ?? (19 * 60 + 30)
        let savedWorkoutMinutes = defaults.object(forKey: DefaultsKey.workoutMinutes) as? Int
        self.workoutMinutes = savedWorkoutMinutes ?? 20
    }

    var reminderDate: Date {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        return calendar.date(byAdding: .minute, value: reminderMinutesSinceMidnight, to: startOfDay) ?? Date()
    }

    var reminderTimeText: String {
        let hour = reminderMinutesSinceMidnight / 60
        let minute = reminderMinutesSinceMidnight % 60
        return String(format: "%02d:%02d", hour, minute)
    }

    var authorizationText: String {
        switch authorizationStatus {
        case .authorized:
            return "Notifications allowed"
        case .denied:
            return "Notifications blocked in iOS Settings"
        case .notDetermined:
            return "Permission not requested"
        case .provisional:
            return "Notifications provisionally allowed"
        case .ephemeral:
            return "Notifications temporarily allowed"
        @unknown default:
            return "Notification status unknown"
        }
    }

    func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        persist()
        Task {
            await applyReminderSchedule()
        }
    }

    func setReminderDate(_ date: Date) {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        let hour = components.hour ?? 19
        let minute = components.minute ?? 30
        reminderMinutesSinceMidnight = max(0, min(1439, hour * 60 + minute))
        persist()
        Task {
            await applyReminderSchedule()
        }
    }

    func setWorkoutMinutes(_ minutes: Int) {
        workoutMinutes = max(1, min(180, minutes))
        persist()
        Task {
            await applyReminderSchedule()
        }
    }

    func requestPermissionAndEnable() async {
        let allowed = await NotificationScheduler.shared.requestAuthorization()
        await refreshAuthorizationStatus()
        guard allowed else {
            isEnabled = false
            persist()
            statusMessage = "iOS did not allow notifications."
            return
        }

        isEnabled = true
        persist()
        await applyReminderSchedule()
    }

    func sendTestReminder() async {
        if authorizationStatus == .notDetermined {
            _ = await NotificationScheduler.shared.requestAuthorization()
            await refreshAuthorizationStatus()
        }

        guard authorizationStatus == .authorized || authorizationStatus == .provisional else {
            statusMessage = "Allow notifications before sending a test."
            return
        }

        do {
            try await NotificationScheduler.shared.sendTestReminder(workoutMinutes: workoutMinutes)
            statusMessage = "Test reminder scheduled for 5 seconds from now."
        } catch {
            statusMessage = "Could not schedule test reminder: \(error.localizedDescription)"
        }
    }

    func refreshAuthorizationStatus() async {
        authorizationStatus = await NotificationScheduler.shared.authorizationStatus()
    }

    func refreshPendingReminder() async {
        pendingReminder = await NotificationScheduler.shared.pendingDailyReminder()
    }

    private func applyReminderSchedule() async {
        await refreshAuthorizationStatus()

        guard isEnabled else {
            NotificationScheduler.shared.cancelDailyReminder()
            pendingReminder = nil
            statusMessage = "Workout reminder is off."
            return
        }

        if authorizationStatus == .notDetermined {
            let allowed = await NotificationScheduler.shared.requestAuthorization()
            await refreshAuthorizationStatus()
            if !allowed {
                isEnabled = false
                persist()
                statusMessage = "iOS did not allow notifications."
                return
            }
        }

        guard authorizationStatus == .authorized || authorizationStatus == .provisional else {
            isEnabled = false
            persist()
            NotificationScheduler.shared.cancelDailyReminder()
            pendingReminder = nil
            statusMessage = "Notifications are blocked in iOS Settings."
            return
        }

        let hour = reminderMinutesSinceMidnight / 60
        let minute = reminderMinutesSinceMidnight % 60

        do {
            try await NotificationScheduler.shared.scheduleDailyReminder(
                hour: hour,
                minute: minute,
                workoutMinutes: workoutMinutes
            )
            await refreshPendingReminder()
            statusMessage = "Daily workout reminder scheduled for \(reminderTimeText)."
        } catch {
            statusMessage = "Could not schedule reminder: \(error.localizedDescription)"
        }
    }

    private func persist(defaults: UserDefaults = .standard) {
        defaults.set(isEnabled, forKey: DefaultsKey.isEnabled)
        defaults.set(reminderMinutesSinceMidnight, forKey: DefaultsKey.reminderMinutesSinceMidnight)
        defaults.set(workoutMinutes, forKey: DefaultsKey.workoutMinutes)
    }
}
