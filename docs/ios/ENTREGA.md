# Entrega iOS — primeira versão (20/10/2026)

Implementado inteiramente por **Claude Opus 5.5** (`claude-opus-5-5`), sem subagentes. Base: checkout `065a9a3`, branch `feat/retomada-seguranca-ux-2026-10`. A primeira entrega criou `ios/` e `docs/ios/`; o lote posterior também corrigiu o tema no web e nas referências vigentes, conforme seção abaixo. Versionamento e publicação pelo root após a entrega do executor.

## Resumo do estado

| Etapa | Estado | Evidência |
| --- | --- | --- |
| Projeto Xcode criado e editável | ✅ | `ios/FSY.xcodeproj`, alvos `FSY` + `FSYWidgetsExtension`, esquema compartilhado |
| Testes de lógica | ✅ 29/29 | `ios/Tests/run-logic-tests.sh` (macOS, sem simulador) |
| Build iOS Debug sem assinatura | ✅ | Xcode 26.3 (17C529), SDK iphoneos26.2, `-jobs 1`, `CODE_SIGNING_ALLOWED=NO`: `BUILD SUCCEEDED`, 0 erros, 0 avisos |
| Configuração local | ✅ | `ios/Config/Local.xcconfig` (ignorado): chave **publicável** do portal obtida dos recursos públicos do site com autorização do humano, validada (`sb_publishable_`, 46 caracteres, `auth/v1/settings` do projeto `vhbmnnpgftrrovjtvbzo` → HTTP 200) sem exibir o valor; ocorrências da chave no log de build: 0 |
| Build assinado | ✅ | Personal Team existente `K4A892MU5J` (único Team no Xcode), assinatura automática, `-allowProvisioningUpdates`, `-jobs 1`: `BUILD SUCCEEDED`, 0 erros, 0 avisos. O Xcode gerou 1 certificado Apple Development; perfil de desenvolvimento expira em **28/10/2026** (Team gratuito: 7 dias). App `br.com.fsyrp2.app` e extensão `br.com.fsyrp2.app.widgets` assinados com o Team |
| Instalação no iPhone | ✅ | `devicectl device install app` → instalado (`bundleID: br.com.fsyrp2.app`) |
| Abertura no iPhone | ✅ observada no aparelho espelhado | Após a correção, marcos de fase mostram abertura dissolvendo em 1,18 s no cold start das 22h47. Root observou às 22h48 a interface de autenticação do Google aberta sobre o app pelo Espelhamento do iPhone, confirmando saída da abertura. O login foi deixado com o humano; teste autenticado ainda não confirmado |
| Teste real autenticado | ⛔ não feito | sem login real controlado; nenhuma credencial de teste foi usada |
| Build Release | não executado | apenas Debug foi compilado |

Estado do iPhone comprovado às 21h14 e reconferido por mim depois: `developerModeStatus=enabled`, `pairingState=paired`, `tunnelState=connected`, `ddiServicesAvailable=true`; o Xcode lista o destino `iPhone Ca` (`00008030-001115891446402E`). Reconferido antes da instalação (`developerModeStatus=enabled`, `paired`, `connected`, `ddiServicesAvailable=true`).

## Correção da abertura e tema (20/10/2026, 22h40–22h50)

**Sintoma relatado:** app instalado e processo rodando (root, 22h37), mas a tela não saía da abertura.

**Causa comprovada (não a hipótese inicial):** instrumentei marcos de fase (`PhaseLog`, `os.Logger`, só nomes de etapa) e relancei a frio com `devicectl … --console`. Build antigo, 22h44:
`bootstrap: início` → `sem sessão, limpando` → limpeza de lembretes/Atividades ao Vivo/widgets **concluída em 44 ms** → `bootstrap: entrada` (fase `.signedOut`) → `abertura: animação mínima concluída` em +1,28 s → **`abertura: dissolvendo` nunca registrado**. A hipótese de serviços de notificação/Live Activity presos foi descartada por essa evidência. O defeito estava em `LaunchTransitionView`: `ready` era um `let`; a `.task` da animação capturou a cópia da view de antes da fase mudar, e ao terminar leu `ready == false`. O `onChange(of: ready)` já tinha disparado antes, com `minimumElapsed == false`. Assim a sobreposição de abertura nunca saía, com a tela de entrada pronta por baixo.

