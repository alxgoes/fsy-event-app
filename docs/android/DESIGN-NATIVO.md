# Design nativo Android: FSY Sessão Ribeirão Preto 2

Redesenho nativo "Papel e Arco" (Claude Opus 5.5, 01/11/2026), dentro do mundo visual oficial já fixado (DESIGN.md web + guia oficial 2027). Movimento detalhado em [MOTION-DESIGN.md](MOTION-DESIGN.md). Estado: código salvo, **compilação e capturas a cargo do parent** (não compilado por este agente).

## 1. Identidade

- **Fatos oficiais (não reescrever):** Sessão Ribeirão Preto 2 · Ipê Park Hotel, São José do Rio Preto (SP) · 06 a 10 de fevereiro de 2027 · "Alegrar-se em Cristo" · Filipenses 4:4. O app não se apresenta como portal oficial global da Igreja.
- **Marca oficial (guia 2027 em português, `referencias/identidade-oficial-2027/portugues/Assets`):** PNGs originais copiados sem alteração para `res/drawable-nodpi/` (`fsy_official_mark_vertical`, `_horizontal`, `_wordmark_centered`). Temple-Only (autorizado na p. 6 para espaços pequenos) = recorte exato do arco do PNG vertical (`fsy_official_temple_only`, 439×906 px, x 214–652, y 36–941), recortado pela própria forma do arco. Sem recolorir, sem sombra, sem gradiente, sem recombinar marca e letreiro, sem animar partes da marca (só o contêiner). Os PNGs têm fundo branco: aparecem sempre em placa clara, inclusive no tema escuro.
- **Removido:** estrela do launcher e o templo redesenhado à mão (`fsy_temple_mark.xml`). Nenhum ícone de família/casa: Início usa Lucide `LayoutDashboard`; ícone de pessoas só em Companhia/participantes.
- **Launcher:** ícone adaptativo com o Temple-Only oficial sobre branco (`drawable-xxxhdpi/ic_launcher_temple.png`). `drawable/ic_launcher_foreground.xml` virou silhueta de arco monocromática, usada só como ícone pequeno de notificação (exige forma alfa; não reproduz o identificador).
- **Cores (todas as 36 funções do Material 3 mapeadas, sem cor dinâmica):** papel `#FAF8F5`, cartões `#FFFFFF`, grafite `#0F172A`, azul `#007DA5` (escuro: céu `#7DE3F4` com texto grafite), Sunshine `#FFE48A` como seleção (indicador da navegação, chips, aparência), coral `#FC4E6D` só em curtidas/selos com texto grafite, erro `#B91C1C`. Causa do roxo anterior: ~22 funções (secondaryContainer, surfaceContainer*, outline*, inverse*, error*) caíam na paleta-base do M3. Ouro `#DBBF6B`/Gray5 ficam reservados ao identificador.
- **Aparência:** Automático (padrão, acompanha o celular e reage à troca), Claro, Escuro — Perfil › Aparência. Preferência em `SharedPreferences("fsy_appearance")`, global (vale no login), fora do cofre de sessão. Ícones das barras do sistema seguem o tema efetivo (`WindowCompat` + `SideEffect`). As cores principais fazem transição de 220 ms na troca.
- **Tipografia:** Libre Baskerville (OFL, `res/font`) em títulos, marca e citação; sans do sistema na interface; números e horários sempre sans tabular (`tnum`).
- **Ícones:** família única Lucide 0.460 (ISC; partes Feather MIT), 84 vetores locais gerados dos SVG oficiais em `ui/icons/FsyIcons.kt` (traço 2, pontas redondas) + `FsyIconsFilled.Heart` para curtida marcada. Nenhum `Icons.Default` restante; `material-icons-extended` ficou sem uso (remoção a critério do parent).
- **Forma:** cartões 24 dp; botões, seletores, chips e indicadores em pílula; campos 14 dp.
- **Alvos de toque:** mínimo 48 dp. Texto em sp; seletores longos (Aparência) em linhas verticais para não cortar a 200%.

### Atribuições
Texto integral empacotado em `res/raw/licencas_terceiros.txt` (Lucide ISC, Feather MIT, Libre Baskerville OFL).
Lucide — ISC License, Copyright (c) Lucide Contributors 2022. Partes do Feather — MIT, Copyright (c) 2013-2022 Cole Bemis. https://lucide.dev/license

## 2. Motion: princípios

Referências lidas e traduzidas para Compose (não houve conversão automática de HTML para nativo):
- `C:/Users/user/Videos/FSY/referencias/motion-graphics/skills/motion-broll/SKILL.md`: um contêiner que muda de estado sem corte; conteúdo trocado dentro dele com tempos próprios de entrada e saída; molas no máximo com overshoot mínimo; "bouncy easing" proibido.
- `.../skills/explainer-default/SKILL.md`: transições suaves (`z ≥ 0,95`, nada quica); pausas de leitura depois de cada resultado.
- `.../skills/explainer-engaging/SKILL.md`: continuidade (o elemento não some entre estados) e mola criticamente amortecida para acompanhar movimento.
- Impeccable `animate`/`operate` (D:/Projects/Ether-CRM/.claude/skills/impeccable/reference/): em UI operacional, entre 150 e 300 ms, motion só para estado, retorno e continuidade.

