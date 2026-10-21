import Foundation

// Testes da lógica pura (datas da sessão, agora/próxima, allowlist de links, decodificação do PostgREST).
// Rodam no macOS com `Tests/run-logic-tests.sh`, sem simulador.

var failures = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String, line: Int = #line) {
    if condition() { print("ok   \(message)") } else { failures += 1; print("FAIL \(message) (linha \(line))") }
}

func item(_ id: String, day: String, date: String, start: String, end: String, title: String = "Atividade") -> ScheduleItem {
    ScheduleItem(id: id, day: day, date: date, title: title, startTime: start, endTime: end,
                 location: "Campus", description: nil, category: "Geral", isHighlight: false)
}

// Datas em America/Sao_Paulo (UTC−3 em fevereiro de 2027, sem horário de verão).
let opening = EventCalendar.date(day: "2027-02-06", time: "08:00")!
check(Timestamp.format(opening) == "2027-02-06T11:00:00Z", "08:00 em São Paulo = 11:00 UTC")
check(EventCalendar.date(day: "2027-02-06", time: "--") == nil, "término \"--\" não vira horário")
check(EventCalendar.date(day: "2027-02-06", time: "25:00") == nil, "hora inválida recusada")
check(EventCalendar.date(day: "2027-02-06", time: "07:30:00") != nil, "aceita HH:mm:ss")

let items = [
    item("a", day: "dia0", date: "2027-02-05", start: "09:00", end: "10:00", title: "Equipe"),
    item("b", day: "dia1", date: "2027-02-06", start: "08:00", end: "09:00", title: "Abertura"),
    item("c", day: "dia1", date: "2027-02-06", start: "09:30", end: "--", title: "Sem término"),
    item("d", day: "dia1", date: "2027-02-06", start: "10:00", end: "11:00", title: "Oficina"),
]

let before = EventClock.moment(items: items, now: opening.addingTimeInterval(-86400))
check(before.phase == .before && before.next?.id == "b", "antes: próxima é a primeira fora do Dia Zero")
check(before.dayLabel == "Em Breve • 06 a 10 Fev 2027", "rótulo antes do evento igual ao portal")

let during = EventClock.moment(items: items, now: opening.addingTimeInterval(30 * 60))
check(during.current?.id == "b" && during.next?.id == "c", "durante: atual e próxima")
check(during.dayLabel == "1º Dia (Sábado 06/02)", "rótulo do dia")

let gap = EventClock.moment(items: items, now: opening.addingTimeInterval(95 * 60))
check(gap.current == nil && gap.next?.id == "d", "intervalo/sem término não inventa evento em andamento")

let after = EventClock.moment(items: items, now: EventCalendar.participantsEnd.addingTimeInterval(1))
check(after.phase == .after && after.next == nil, "depois: edição concluída")
check(EventClock.daysUntilStart(from: EventCalendar.date(day: "2027-02-01", time: "23:00")!) == 5, "contagem regressiva em dias da sessão")

// Allowlist de deep links
let uuid = "3F2504E0-4F89-11D3-9A0C-0305E82C3301"
check(DeepLink(url: URL(string: "fsyrp2://agenda?item=\(uuid)")!) == DeepLink(tab: .agenda, itemID: uuid.lowercased()), "agenda com item válido")
check(DeepLink(url: URL(string: "fsyrp2://avisos")!) == DeepLink(tab: .avisos), "aba simples")
check(DeepLink(url: URL(string: "fsyrp2://admin")!) == nil, "host fora da allowlist")
check(DeepLink(url: URL(string: "https://agenda?item=\(uuid)")!) == nil, "outro esquema")
check(DeepLink(url: URL(string: "fsyrp2://agenda?item=../../x")!) == nil, "item não UUID")
check(DeepLink(url: URL(string: "fsyrp2://agenda?token=abc")!) == nil, "parâmetro desconhecido")
check(DeepLink(url: URL(string: "fsyrp2://perfil?item=\(uuid)")!) == nil, "item só em agenda/avisos")
check(DeepLink(url: URL(string: "fsyrp2://agenda/extra")!) == nil, "caminho extra")
check(DeepLink(url: URL(string: "fsyrp2://auth-callback?code=1")!) == nil, "retorno OAuth não vira navegação")
check(DeepLink(tab: .agenda, itemID: "abc").url.absoluteString == "fsyrp2://agenda?item=abc", "monta URL")

