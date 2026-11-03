# Brief — App Android (Kotlin/Compose) · redesign nov/2026

Você é o engenheiro/designer do app Android do FSY Sessão Ribeirão Preto 2.
Repositório: `D:\Projects\PC\FSY\fsy-event-app` (branch `feat/redesign-simplificacao-2026-11`).

## Regras de convivência (obrigatórias)
- Edite **somente** `android/**` e `docs/android/**`. Outro agente está editando o site (`src/**`) ao mesmo tempo.
- **Nenhum comando git de escrita** (commit, checkout, reset, stash, clean, restore). O orquestrador faz os commits.
- Não instale Android Studio, emulador, drivers; não mude configurações do Windows. O disco C: está quase cheio: caches ficam no D:.
- Leia antes: `docs/redesign-2026-11/ESPECIFICACAO.md`, `DESIGN.md` (autoridade visual), `docs/android/*.md`.

## Estado atual (importante)
Um agente anterior foi interrompido no meio do trabalho. Já existem mudanças **não compiladas** em `android/`:
novos `MoreScreen.kt`, `NotificationSettingsScreen.kt`, `OfflineCache.kt`, `PhotoProcessor.kt`, `FriendlyErrors.kt`,
`SessionTokens.kt`, `FsyControls.kt`, `FsyFormat.kt`, `FsyRefreshable.kt`; `ProfileScreen.kt`, `CardOrderManager.kt`,
`ReorderableCardList.kt`, `FsyReorder.kt` foram apagados; `HomeScreen.kt`, `FsyAppState.kt`, `MainActivity.kt`,
`PortalApiClient.kt`, `Models.kt` foram reescritos em parte. Rode `git diff -- android` e `git status -- android`
para entender. **Continue esse trabalho** (não recomece do zero, não reverta), até compilar e cumprir tudo abaixo.

## Decisões do responsável
1. Barra inferior com 4 abas: **Início · Agenda · Avisos · Mais** (Mais substitui Perfil). Mais = cabeçalho de perfil estilo rede social
   (foto grande redonda com anel Sunshine, nome, companhia, consultores), Fotos (galeria + Instagram), Aparência (Automático/Claro/Escuro),
   Notificações (subtela), e — **só para cargos com acesso** — Painel do consultor e Gestão; por fim Sair (uma vez).
   Galeria/Consultor/Gestão abrem como telas empilhadas com transição (slide+fade ~250 ms, respeita movimento reduzido); voltar retorna a Mais.
2. Início = essencial do dia + fotos: cartão "Agora / A seguir" vivo (antes do evento: contagem + Ipê Park Hotel · São José do Rio Preto;
   durante: atividade atual com barra de progresso + próxima; entre atividades: "começa em X min"), agenda de hoje compacta (linhas tocáveis
   que abrem a Agenda no item), Minha companhia (nome, consultores, quarto), os 2 avisos mais recentes (sem rotador/pausa/contador),
   faixa horizontal de fotos que abre Fotos. Sem "Organizar", sem cartão de tema/escritura (tema vira uma linha no topo). Um só caminho para a Agenda.
3. Nenhuma personalização/reordenação de cartões em nenhuma tela.
4. Visual "alegre e limpo": fundo pergaminho + azul oficial #007DA5 (#005E7C nas áreas de leitura com texto branco), Sunshine #FFE48A e
   coral #FC4E6D só como destaque, menos selos e ícones em caixinha, tipografia maior, respiro, toque com escala 0.97 (mola sem bounce),
   transições suaves. Uma única linguagem visual: troque M3 cru (OutlinedButton/Button/TextButton/Switch) em Galeria/Consultor/Gestão
   pelos componentes FSY. Corrija placas brancas fixas no modo escuro. Marca oficial (`fsy_official_temple_only`) sem recolorir, sem sombra;
   Gold #DBBF6B só na marca.

## Regras de acesso (absolutas)
- Jovem **nunca** vê que existem funções de gestão/consultor: nada de "Administração", "Gestão", "Conselheiro", "Painel", "Publicar",
  nomes de módulos, botões desabilitados, seções vazias ou dicas. Enquanto o perfil carrega ou o cargo é desconhecido, trate como jovem.
  Deep links/intents de gestão vindos de jovem caem no Início, sem mensagem.
- Agenda: jovem não vê o dia `dia0` nem itens com categoria `Equipe` (Home, Agenda, widgets, lembretes, notificações). Equipe vê tudo.
- Teste automatizado: com cargo jovem, as telas Início/Mais/Avisos/Agenda não contêm esses rótulos nem itens `Equipe`.