**Correção:**
- `AppRootView` decide a saída lendo `model.phase` a cada renderização (`showIntro = !introAnimated || phase == .launching`); `LaunchTransitionView` só avisa que a animação mínima terminou.
- Robustez pedida no brief: `bootstrap()` idempotente e decide a fase só com configuração + Keychain (síncronos). `clearLocalState()` apaga Keychain, cache e memória na hora; lembretes, Atividades ao Vivo e widgets são limpos numa tarefa encadeada (`deviceCleanup`), fora do caminho da interface. Reagendamentos posteriores (sincronização pós-atualização, ativar lembretes) aguardam a última limpeza e conferem geração/conta, para que a limpeza da conta anterior não apague nem receba dados da nova. Sincronizar lembretes/widgets/Live Activity não segura mais a atualização. Logout revoga a sessão no servidor em segundo plano, depois de já ter apagado tudo localmente.

**Evidência após a correção (cold start 22h47, `--terminate-existing`):** `bootstrap: entrada` em +7 ms (antes da limpeza opcional, que terminou em +248 ms); `abertura: animação mínima concluída` e `abertura: dissolvendo` em +1,18 s. Mensagens posteriores do sistema (`RBSServiceErrorDomain … Client not entitled`, `usermanagerd`) são ruído do iOS sem relação com o app.

**Limite do executor:** Claude confirmou a saída por logs, sem captura própria. **Verificação visual pelo root:** após o humano liberar Acessibilidade e captura de tela ao Orca Computer Use, root observou o Espelhamento do iPhone: abertura ainda presa às 22h46 antes da atualização; interface de autenticação do Google aberta às 22h48 depois da atualização. O humano iniciou a autenticação; root não preencheu credenciais nem publicou capturas dessa tela. Caminho com sessão salva e dados autenticados ainda não confirmado.

**Tema:** agora exatamente **Alegrar-se em Cristo** (substitui "Alegra-se em Cristo").
- iOS: `ios/Shared/EventIdentity.swift` centraliza nome, tema e escritura; usados em `ThemeLockup` (caixa alta via `uppercased` pt-BR: "ALEGRAR-SE EM / CRISTO"), rótulo VoiceOver, herói do Início, abertura e seu rótulo de acessibilidade.
- Web: `src/lib/event/identity.ts` (alimenta marca, cartões, login/rodapé, carregamento, metadados, manifest/PWA); `public/sw.js` (página offline + cache `fsy-pwa-v3` → `fsy-pwa-v4`, mesma estratégia); comentários de `src/components/brand/FsyStickers.tsx`.
- Docs vigentes: `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/brand-guide-2027.md` (registra a substituição), `docs/manual-funcional-e-design.md`, `docs/ios/README.md`. Históricos preservados com nota de substituição no topo: `docs/auditoria-impeccable-2026-10-20.md`, `docs/plano-implementacao-2026-10-20.md`, `docs/checkpoint-next16-em-andamento.md`, `implementation_plan.md`, `walkthrough.md`.
- `grep -i "alegra-se"` em `src`, `public`, `ios` e docs vigentes: só a nota intencional do brand guide. Nenhum SVG/asset continha o texto. Datas, escritura, lemas, cores e layout inalterados; "Alegrar-se em" tem um caractere a mais, sem conferência visual de quebra de linha.

**Checks deste lote:** testes de lógica iOS 29/29; build assinado serial `-jobs 1` `BUILD SUCCEEDED` (0 erros/avisos); instalação por cima (dados e configuração preservados); relançamento a frio com console acima. Web: `npm run lint` exit 0 e `node --check public/sw.js` OK; sem build Next/PGlite/navegador (CI e publicação com o root). Nenhum commit/push.

## Pendências humanas concretas (em ordem)