Regras:
1. Movimento explica algo (o que mudou, para onde foi, se a ação deu certo). Nada decorativo em laço, nada piscando; um aviso novo pulsa duas vezes e para.
2. Molas `DampingRatioNoBouncy`. Rigidez 196 (normal) ou 484 (ágil). Saída mais curta que a entrada.
3. Com a escala de animação do sistema em 0 ("Remover animações"), há só fade de 150 ms ou corte seco. Deslocamento, escala e FLIP ficam desligados.
4. Retorno tátil apenas pelas constantes do Android (`View.performHapticFeedback`). Ele respeita a configuração do usuário, não usa API de fabricante e tem substitutos para Android 8 (minSdk 26).

## 3. Contrato Kotlin (posse Opus: `ui/motion/**`)

Pacote `br.com.fsyrp2.app.ui.motion`:

| API | Uso |
|---|---|
| `FsyMotion` | Tokens. Durações em ms: 100, 160, 220, 260, 300 (entrada), 200 (saída), 520 (focal) e 150 (fade reduzido). Também `EaseOut`, `EaseIn`, `PRESS_SCALE` 0,97, `LIFT_SCALE` 1,02 e `LIFT_ELEVATION_DP` 8. |
| `fsyMotionPreferences(): FsyMotionPreferences` | Lê `LocalReducedMotion` do `FsyTheme`. |
| `fsySettleSpring(snappy)`, `fsyItemPlacementSpec(reduce)`, `fsyStateTween(reduce)`, `fsyReducedFade()` | Specs prontas. `fsyItemPlacementSpec` serve para `Modifier.animateItem(placementSpec = …)` em `LazyColumn`. |
| `rememberFsyHaptics(): FsyHaptics` | Métodos `tick()`, `grab()`, `step()`, `drop()`, `confirm()` e `reject()`. |
| `fsyEnter()` / `fsyExit()` | Entrada (fade + 12 dp, 300 ms) e saída (200 ms) de telas, sheets e `AnimatedVisibility`. |
| `AnimatedContentTransitionScope.fsyContentSwap(reduce)` | Troca de conteúdo no mesmo contêiner (dia da agenda, filtros) sem sobrepor textos. |
| `Modifier.fsyPressScale(interactionSource, enabled)` | Afunda até 0,97 ao pressionar, junto com o ripple. |
| `rememberFsyReorderState(initialOrder, onCommit)` | Estado de reordenação. `syncFrom(order)` atualiza a ordem vinda de fora e `moveBy(id, ±1)` move pelos botões. |
| `Modifier.fsyReorderItem(state, id)` | Cada cartão filho da `Column`. Aplicar **antes** de outros modificadores de desenho. |
| `Modifier.fsyReorderHandle(state, id, label)` | Alça de 48 dp. Expõe ações TalkBack "Mover para cima/baixo". |
| `FsyReorderAutoScroll(state, scrollState, viewportTop, viewportBottom)` | Rolagem automática a até 80 dp das bordas (no máximo 16 dp por quadro). |

### Integração do arraste (Gemini, em `ReorderableCardSection`)

```kotlin
val reorder = rememberFsyReorderState(resolvedOrder) { newOrder -> onOrderChange(newOrder) }
LaunchedEffect(resolvedOrder) { reorder.syncFrom(resolvedOrder) }
Column(Modifier.verticalScroll(scroll).onGloballyPositioned { vp = it.boundsInRoot() }) {
    reorder.order.forEach { id ->
        Box(Modifier.fsyReorderItem(reorder, id)) {
            // cabeçalho de edição: título, Subir/Descer (reorder.moveBy) e
            // Icon(DragIndicator, Modifier.size(48.dp).fsyReorderHandle(reorder, id, title))
            card.content()
        }
    }
}
FsyReorderAutoScroll(reorder, scroll, vp.top, vp.bottom)
```

- `onCommit` chama `CardOrderManager.save(...)` com a chave por conta `fsy:layout:v1:{userId}:{pageKey}` e `resolveOrder` iguais aos da web.
- Toque cancelado pelo sistema, troca de app ou ligação: a ordem anterior volta e nada é salvo.
- A ordem só é persistida ao soltar o cartão ou ao usar a ação de acessibilidade.

## 4. Telas: estados e motion