// Decodificação no formato do PostgREST
let json = """
[{"id":"\(uuid)","title":"Aviso","content":"Texto","priority":"urgente","category":"Geral__LIKES__[\\"x\\"]",
  "created_at":"2026-10-20T12:34:56.123456+00:00","target_company_id":null,"profiles":null},
 {"id":"x2","title":"T","content":"C","priority":"alta","category":null,"created_at":"2026-10-20T12:00:00+00:00",
  "target_company_id":"cia-1","profiles":{"full_name":"Coordenação","role":"coordenador"}}]
""".data(using: .utf8)!
let announcements = try! JSONDecoder().decode([Announcement].self, from: json)
check(announcements[0].priority == .urgent && announcements[1].priority == .important, "prioridades legadas")
check(announcements[0].category == "Geral" && announcements[1].category == "Geral", "categoria sem sufixo legado")
check(announcements[0].createdAt != nil, "timestamptz com microssegundos")
check(announcements[1].author?.role == .coordenador, "autor embutido")
let roundTrip = try! JSONDecoder().decode([Announcement].self, from: JSONEncoder().encode(announcements))
check(roundTrip == announcements, "cache preserva avisos")

let profileJSON = #"[{"id":"u1","full_name":"Ana Souza","role":"papel_novo","company_id":"cia-1","stake":null,"room":"12","suspended_at":null}]"#
let profiles = try! JSONDecoder().decode([Profile].self, from: Data(profileJSON.utf8))
check(profiles[0].role == .jovem && !profiles[0].role.isStaff, "cargo desconhecido = menor privilégio")
check(profiles[0].firstName == "Ana" && !profiles[0].isSuspended, "perfil")
check(UserRole.logistica.isManager && UserRole.coordenador.isManager && UserRole.casalDiretor.isManager, "gestão equivalente")

// Instagram: contrato do portal, mídia, URLs seguras e legenda
let feedJSON = #"""
{"data":[
 {"id":"1","imageUrl":"https://cdn.behold.pictures/a.jpg","caption":" Olá @fsy_rp #FSY2027 https://fsy.test/mapa. ","publishedAt":"2026-10-01T12:00:00+0000","authorHandle":"fsy_ribeiraopreto","postUrl":"https://www.instagram.com/p/abc/","mediaType":"VIDEO"},
 {"id":"2","imageUrl":"http://inseguro/a.jpg","caption":"","publishedAt":null,"authorHandle":"x","postUrl":"https://www.instagram.com/p/def/","mediaType":"IMAGE"},
 {"id":"3","imageUrl":"https://cdn.behold.pictures/c.jpg","caption":"c","publishedAt":"2026-10-02T10:00:00.000Z","authorHandle":"x","postUrl":"javascript:alert(1)","mediaType":"CAROUSEL_ALBUM"}
],"source":"behold","beholdConnected":true}
"""#
let feed = try! JSONDecoder().decode(InstagramFeedResponse.self, from: Data(feedJSON.utf8))
check(feed.data.map(\.id) == ["1", "3"], "imagem sem HTTPS descartada sem derrubar o feed")
check(feed.data[0].mediaType == .video && feed.data[1].mediaType == .carousel, "tipos de mídia")
check(feed.data[0].publishedAt != nil && feed.data[1].publishedAt != nil, "datas +0000 e ISO com Z")
check(feed.data[0].caption.hasPrefix("Olá"), "legenda integral aparada")
check(feed.data[1].postURL == Instagram.officialURL, "link fora do Instagram cai no perfil oficial")
let tokens = Instagram.tokenize(feed.data[0].caption)
check(tokens.map(\.kind) == [.text, .mention, .text, .hashtag, .text, .link, .text], "tokens da legenda")
check(tokens.first { $0.kind == .link }?.value == "https://fsy.test/mapa", "ponto final fora do link")
check(tokens.map(\.value).joined() == feed.data[0].caption, "legenda preservada")
check(!Instagram.tokenize("javascript:alert(1) www.x.com").contains { $0.kind == .link }, "só http(s) vira link")
check(Instagram.isLongCaption(String(repeating: "a", count: 200)) && !Instagram.isLongCaption("curta"), "legenda longa")

// Painel nativo: módulos por cargo (espelho de ROLE_GROUPS; quem autoriza é o servidor)
check(AdminModule.available(for: .logistica) == AdminModule.allCases, "logística vê todos os módulos (gestão plena)")
check(AdminModule.available(for: .coordenador) == AdminModule.available(for: .casalDiretor), "gestão equivalente")
check(AdminModule.available(for: .jovem).isEmpty, "jovem sem painel")
check(AdminModule.available(for: .medico) == [.health, .inclusion], "equipe multidisciplinar: saúde e inclusão")
check(AdminModule.available(for: .midia) == [.media], "mídia só mídia")
check(AdminModule.available(for: .consultor) == [.announcements], "consultor só comunicados")

// Contratos das APIs (fixtures mínimas, sem dados reais)
let accountsJSON = #"""
{"data":[{"id":"a1","full_name":"Ana","email":"ana@x.test","role":"logistica","company_id":null,"providers":["google"],"has_password":false,"suspended":false,"status":"ativo","last_sign_in_at":"2026-10-20T12:00:00.123Z"},
 {"id":"a2","full_name":null,"role":"papel_inexistente","status":"suspenso","suspended":true}],
 "total":2,"page":1,"per_page":50,"permissions":{"a1":["edit","role","acao_nova"],"a2":[]}}
