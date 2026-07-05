import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var webViewModel: WebViewModel
    @State private var selectedTab: AppTab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeView()
            }
            .tabItem { Label("Home", systemImage: "house.fill") }
            .tag(AppTab.home)

            NavigationStack {
                WorkoutReminderView()
            }
            .tabItem { Label("Study", systemImage: "book.closed.fill") }
            .tag(AppTab.workout)

            NavigationStack {
                AppSettingsView()
            }
            .tabItem { Label("Settings", systemImage: "gearshape.fill") }
            .tag(AppTab.settings)
        }
        .onReceive(NotificationCenter.default.publisher(for: .showTrackerHome)) { _ in
            selectedTab = .home
            webViewModel.loadHome()
        }
    }
}

private enum AppTab: Hashable {
    case home
    case workout
    case settings
}