| Situação | Visual | Motion |
|---|---|---|
| Carregando | Esqueleto com o formato real do conteúdo | Brilho lento (1,6 s); estático em movimento reduzido |
| Vazio | Frase que diz o que aparece ali e a próxima ação | Nenhum |
| Erro / sem conexão | Faixa no topo: "Sem conexão. Dados de HH:MM." e botão Tentar novamente | `fsyEnter` na faixa; `haptics.reject()` só quando o usuário tentou uma ação |
| Sem permissão (403) | Tela de estado com explicação e saída | Nenhum |
| Ação confirmada | Texto de confirmação e ícone | `haptics.confirm()`; troca de conteúdo com `fsyContentSwap` |
| Navegação entre abas | Barra inferior Material 3 | Indicador com `fsyStateTween`; conteúdo com `fsyContentSwap` (sem deslizar a tela inteira) |
| Sheet ou diálogo | Superfície branca, cantos de 24 dp | `fsyEnter`/`fsyExit` |

- **Privacidade:** as telas de saúde, inscrições e contas usam `SecureScreenEffect` (`FLAG_SECURE`), sem miniatura no alternador.
- **Logout:** limpar cache, preferências de layout e widgets da conta e voltar a um estado neutro.

## 5. Notificações personalizadas

- **Canais:**
  - "Avisos da sessão" (importância alta só para avisos urgentes).
  - "Próximas atividades" (padrão).
  - "Lembretes pessoais" (baixa).
  - O usuário escolhe cada canal no app e no sistema.
- **Tela bloqueada:**
  - `VISIBILITY_PRIVATE` com `publicVersion` redigida: "FSY RP2: novo aviso", sem nome, saúde, companhia nem quarto.
  - Saúde nunca vai em notificação.
- **Conteúdo:**
  - Título curto; horário em algarismos tabulares.
  - Ação direta só quando o fluxo real existe ("Ver agenda", "Confirmar presença"), via deep link nativo `fsyrp2://…` validado contra allowlist.
- **Sem conta:**
  - Ao sair, cancelar todas as notificações e alarmes da conta e remover tokens.
  - Nenhuma notificação de outra conta aparece depois de trocar de usuário.
- **Horários do evento:** fuso `America/Sao_Paulo`, 06 a 10/02/2027. O dia 05 é exclusivo da equipe.

## 6. Widgets

Cinco widgets, todos com `appWidgetBackground` / `@android:id/background` (transição de abertura do launcher no Android 12+), cantos 24 dp, templo oficial pequeno no cabeçalho, textos e descrições em pt-BR.

| Widget | Conteúdo | Tamanhos |
| :-- | :-- | :-- |
| Próxima atividade (Glance) | "Agora" e "A seguir" com hora tabular e local | 2×2 compacto; 4×2/4×4 com linhas |
| Agenda do dia (Glance, novo) | Atividades do dia a partir da atual; "+N no app" | 4×2 (3 linhas), 4×3+ (6 linhas) |
| Contagem e calendário (Glance) | "Faltam N dias"/"Sessão em andamento", cinco dias com o dia atual em Sunshine | 2×2; 4×2 com dias |
| Avisos (Glance, novo) | Total de avisos visíveis e quantos são urgentes (selo de erro com texto); toque abre o mural. Nunca mostra título ou conteúdo | 2×2; 4×2 com dica |
| Destaques (RemoteViews, novo) | ViewFlipper: contagem → próxima atividade → tema, setas Anterior/Próximo | 3×2 redimensionável |

- **Dados e privacidade:** só a agenda pública do `WidgetSnapshotDto` existente (sem companhia, quarto, saúde). Sem sessão: "Entre no app para ver a agenda". Sair da conta limpa o snapshot e atualiza os cinco widgets (`FsyWidgetManager.updateAllWidgets`).
- **Atualização:** a mesma do app (abertura, primeiro plano, WorkManager de 30 min). O `WidgetSyncWorker` agora também grava `visibleAnnouncementCount`/`urgentAnnouncementCount` (API de avisos já existente; se a leitura falhar, as contagens ficam nulas e o widget pede para abrir o app; só a companhia do snapshot anterior da MESMA conta é preservada). Nada de atualização frequente para animar.
- **Tema:** os widgets seguem o claro/escuro do **sistema/launcher** (cores dia/noite do Glance e `values-night`), não a preferência manual do app, porque são desenhados pelo launcher fora do processo.
- **Motion:** ver MOTION-DESIGN.md §6. Glance 1.1 não anima conteúdo; o único movimento de conteúdo é a troca manual de página do ViewFlipper (sem autoStart, sem laço; layout estático com "Remover animações").

## 7. Critérios de aceite visuais (Android)

1. Com a escala de animação 0: sem translação nem escala; reordenar aplica na hora; cancelar o gesto reverte.
2. Arraste com o dedo: o cartão segue o dedo, os vizinhos deslizam sem quicar, a lista rola perto das bordas, soltar persiste e recarregar mantém a ordem. Em outra conta, aparece a ordem padrão.
3. TalkBack: as ações "Mover para cima/baixo" funcionam e anunciam a posição.
4. Notificação na tela bloqueada não mostra nome nem saúde. Depois do logout, nada da conta anterior aparece.
5. Fonte do sistema em 200%: títulos e widgets não cortam.
6. Nenhum `infiniteRepeatable` decorativo no código das telas.
