import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var webViewModel: WebViewModel

    var body: some View {
        ZStack(alignment: .top) {
            WebTrackerView(model: webViewModel)
                .ignoresSafeArea(edges: .bottom)

            if webViewModel.isLoading {
                ProgressView()
                    .padding(10)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 8)
            }

            if let errorMessage = webViewModel.errorMessage {
                VStack(spacing: 10) {
                    Text("Tracker could not load")
                        .font(.headline)
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Reload") {
                        webViewModel.reload()
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                .padding()
            }
        }
        .navigationTitle("Oncology")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    webViewModel.loadHome()
                } label: {
                    Label("Home", systemImage: "house")
                }

                Button {
                    webViewModel.reload()
                } label: {
                    Label("Reload", systemImage: "arrow.clockwise")
                }
            }
        }
    }
}