## Foto de perfil com aprovação do consultor (backend pronto no site)
Contrato em `src/types/profile-photo.ts` (não edite `src/`). Rotas do portal (cookie ou `Authorization: Bearer`):
- `GET /api/profile/photo` → `{status:"none"|"pending"|"approved"|"rejected", approved_url, pending_url, submitted_at, reviewed_at, review_note}`
- `POST /api/profile/photo` multipart campo `file` (jpeg/png/webp ≤ 5 MB) → mesmo objeto (status `pending`)
- `DELETE /api/profile/photo?scope=pending|approved` → mesmo objeto
- `GET /api/profile/photo/reviews` → `{data:[{user_id, full_name, company_id, company_name, pending_url, current_url, submitted_at}]}` (consultor: sua companhia; gestão: todas; jovem: 403)
- `POST /api/profile/photo/reviews` JSON `{user_id, decision:"approve"|"reject", note?}` (note obrigatória ≥ 3 caracteres ao recusar) → `{success:true}`
- `GET /api/profile/photo/company` → `{data:{[user_id]: url}}` fotos aprovadas dos jovens da companhia (consultor/gestão)
URLs assinadas expiram em ~1 h: recarregue ao receber 400/403. Erros vêm como `{error:"mensagem pt-BR"}`.
No app: Mais › "Editar foto" → Photo Picker do Android (sem permissão de armazenamento), recorte quadrado ~1024 px, JPEG ~85 %, envio.
Estados: em análise (prévia + selo "Em análise pelo seu consultor" + "Cancelar envio"), aprovada (aparece onde o avatar aparece),
não aprovada (mostra o motivo + "Enviar outra"). Sem foto: iniciais sobre cor da paleta.
Consultor/gestão: seção "Fotos para aprovar" no painel do consultor (prévia grande, nome, Aprovar / Não aprovar com motivo obrigatório)
e contador no item do painel em Mais.

## Feed estilo rede social
Avisos como feed: avatar do autor + nome + cargo + tempo relativo, título, texto, curtir com contagem e animação (pop no coração + háptico).
Fotos como grade de 3 colunas com visualizador em tela cheia e deslizar. Bonito e dentro da marca — sem copiar nenhum app específico.

## Bugs a corrigir (verifique no código)
P0: filtros de categoria da Agenda em inglês vs dados em pt-BR (`Espiritual/Atividade/Alimentação/Logística/Show/Baile/Equipe/Geral`) —
corrigir filtros e cores/rótulos, no máximo Todas + 3 chips; cadastro envia `unit` mas o gatilho lê `stake`; quarto/ônibus/Drive fixados em
`null` — mapear campos reais (o site usa `profile.room`) e esconder linhas desconhecidas; cache offline persistente (limpo no logout) e falha
do perfil não pode descartar agenda/avisos já carregados; exclusões na gestão com confirmação.
P1: sobreviver a rotação/troca de tema (ViewModel ou equivalente; desregistrar callback de conectividade); push sem perder trabalho no
onDestroy e com token renovado; widget renovando token em vez de repetir para sempre; "Agora" atualizando a cada 30–60 s; lembretes com
`setAndAllowWhileIdle`/exato quando permitido, padrão global "10 min antes" DESLIGADO, horário silencioso não suprime lembrete pessoal,
aviso quando a permissão de notificação foi negada; Instagram de reserva `fsy_ribeiraopreto`; erros amigáveis em pt-BR (nunca
`invalid_grant`/códigos HTTP); cadastro usa `PasswordPolicy`; limpar `focusedAnnouncementId` depois de destacar; editor de agenda da gestão
com seletor dos 5 dias, seletor de categorias pt-BR e horário HH:MM validado.
P2 se der tempo: puxar para atualizar, esqueleto no Início, contador de não lidos na aba Avisos.
Tudo em pt-BR, sem jargão técnico. Alvos ≥ 48 dp. Fonte 200 % sem cortes.

## Build e verificação (obrigatório)
```bash
export JAVA_HOME="C:/Program Files/Java/jdk-21" GRADLE_USER_HOME=/d/Projects/PC/FSY/_ferramentas/gradle-home
cd /d/Projects/PC/FSY/fsy-event-app/android
./gradlew --no-daemon :app:compileDebugKotlin
./gradlew --no-daemon testDebugUnitTest
./gradlew --no-daemon assembleDebug lintDebug
```
Uma tarefa Gradle por vez. O harness visual (Robolectric) é `src/debug/VisualQaActivity.kt` + `src/testDebug/VisualQaTest.kt` e grava PNGs
em `app/build/outputs/visual-qa/`; você pode atualizá-lo (novas telas "mais", fixtures de foto pendente e de revisão do consultor, remover
capturas de reordenação). `VisualQaTest.staffAndGallery` tinha timeout pré-existente: corrija. Olhe os PNGs (claro/escuro, 360 dp, fonte 200 %)
e itere até ficar polido. Copie os PNGs finais para `D:\Projects\PC\FSY\_trabalho\capturas\android-depois\` (o "antes" está em `..\android-antes\`).
versionName 1.2.0 e versionCode +1. Atualize `docs/android/` com um resumo do que mudou.

## Entrega
Ao final escreva `D:\Projects\PC\FSY\_trabalho\auditorias\RELATORIO-ANDROID.md` (até 700 palavras): o que mudou por tela, bugs corrigidos
com arquivo, o que não deu para verificar, resultado de compile/test/assemble/lint (honesto), lista de PNGs.
