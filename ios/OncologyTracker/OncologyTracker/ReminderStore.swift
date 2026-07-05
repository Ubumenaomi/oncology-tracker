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
            return "已允許"
        case .denied:
            return "已在 iOS 設定中封鎖"
        case .notDetermined:
            return "尚未詢問"
        case .provisional:
            return "暫時允許"
        case .ephemeral:
            return "暫時允許"
        @unknown default:
            return "未知"
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
            statusMessage = "iOS 尚未允許通知。"
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
            statusMessage = "請先允許通知，再測試提醒。"
            return
        }

        do {
            try await NotificationScheduler.shared.sendTestReminder(workoutMinutes: workoutMinutes)
            statusMessage = "測試提醒已排程，5 秒後會送出。"
        } catch {
            statusMessage = "無法排程測試提醒：\(error.localizedDescription)"
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
            statusMessage = "運動提醒已關閉。"
            return
        }

        if authorizationStatus == .notDetermined {
            let allowed = await NotificationScheduler.shared.requestAuthorization()
            await refreshAuthorizationStatus()
            if !allowed {
                isEnabled = false
                persist()
                statusMessage = "iOS 尚未允許通知。"
                return
            }
        }

        guard authorizationStatus == .authorized || authorizationStatus == .provisional else {
            isEnabled = false
            persist()
            NotificationScheduler.shared.cancelDailyReminder()
            pendingReminder = nil
            statusMessage = "通知已在 iOS 設定中封鎖。"
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
            statusMessage = "每日運動提醒已設定在 \(reminderTimeText)。"
        } catch {
            statusMessage = "無法排程提醒：\(error.localizedDescription)"
        }
    }

    private func persist(defaults: UserDefaults = .standard) {
        defaults.set(isEnabled, forKey: DefaultsKey.isEnabled)
        defaults.set(reminderMinutesSinceMidnight, forKey: DefaultsKey.reminderMinutesSinceMidnight)
        defaults.set(workoutMinutes, forKey: DefaultsKey.workoutMinutes)
    }
}