"""#
let accountList = try! JSONDecoder().decode(AccountList.self, from: Data(accountsJSON.utf8))
check(accountList.data.count == 2 && accountList.total == 2, "lista de contas")
check(accountList.permissions["a1"] == [.edit, .role], "ações vêm do servidor; desconhecidas ignoradas")
check(accountList.permissions["a2"]?.isEmpty == true, "sem ações permitidas")
check(accountList.data[1].role == nil && accountList.data[1].fullName == "Sem nome" && accountList.data[1].statusLabel == "Suspensa", "conta parcial")
check(accountList.data[0].lastSignInAt != nil, "data com frações")

let overviewJSON = #"{"total_youth":3,"youth_with_company":"2","medical_records":5,"recent_announcements":[{"id":"x","title":"T","priority":"urgent","category":"Geral__LIKES__[]","created_at":"2026-10-20T10:00:00+00:00"}]}"#
let overviewData = try! JSONDecoder().decode(AdminOverview.self, from: Data(overviewJSON.utf8))
check(overviewData.totalYouth == 3 && overviewData.youthWithCompany == 2 && overviewData.totalPhotos == 0, "visão geral tolerante (número como texto, campo ausente)")
check(overviewData.recent.first?.category == "Geral", "categoria sem sufixo legado")

let busJSON = #"{"data":[{"id":"b1","bus_number":"3","stake_city":"Franca","driver_name":"José","capacity":"46","passengers_count":50,"status":"chegou","notes":null}]}"#
let bus = try! JSONDecoder().decode(DataEnvelope<[TransportBus]>.self, from: Data(busJSON.utf8)).data[0]
check(bus.capacity == 46 && bus.occupancy == 1 && bus.statusLabel == "Chegou" && bus.departureCityTime == "--", "ônibus")

let medicalJSON = #"{"data":[{"id":"m1","full_name":"Participante Teste","allergies":"","is_severe_allergy":null,"bishop_name":"Bispo","contact_2_phone":null,"emergency_contact_alt_phone":"{}"}]}"#
let record = try! JSONDecoder().decode(DataEnvelope<[MedicalRecord]>.self, from: Data(medicalJSON.utf8)).data[0]
check(record.fullName == "Participante Teste" && !record.hasAllergy && !record.severeAllergy && record["bishop_name"] == "Bispo", "ficha parcial")
check(record.fields["emergency_contact_alt_phone"] == nil, "JSON interno de contatos não exposto")

let inclusionJSON = #"{"data":{"id":"c1","full_name":"P","phase":"entrevistas","version":3,"contacts":{"parent":{"name":"Mãe","phone":"1"},"bishop":null},"interviews":[{"id":"i1","scheduled_at":"2027-01-10T15:00:00-03:00","participants":"Equipe","status":"agendada","summary":""}],"history":[]}}"#
let inclusion = try! JSONDecoder().decode(DataEnvelope<InclusionCase>.self, from: Data(inclusionJSON.utf8)).data
check(inclusion.version == 3 && inclusion.phaseLabel == "Entrevistas" && inclusion.parent.name == "Mãe" && inclusion.bishop.name.isEmpty, "inclusão com contato ausente")
check(inclusion.interviews.first?.scheduledAt != nil, "entrevista com deslocamento")

let companiesJSON = ##"{"companies":[{"id":"cia-1","name":"Néfi","color":"#FC4E6D","counselors":["A"],"youth_count":12,"counselor_profiles":[{"id":"p1","full_name":"A","company_id":"cia-1"}]},{"id":"cia-2","name":"Alma","color":"azul"}],"all_counselors":[]}"##
let companies = try! JSONDecoder().decode(CompaniesPayload.self, from: Data(companiesJSON.utf8))
check(companies.companies[0].hexColor == 0xFC4E6D && companies.companies[1].hexColor == nil && companies.companies[0].counselorProfiles.count == 1, "companhias")

let emptyAudit = try! JSONDecoder().decode(DataEnvelope<[CounselorAuditEntry]>.self, from: Data(#"{"data":[]}"#.utf8))
check(emptyAudit.data.isEmpty, "lista vazia")

// Erros do servidor: mensagem pt-BR só quando segura; 401 encerra sessão
check(PortalAPI.error(status: 409, data: Data(#"{"error":"Esta é a última conta administrativa habilitada."}"#.utf8)) == .message("Esta é a última conta administrativa habilitada."), "mensagem do servidor")
check(PortalAPI.error(status: 401, data: Data(#"{"error":"x"}"#.utf8)) == .unauthorized, "401 é sessão")
check(PortalAPI.error(status: 500, data: Data(#"{"error":"relation medical_records does not exist"}"#.utf8)) == .server(500), "500 não expõe detalhe interno")
check(PortalAPI.error(status: 403, data: Data("<html>".utf8)) == .forbidden, "corpo inesperado")

// Corpo JSON: null explícito limpa campo; vazio vira null
let encoded = String(data: try! JSONEncoder().encode(JSONValue.object(["company_id": .null, "room": .text("  "), "name": .text(" Ana ")])), encoding: .utf8)!
check(encoded.contains(#""company_id":null"#) && encoded.contains(#""room":null"#) && encoded.contains(#""name":"Ana""#), "null explícito")

// Leitura mais recente vence: resposta antiga não sobrescreve o recarregamento pós-salvar
@MainActor func sequencingTest() async {
    let resource = AdminResource<String>()
    var release: CheckedContinuation<Void, Never>?
    let stale = Task { @MainActor in
        await resource.load {
            await withCheckedContinuation { release = $0 }
            return "antigo"
        }
    }
    while release == nil { await Task.yield() }
    await resource.load { "salvo" }
    check(resource.value == "salvo" && resource.isLoading == false, "recarregamento aplicado")
    release?.resume()
    await stale.value
    check(resource.value == "salvo", "resposta antiga descartada")
    check(resource.isLoading == false, "carregamento encerrado")

    await resource.load { throw APIError.message("Falhou") }
    check(resource.value == "salvo" && resource.error == "Falhou", "erro mantém o último dado")
    await resource.load { throw CancellationError() }
    check(resource.error == "Falhou", "cancelamento não vira erro")
}
await sequencingTest()

print(failures == 0 ? "\nTodos os testes passaram." : "\n\(failures) falha(s).")
exit(failures == 0 ? 0 : 1)
