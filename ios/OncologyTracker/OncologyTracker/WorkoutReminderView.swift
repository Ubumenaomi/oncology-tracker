import SwiftUI

struct WorkoutReminderView: View {
    @EnvironmentObject private var reminderStore: ReminderStore
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("讀書任務", systemImage: "flame.fill")
                        .font(.headline)
                        .foregroundStyle(.orange)
                    Text(reminderStore.isEnabled ? "每日讀書提醒已設定在 \(reminderStore.reminderTimeText)。" : "開啟 iPhone 原生通知，每天提醒自己念書、寫題目，保持連勝。")
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section("每日提醒") {
                Toggle(isOn: Binding(
                    get: { reminderStore.isEnabled },
                    set: { enabled in
                        if enabled {
                            Task {
                                await reminderStore.requestPermissionAndEnable()
                            }
                        } else {
                            reminderStore.setEnabled(false)
                        }
                    }
                )) {
                    Text("啟用提醒")
                }

                DatePicker(
                    "提醒時間",
                    selection: Binding(
                        get: { reminderStore.reminderDate },
                        set: { reminderStore.setReminderDate($0) }
                    ),
                    displayedComponents: .hourAndMinute
                )

                Stepper(value: Binding(
                    get: { reminderStore.workoutMinutes },
                    set: { reminderStore.setWorkoutMinutes($0) }
                ), in: 1...180) {
                    Text("讀書/寫題時間：\(reminderStore.workoutMinutes) 分鐘")
                }
            }

            Section("通知狀態") {
                LabeledContent("通知權限", value: reminderStore.authorizationText)

                if let pendingReminder = reminderStore.pendingReminder {
                    LabeledContent("已排程", value: pendingReminder.timeText)
                    Text(pendingReminder.body)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    LabeledContent("已排程", value: "尚未設定")
                }

                Button {
                    Task {
                        await reminderStore.requestPermissionAndEnable()
                    }
                } label: {
                    Label("允許通知", systemImage: "bell.badge")
                }

                Button {
                    Task {
                        await reminderStore.sendTestReminder()
                    }
                } label: {
                    Label("5 秒後測試通知", systemImage: "paperplane.fill")
                }
            }

            if let statusMessage = reminderStore.statusMessage {
                Section {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Study Reminder")
        .task {
            await reminderStore.refreshAuthorizationStatus()
            await reminderStore.refreshPendingReminder()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task {
                await reminderStore.refreshAuthorizationStatus()
                await reminderStore.refreshPendingReminder()
            }
        }
    }
}
