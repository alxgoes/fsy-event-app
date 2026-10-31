# Design nativo Android: FSY Sessão Ribeirão Preto 2

Autor: Claude Opus 5.5 (design/motion). Implementação das telas: Gemini. App 100% nativo em Jetpack Compose: nenhuma funcionalidade depende de WebView ou do site. Versão 31/10/2026; os arquivos de motion **não foram compilados** ainda (aguardando o slot de build).

## 1. Identidade

- **Mesma identidade do portal web:**
  - Parchment `#FAF8F5` como fundo, com cartões brancos e texto grafite `#0F172A`.
  - Azul FSY `#007DA5` (escuro: `#01B6D1`), Sunshine `#FFE48A` e coral `#FC4E6D`.
  - `FsyTheme.kt` hoje usa `#006B8F` e `#E85D4A`; alinhar aos tokens oficiais acima. É uma tarefa do Gemini.
- **Tipografia:**
  - **Libre Baskerville** (OFL) para títulos de tela e de seção. Copiar `src/app/fonts/LibreBaskerville-VariableFont_wght.ttf` para `res/font/` e definir `FontFamily` com os pesos 400 e 700.
  - Sistema (Roboto) para interface, dados e **números**, com `fontFeatureSettings = "tnum"` em horários e contadores.
  - Cinzel só no lockup "Alegrar-se em Cristo". Nunca desenhar letras como vetor.
- **Letreiro FSY:** três discos (azul/F branco, sol/S grafite, coral/Y grafite), glifo de fonte real, borda de 1,5 dp, **sem sombra** e sem animação em laço.
- **Marca oficial:** templo e arco sem recolorir, sem sombra e sem gradiente.
- **Alvos de toque:** mínimo de 48 dp. O texto escala com a fonte do sistema até 200% sem cortar.

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

## 6. Widgets (Glance)

- **"Próximas atividades" (2×2, 4×2, 4×4 responsivo):**
  - Título em Libre Baskerville de 14 a 16 sp, legível.
  - Lista com horário (tabular) e local.
  - O item atual é marcado com barra azul de 3 dp e texto "Agora", sem animação.
- **"Calendário do evento" (4×2):** os cinco dias de 06 a 10/02, com o dia atual destacado em Sunshine e o texto em grafite.
- **Ações:**
  - Tocar abre a tela exata (deep link).
  - O botão "Confirmar presença" só aparece se o fluxo existir na API, e com o mesmo cuidado de idempotência.
- **Privacidade:**
  - Sem dados de saúde, documentos ou companhia de outra pessoa.
  - Sem conta conectada: "Entre no app FSY para ver sua agenda".
  - Trocar de conta atualiza todos os widgets.
- **Atualização:** ao abrir o app, ao voltar ao primeiro plano e periodicamente pelo WorkManager, sem polling agressivo. Mostrar "Atualizado às HH:MM".
- **Motion:** widgets não animam. O sistema faz a transição de abrir o app.
- **Acessibilidade:** `contentDescription` em todas as ações, contraste AA nos dois temas e alvos de 48 dp.

## 7. Critérios de aceite visuais (Android)

1. Com a escala de animação 0: sem translação nem escala; reordenar aplica na hora; cancelar o gesto reverte.
2. Arraste com o dedo: o cartão segue o dedo, os vizinhos deslizam sem quicar, a lista rola perto das bordas, soltar persiste e recarregar mantém a ordem. Em outra conta, aparece a ordem padrão.
3. TalkBack: as ações "Mover para cima/baixo" funcionam e anunciam a posição.
4. Notificação na tela bloqueada não mostra nome nem saúde. Depois do logout, nada da conta anterior aparece.
5. Fonte do sistema em 200%: títulos e widgets não cortam.
6. Nenhum `infiniteRepeatable` decorativo no código das telas.
