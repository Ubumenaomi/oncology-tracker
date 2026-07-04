import SwiftUI

struct WorkoutReminderView: View {
    @EnvironmentObject private var reminderStore: ReminderStore
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Workout quest", systemImage: "flame.fill")
                        .font(.headline)
                        .foregroundStyle(.orange)
                    Text(reminderStore.isEnabled ? "Daily reminder active at \(reminderStore.reminderTimeText)." : "Turn on a daily iPhone reminder for movement breaks.")
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section("Daily Reminder") {
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
                    Text("Enable reminder")
                }

                DatePicker(
                    "Reminder time",
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
                    Text("\(reminderStore.workoutMinutes) min movement break")
                }
            }

            Section("Notification") {
                LabeledContent("Permission", value: reminderStore.authorizationText)

                if let pendingReminder = reminderStore.pendingReminder {
                    LabeledContent("Scheduled", value: pendingReminder.timeText)
                    Text(pendingReminder.body)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    LabeledContent("Scheduled", value: "None")
                }

                Button {
                    Task {
                        await reminderStore.requestPermissionAndEnable()
                    }
                } label: {
                    Label("Allow notifications", systemImage: "bell.badge")
                }

                Button {
                    Task {
                        await reminderStore.sendTestReminder()
                    }
                } label: {
                    Label("Send test in 5 seconds", systemImage: "paperplane.fill")
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
        .navigationTitle("Workout Reminder")
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
