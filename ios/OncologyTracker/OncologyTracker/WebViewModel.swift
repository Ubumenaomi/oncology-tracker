import Foundation

@MainActor
final class WebViewModel: ObservableObject {
    let homeURL = URL(string: "https://oncology-tracker.vercel.app/?nativeApp=ios")!

    @Published var currentURL: URL?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var reloadToken = UUID()
    @Published private(set) var homeToken = UUID()

    var currentURLText: String {
        currentURL?.absoluteString ?? homeURL.absoluteString
    }

    func reload() {
        reloadToken = UUID()
    }

    func loadHome() {
        homeToken = UUID()
    }
}
