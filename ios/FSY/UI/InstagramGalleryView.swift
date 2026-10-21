import SwiftUI

/// Rotas da galeria dentro da pilha de navegação de Início ou Perfil.
enum GalleryRoute: Hashable {
    case gallery
    case post(String)
}

/// Galeria nativa do Instagram oficial com as publicações reais do feed do portal.
struct InstagramGalleryView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Namespace private var zoom
    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                content
            }
            .padding(16)
        }
        .background(FSYBackground())
        .navigationTitle("Instagram")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.loadInstagram(force: true) }
        .task { await model.loadInstagram() }
        .navigationDestination(for: String.self) { id in
            if let post = model.instagramPosts.first(where: { $0.id == id }) {
                InstagramPostView(post: post).zoomDestination(id: id, in: zoom)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "camera.fill")
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(Circle().fill(Color(hex: 0xFC4E6D)))
                .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: 2))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("@\(Instagram.officialHandle)").font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                Text("Perfil oficial da sessão").font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
            }
            Spacer(minLength: 8)
            Button("Abrir perfil") { openURL(Instagram.officialURL) }
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: 44)
        }
        .fsyCard(padding: 14)
    }

    private var skeleton: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(0..<6, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(FSYPalette.surface.opacity(0.85))
                    .aspectRatio(1, contentMode: .fit)
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(FSYPalette.border.opacity(0.3), lineWidth: 2))
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Carregando publicações do Instagram")
    }

    @ViewBuilder private var content: some View {
        switch model.instagramState {
        case .idle:
            skeleton
        case .loading where model.instagramPosts.isEmpty:
            skeleton
        case .failed(let message) where model.instagramPosts.isEmpty:
            VStack(alignment: .leading, spacing: 12) {
                Label("Instagram indisponível", systemImage: "wifi.exclamationmark").font(FSYFont.title())
                Text(message).font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
                Button("Tentar novamente") { Task { await model.loadInstagram(force: true) } }
                    .buttonStyle(FSYButtonStyle())
                Button("Ver no Instagram") { openURL(Instagram.officialURL) }
                    .buttonStyle(FSYButtonStyle(kind: .outline))
            }
            .fsyCard()
        default:
            if model.instagramPosts.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Nenhuma publicação ainda", systemImage: "photo.on.rectangle").font(FSYFont.title())
                    Text("Quando o perfil oficial publicar, as fotos aparecem aqui.")
                        .font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
                }
                .fsyCard()
            } else {
                if case .failed(let message) = model.instagramState {
                    StatusBanner(text: message, icon: "exclamationmark.triangle.fill", tone: .warning)
                }
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(model.instagramPosts) { post in
                        NavigationLink(value: post.id) {
                            InstagramTile(post: post)
                        }
                        .buttonStyle(FSYPressableCardStyle())
                        .zoomSource(id: post.id, in: zoom)
                    }
                }
            }
        }
    }
}

/// Miniatura quadrada com selo de vídeo/carrossel e o começo da legenda.
struct InstagramTile: View {
    let post: InstagramPost
    var compact = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: compact ? 14 : 18, style: .continuous)
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                AsyncImage(url: post.imageURL, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill()
                    case .failure: Image(systemName: "photo").font(.title).foregroundStyle(FSYPalette.muted)
                    default: FSYPalette.parchment
                    }
                }
            }
            .clipShape(shape)
            .overlay(alignment: .topTrailing) { MediaBadge(type: post.mediaType).padding(6) }
            .overlay(shape.strokeBorder(FSYPalette.border, lineWidth: 2))
            .background(shape.fill(FSYPalette.depth).offset(x: 3, y: 3))
            .accessibilityElement()
            .accessibilityLabel(accessibilityText)
            .accessibilityAddTraits(.isButton)
    }

    private var accessibilityText: String {
        let kind = switch post.mediaType {
        case .video: "Vídeo"
        case .carousel: "Carrossel de fotos"
        case .image: "Foto"
        }
        let summary = post.caption.isEmpty ? "sem legenda" : String(post.caption.prefix(120))
        return "\(kind) do Instagram: \(summary)"
    }
}

private struct MediaBadge: View {
    let type: InstagramPost.MediaType

    var body: some View {
        switch type {
        case .image: EmptyView()
        case .video: badge("play.fill")
        case .carousel: badge("square.on.square.fill")
        }
    }

    private func badge(_ icon: String) -> some View {
        Image(systemName: icon)
            .font(.caption.weight(.bold))
            .foregroundStyle(FSYPalette.fixedInk)
            .padding(6)
            .background(Circle().fill(FSYPalette.sunshine))
            .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: 1.5))
            .accessibilityHidden(true)
    }
}

/// Detalhe: foto com zoom (pinça, arrasto e toque duplo), legenda completa com links e publicação original.
struct InstagramPostView: View {
    let post: InstagramPost
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var captionExpanded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ZoomableImage(url: post.imageURL)
                    .aspectRatio(1, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(FSYPalette.border, lineWidth: 2))

