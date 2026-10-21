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

print(failures == 0 ? "\nTodos os testes passaram." : "\n\(failures) falha(s).")
exit(failures == 0 ? 0 : 1)
