import SwiftUI
import WebKit

struct WebTrackerView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: model.homeURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastHomeToken != model.homeToken {
            context.coordinator.lastHomeToken = model.homeToken
            webView.load(URLRequest(url: model.homeURL))
            return
        }

        if context.coordinator.lastReloadToken != model.reloadToken {
            context.coordinator.lastReloadToken = model.reloadToken
            webView.reload()
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let model: WebViewModel
        var lastReloadToken: UUID
        var lastHomeToken: UUID

        init(model: WebViewModel) {
            self.model = model
            self.lastReloadToken = model.reloadToken
            self.lastHomeToken = model.homeToken
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            Task { @MainActor in
                model.isLoading = true
                model.errorMessage = nil
                model.currentURL = webView.url
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in
                model.isLoading = false
                model.currentURL = webView.url
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            updateFailureState(webView: webView, error: error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            updateFailureState(webView: webView, error: error)
        }

        private func updateFailureState(webView: WKWebView, error: Error) {
            Task { @MainActor in
                model.isLoading = false
                model.currentURL = webView.url
                model.errorMessage = error.localizedDescription
            }
        }
    }
}