                if let note = mediaNote {
                    Label(note, systemImage: post.mediaType == .video ? "play.rectangle.fill" : "square.on.square.fill")
                        .font(FSYFont.body())
                        .foregroundStyle(FSYPalette.ink)
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("@\(post.authorHandle)").font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                        Spacer()
                        if let date = post.publishedAt {
                            Text(date.formatted(.dateTime.day().month(.wide).year().locale(Locale(identifier: "pt_BR"))))
                                .font(.footnote).foregroundStyle(FSYPalette.muted)
                        }
                    }
                    if post.caption.isEmpty {
                        Text("Publicação sem legenda.").font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
                    } else {
                        CaptionText(text: post.caption)
                            .lineLimit(captionExpanded ? nil : 5)
                            .fixedSize(horizontal: false, vertical: true)
                        if Instagram.isLongCaption(post.caption) {
                            Button(captionExpanded ? "Mostrar menos" : "Ler legenda completa") {
                                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) { captionExpanded.toggle() }
                            }
                            .font(.subheadline.weight(.semibold))
                            .frame(minHeight: 44)
                        }
                    }
                }
                .fsyCard()

                Button {
                    openURL(post.postURL)
                } label: {
                    Label("Abrir publicação no Instagram", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(FSYButtonStyle())
            }
            .padding(16)
        }
        .background(FSYPalette.background.ignoresSafeArea())
        .navigationTitle("Publicação")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: captionExpanded)
    }

    private var mediaNote: String? {
        switch post.mediaType {
        case .video: "Vídeo: esta é a capa. Abra no Instagram para assistir."
        case .carousel: "Carrossel: esta é a primeira foto. Veja todas no Instagram."
        case .image: nil
        }
    }
}

/// Legenda integral com links, @menções e #hashtags tocáveis (mesmas regras do portal; sem HTML).
struct CaptionText: View {
    let text: String

    var body: some View {
        Text(attributed)
            .font(FSYFont.body())
            .foregroundStyle(FSYPalette.ink)
            .tint(FSYPalette.link)
            .textSelection(.enabled)
    }

    private var attributed: AttributedString {
        var result = AttributedString()
        for token in Instagram.tokenize(text) {
            var part = AttributedString(token.value)
            if let url = token.url, token.kind != .text {
                part.link = url
                part.font = FSYFont.body().weight(.semibold)
            }
            result.append(part)
        }
        return result
    }
}

/// Imagem com zoom: pinça até 4×, arrasto quando ampliada e toque duplo alterna 1×/2,5×.
private struct ZoomableImage: View {
    let url: URL
    @State private var scale: CGFloat = 1
    @State private var committedScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var committedOffset: CGSize = .zero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .scaleEffect(scale)
                        .offset(offset)
                        .gesture(magnify(in: geometry.size).simultaneously(with: drag(in: geometry.size)))
                        .onTapGesture(count: 2) { toggleZoom() }
                        .accessibilityLabel("Foto da publicação")
                        .accessibilityHint("Toque duas vezes para ampliar ou reduzir.")
                        .accessibilityZoomAction { action in
                            setScale(action.direction == .zoomIn ? min(scale + 1, 4) : max(scale - 1, 1))
                        }
                case .failure:
                    VStack(spacing: 8) {
                        Image(systemName: "photo").font(.largeTitle)
                        Text("A imagem não carregou.").font(FSYFont.body())
                    }
                    .foregroundStyle(FSYPalette.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                default:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).background(FSYPalette.parchment)
                }
            }
        }
        .clipped()
    }

    private func magnify(in size: CGSize) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in scale = min(max(committedScale * value.magnification, 1), 4) }
            .onEnded { _ in
                committedScale = scale
                if scale <= 1.01 { setScale(1) } else { clampOffset(in: size) }
            }
    }

    private func drag(in size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: scale > 1 ? 0 : 10_000)
            .onChanged { value in
                offset = CGSize(width: committedOffset.width + value.translation.width,
                                height: committedOffset.height + value.translation.height)
            }
            .onEnded { _ in clampOffset(in: size) }
    }

    private func clampOffset(in size: CGSize) {
        let maxX = size.width * (scale - 1) / 2
        let maxY = size.height * (scale - 1) / 2
        withAnimation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.85)) {
            offset = CGSize(width: min(max(offset.width, -maxX), maxX), height: min(max(offset.height, -maxY), maxY))
        }
        committedOffset = offset
    }

    private func toggleZoom() {
        setScale(scale > 1 ? 1 : 2.5)
    }

    private func setScale(_ value: CGFloat) {
        withAnimation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.8)) {
            scale = value
            if value == 1 { offset = .zero }
        }
        committedScale = value
        if value == 1 { committedOffset = .zero }
    }
}

extension View {
    /// Transição de zoom da miniatura para o detalhe (iOS 18+); no iOS 17, a transição padrão da pilha.
    @ViewBuilder func zoomSource(id: String, in namespace: Namespace.ID) -> some View {
        if #available(iOS 18.0, *) { matchedTransitionSource(id: id, in: namespace) } else { self }
    }

    @ViewBuilder func zoomDestination(id: String, in namespace: Namespace.ID) -> some View {
        if #available(iOS 18.0, *) { navigationTransition(.zoom(sourceID: id, in: namespace)) } else { self }
    }
}
