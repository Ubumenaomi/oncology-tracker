import SwiftUI

struct AppSettingsView: View {
    @EnvironmentObject private var webViewModel: WebViewModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        Form {
            Section("Tracker") {
                LabeledContent("Current URL", value: webViewModel.currentURLText)

                Button {
                    webViewModel.reload()
                } label: {
                    Label("Reload tracker", systemImage: "arrow.clockwise")
                }

                Button {
                    webViewModel.loadHome()
                } label: {
                    Label("Go to tracker home", systemImage: "house")
                }

                Button {
                    openURL(webViewModel.currentURL ?? webViewModel.homeURL)
                } label: {
                    Label("Open in Safari", systemImage: "safari")
                }
            }

            Section("About") {
                LabeledContent("App", value: "Oncology")
                LabeledContent("Bundle ID", value: "com.ubumenaomi.oncologytracker")
                LabeledContent("Tracker source", value: "oncology-tracker.vercel.app")
            }
        }
        .navigationTitle("Settings")
    }
}