1. **Entrar com uma conta real** e seguir o roteiro do [README](README.md#6-roteiro-de-teste-no-aparelho); só então registrar teste autenticado. Root abriu o app às 22h37 de 20/10/2026 (São Paulo); a confiança no desenvolvedor já permite lançamento pelo Mac.
2. **Renovação:** com Team gratuito o perfil vence em 28/10/2026; recompilar/instalar com o mesmo comando renova.
3. Opcional: `fsyrp2://auth-callback` nas Redirect URLs do Supabase para Google; contrato de curtidas; App Group com Team pago ([CONTRATO-WEB.md](CONTRATO-WEB.md)).

## Arquitetura escolhida

**Nativo SwiftUI + REST do Supabase, sem dependências externas.** Sem SDK supabase-swift para evitar resolução de pacotes e builds mais pesados no Mac de 8 GB; os quatro endpoints do Auth e as leituras do PostgREST usam `URLSession` efêmera. O app não é um navegador para o site: telas centrais são nativas e consomem os mesmos dados.

- **Dados:** leituras diretas com o JWT da pessoa; o escopo vem das políticas RLS publicadas (mesmo escopo das APIs web para avisos). Não usa service_role, não cria banco paralelo, não grava nada além da própria sessão de Auth.
- **Por que não as rotas `/api` do portal:** elas reconhecem a sessão só por cookie; o contrato para aceitar Bearer está em CONTRATO-WEB.md. A recuperação de senha usa a rota pública do portal.
- **Módulos não nativos** (gestão, saúde, mídia, logística, galeria/Instagram): abertos em `SFSafariViewController`, com login próprio do site. Sem WebView embutida, sem token em URL, sem bridge JavaScript.
- **Atualização:** ao abrir, ao entrar, ao voltar ao primeiro plano (após 30 s) e manual (puxar). Relógio "agora/próxima" recalcula a cada 30 s sem rede. Sem Realtime e sem sincronização contínua.

## Arquivos

| Caminho | Conteúdo |
| --- | --- |
| `ios/Config/*.xcconfig`, `Local.example.xcconfig` | Configuração pública, Team/Bundle/App Group por arquivo local ignorado |
| `ios/Config/FSY-Info.plist`, `FSYWidgets-Info.plist` | Esquema `fsyrp2`, Live Activities, launch estático, pt-BR |
| `ios/FSY/FSYApp.swift` | Entrada, ciclo de vida, delegado de notificações, raiz |
| `ios/FSY/State/AppModel.swift` | Sessão, renovação de token, atualização, cache, logout/troca de conta, links |
| `ios/FSY/Core/AuthClient.swift` | Senha, cadastro, refresh, logout, Google PKCE, recuperação |
| `ios/FSY/Core/DataClient.swift` | Perfil, companhia, programação, avisos, curtidas próprias |
| `ios/FSY/Core/Keychain.swift`, `AccountCache.swift` | Sessão no Keychain; cópia por conta com proteção de arquivo |
| `ios/FSY/Core/DeviceServices.swift` | Rede, lembretes locais, Live Activity, ponte de widgets |
| `ios/FSY/Core/EventClock.swift`, `DeepLink.swift`, `Models.swift` | Lógica pura testada |
| `ios/FSY/UI/*` | Abertura, Entrada, abas Início/Agenda/Avisos/Perfil, tema |
| `ios/FSYWidgets/FSYWidgets.swift` | Widget "Próxima atividade" e Live Activity (Tela Bloqueada + Dynamic Island) |
| `ios/Shared/*` | Paleta, marca (templo SVG do portal, círculos F·S·Y), calendário, atributos |
| `ios/Tests/*` | Testes de lógica e script |

## Experiência e marca

- Paleta, cartões com borda de 2 pt e profundidade sólida deslocada, pílulas em caixa alta: tokens de `DESIGN.md`/`globals.css`, claro e escuro.
- Marca do templo convertida para SVG a partir de `FsyTempleMark` (quatro cores), sem sombra/gradiente; ícone do app a partir de `public/icons/icon-512.png` (ampliado para 1024 px, sem alfa — substituir por arte 1024 original antes de publicação).
- Títulos em serifada do sistema (New York) como substituto de Cinzel/Cormorant, que não existem como arquivos no repositório; corpo em SF. Todos por estilo dinâmico (Dynamic Type).
- Abertura: launch estático `#0B1528` → círculos F·S·Y em mola → dissolve. Seletor de dias com `matchedGeometryEffect`, expansão de cartões, pulso do "Acontecendo agora", contagem com `numericText`, feedback tátil em seleção/sucesso/erro. Reduzir Movimento remove escalas, deslocamentos e pulso.
- Alvos de toque ≥ 44 pt, rótulos VoiceOver em pt-BR, prioridade dos avisos por texto + ícone + cor, layout que quebra pílulas no iPhone SE.

## Segurança e privacidade

- Sessão (access/refresh token) só no Keychain, `AfterFirstUnlockThisDeviceOnly`. Nunca em log, URL, UserDefaults ou App Group.
- Cache em Application Support por hash da conta, `completeFileProtection`, fora do backup: perfil (sem telefone), companhia, programação, avisos, curtidas próprias. **Nenhum dado médico.**
- Logout e troca de conta: revoga a sessão local no Auth, apaga Keychain, todo o cache, lembretes pendentes/entregues, Live Activities e snapshot dos widgets; reinicia a `URLSession`; respostas atrasadas de outra conta são descartadas por geração.
- Sessão expirada (refresh recusado) → volta à entrada com aviso. Conta suspensa (`suspended_at`) → logout com aviso. Sem rede → mantém sessão e cópia local.
- Deep links: só `fsyrp2://inicio|agenda|avisos|perfil`, `item` só UUID em agenda/avisos; o resto é ignorado. Sem bridge aberta a terceiros.
- Widgets/Live Activity: título, local, categoria e horários da programação geral; sem identidade, companhia, contatos ou saúde.
- Manifesto de privacidade incluído (UserDefaults, sem rastreamento).

## Recursos e estado real

| Recurso | Estado |
| --- | --- |
| Entrar/cadastrar/recuperar com contas do portal | Implementado e compilado; não testado contra o Supabase real |
| Google | Implementado (PKCE + sessão do sistema); depende da Redirect URL e do modo Teste — não funcional até isso |
| Início, Agenda, Avisos, Perfil com dados reais | Implementado e compilado; sem teste autenticado |
| Offline com cópia por conta | Implementado |
| Lembretes locais com ação "Ver na agenda" | Implementado; permissão pedida só ao ativar |
| Live Activity (Tela Bloqueada; Dynamic Island em modelos compatíveis) | Implementado; atualiza com o app em primeiro plano, contador avança pelo sistema; sem push |
| Widget "Próxima atividade" | Implementado; com Team gratuito mostra "Abra o app" (sem App Group) |
| Curtir aviso | Somente leitura (contrato web pendente) |
| Push remoto, Realtime, Universal Links | Não implementados |

## Verificações executadas

- `plutil -lint` em plists, entitlements, manifesto de privacidade e `project.pbxproj`: OK.
- `ios/Tests/run-logic-tests.sh`: 29 testes OK (fuso de São Paulo, agora/próxima igual ao portal, intervalo sem evento inventado, allowlist de links, decodificação de avisos/perfil do PostgREST, cargos).
- Build Debug iphoneos sem assinatura, serial: sucesso; o `.app` contém `PlugIns/FSYWidgetsExtension.appex`, `Info.plist` com hosts públicos substituídos e `NSSupportsLiveActivities`.
- Primeiro build com assinatura (antes do Team): falha por falta de Team. Depois da configuração local: build assinado, instalação e tentativa de abertura registrados na tabela acima.
- Busca por `service_role`/`sb_secret` no código iOS: só em comentários de proibição.
- **Não aplicáveis:** `npm run lint`/`build`/testes web — nenhum arquivo web alterado. Simulador e XCTest não executados, conforme o brief.
