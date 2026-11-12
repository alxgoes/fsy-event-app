# Brief Gemini — ANDROID (11/11/2026)

Repositório `D:\Projects\PC\FSY\fsy-event-app`, branch `feat/whatsapp-fotos-enquadramento-2026-11`. App Kotlin/Compose em `android/`, versão atual 1.2.1 (4).
Leia primeiro, inteiro: `docs/atualizacao-2026-11-11/ARQUITETURA.md` (contrato — siga à risca), `DESIGN.md`, `docs/android/*.md`.

## Limites
- Edite **somente** `android/**` e `docs/android/**`. Outro agente edita `src/**`/`tests/**` em paralelo: não toque (o contrato da API está em ARQUITETURA.md).
- **Nenhum git de escrita.** Não instale Android Studio/emulador/drivers. Disco C: quase cheio — caches no D:. Uma tarefa Gradle por vez.
- pt-BR, sem jargão. Alvos ≥ 48 dp. Jovem nunca vê nada de gestão/consultor nem itens de agenda `Equipe`/`dia0`.

## Ambiente
```bash
export JAVA_HOME="C:/Program Files/Java/jdk-21" GRADLE_USER_HOME=/d/Projects/PC/FSY/_ferramentas/gradle-home
cd /d/Projects/PC/FSY/fsy-event-app/android
./gradlew --no-daemon :app:compileDebugKotlin
./gradlew --no-daemon testDebugUnitTest      # inclui capturas Robolectric em app/build/outputs/visual-qa/
./gradlew --no-daemon assembleDebug lintDebug
```
Harness visual: `app/src/debug/**/VisualQaActivity.kt` + `app/src/testDebug/**/VisualQaTest.kt` (pode estender).

## Tarefas
1. **Foto de perfil** — a causa no servidor já foi corrigida (ARQUITETURA.md item 1). No app: revisar o fluxo ponta a ponta
   (`PortalApiClient` foto, `FsyAppState` foto, `MoreScreen`, `FsyAvatar`, `PhotoReviewsSection`) e garantir que:
   a foto aprovada aparece em Mais, no Início e onde houver avatar; após enviar, o estado atualiza sem reabrir o app; URL assinada expirada
   recarrega **uma vez** (sem laço de tentativas quando `onImageError` → `refreshProfilePhoto` devolve outra URL que também falha);
   erro 401/403 mostra mensagem útil em pt-BR em vez de ficar mudo; `refreshProfilePhoto` roda ao abrir o app e ao voltar ao primeiro plano
   (a foto trocada no site aparece no app e vice-versa). Testes unitários para o estado da foto.
2. **Link do WhatsApp da companhia** — item 2 de ARQUITETURA.md, seção Android: cliente, estado, cache offline, botão do jovem (Início e Mais),
   bloco de edição no painel do consultor e no módulo Companhias da gestão, validação da URL antes do `Intent.ACTION_VIEW`.
   Fixtures no harness (jovem com link, jovem sem link, consultor editando, gestão com companhia sem consultor) e capturas.
3. **Enquadramento — auditoria completa** (ARQUITETURA.md item 5):
   - Bug conhecido primeiro: `ui/screens/admin/RegistrationsAdminScreen.kt` (importar planilha / baixar fichas em PDF): rótulo de botão fora da caixa
     em tela estreita. Corrigir a causa (altura fixa, `Row` sem quebra, `maxLines = 1` sem espaço) e revisar todos os botões dessa tela.
   - Depois todas as telas: Auth, Início, Agenda, Avisos, Mais, Notificações, Galeria, painel do consultor, fotos para aprovar, e cada módulo da gestão
     (`ui/screens/admin/*`), além dos widgets. Procurar: `height(` fixa em contêiner com texto, `Row` de botões sem `FlowRow`/empilhamento,
     `Text` sem `weight(1f)`/`maxLines`+`overflow` ao lado de ícones, `OutlinedButton`/`Button` com rótulos longos.
   - Adicionar ao `VisualQaTest` uma matriz de larguras **320, 360, 393, 412 dp** × fonte **1.0, 1.3, 2.0** × claro/escuro para as telas principais
     e para Inscrições, e um teste de semântica que falha quando o texto de um botão é cortado/ultrapassa os limites do botão
     (ex.: comparar bounds do nó de texto com os do pai clicável, ou `TextLayoutResult.hasVisualOverflow`).
   - Olhar os PNGs gerados e corrigir o que estiver feio, mesmo que o teste passe.
4. Versão **1.2.2**, `versionCode` 5. Atualizar `docs/android/` (resumo do que mudou).
5. Copiar os PNGs finais relevantes para `D:\Projects\PC\FSY\_trabalho\capturas\android-2026-11-11\`.

## Entrega
`docs/android/RELATORIO-2026-11-11.md` (até 500 palavras): o que mudou por tela, lista dos problemas de enquadramento achados e corrigidos
(tela, largura, fonte), resultado honesto de compile/test/assemble/lint, e o que não foi possível verificar. Não diga que passou sem ter rodado.
