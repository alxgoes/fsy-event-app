# Motion design nativo — FSY Sessão Ribeirão Preto 2

Projeto de movimento do app Android (Compose) e dos widgets. Tudo abaixo está **chamado em telas reais**, não só definido. Tokens em `ui/motion/FsyMotion.kt` (os mesmos da web, `src/lib/motion.ts`).

## 1. Princípios

1. Movimento explica estado, continuidade ou retorno de toque. Nunca decoração em laço, nada piscando.
2. Um elemento contínuo carrega a mudança (indicador que desliza) em vez de cortes — ideia emprestada das referências de motion graphics locais (`referencias/motion-graphics/skills`, "uma forma que nunca corta, movida por mola"), traduzida para interface operacional.
3. Molas criticamente amortecidas (`dampingRatio = 1`): chegam sem ultrapassar. Saída mais curta que entrada.
4. A marca oficial nunca anima por partes; só o contêiner dela.
5. **Movimento reduzido** (Configurações › Remover animações, escala 0): sem translação/escala/mola; só fade de 150 ms ou corte seco. Lido em `FsyTheme` → `LocalReducedMotion`.

## 2. Tokens

| Token | Valor | Uso |
| :-- | :-- | :-- |
| INSTANT | 100 ms | saída rápida, pressionar |
| FAST | 160 ms | cor de ícone/rótulo selecionado |
| BASE | 220 ms | troca de estado (filtros, aparência, chevrons) |
| LAYOUT | 260 ms | reordenação |
| OVERLAY_ENTER / EXIT | 300 / 200 ms | revelação de lista, entrada de tela |
| EaseOut | cubic(0.16, 1, 0.3, 1) | chegadas |
| EaseIn | cubic(0.4, 0, 1, 1) | saídas |
| Mola normal / ágil | rigidez 196 / 484, sem ricochete | indicadores, pressão |
| PRESS_SCALE | 0,97 | retorno de toque |

## 3. Coreografia por componente

| Componente (arquivo) | Gatilho | Movimento | Reduzido |
| :-- | :-- | :-- | :-- |
| Barra de navegação (`FsyNavigation.kt` · `FsyNavigationBar`) | tocar destino | cápsula Sunshine desliza até o destino (mola, rigidez 314); cor do ícone 160 ms; háptico `tick` | salta direto |
| Troca de aba (`MainActivity`) | destino muda | conteúdo antigo sai em 100 ms, novo entra em 220 ms após 100 ms (sem sobreposição de texto) | fade 150 ms |
| Seletor segmentado (`FsySegmentedSelector`): dias da agenda, filtros de avisos, galeria, Entrar/Criar conta | tocar opção | pílula branca desliza (mola ágil) | salta |
| Agenda (`ScheduleScreen`) | trocar dia/categoria | lista inteira troca com `fsyContentSwap`; itens da linha do tempo revelam escalonados (35 ms, até 8) a partir de opacidade 0,4 e 10 dp | sem revelação |
| Item da linha do tempo | tocar | detalhes abrem com `animateContentSize` + `AnimatedVisibility`; chevron muda | instantâneo |
| Lembrete (sino) | tocar | ícone Bell → BellRing, háptico `confirm` | igual |
| Avisos (`AnnouncementsScreen`) | filtrar | troca de lista + revelação escalonada; aviso vindo do Início rola até ele e recebe contorno de 2 dp | rola até o aviso, sem revelação |
| Curtir | tocar | coração preenche e assenta de 0,8 → 1 (mola ágil) + pressão 0,97 | só troca de ícone |
| "Ler tudo" | tocar | texto expande com `animateContentSize` | instantâneo |
| Início (`HomeScreen`) | primeira exibição | faixa do momento, atalhos, tema e cartões revelam em sequência (0..n × 35 ms) | sem revelação |
| Agenda do dia (Início) | tocar "Sáb 06/02 · N atividades" | chevron gira 90° (220 ms), lista abre com `AnimatedVisibility` e linhas escalonadas | instantâneo |
| Cartões reordenáveis (`ReorderableCardList.kt` + `ui/motion/FsyReorder.kt`) | "Organizar" | cartões cruzam (fade) para linhas compactas; arraste pela alça segue o dedo, vizinhos abrem espaço com FLIP sem ricochete, rolagem automática nas bordas; Subir/Descer para TalkBack/teclado; "Restaurar" entra com `AnimatedVisibility` | reordena na hora |
| Botões (`FsyActionButton`), cartões tocáveis, curtir | pressionar | escala 0,97 com mola ágil + ondulação | só ondulação |
| Faixas de conexão/erro (`FsyConnectivityBanner`) | ficar offline / erro | entram e saem com `AnimatedVisibility` (expandir + fade); região `liveRegion` | fade |
| Aparência (`ProfileScreen` + `FsyTheme`) | escolher Automático/Claro/Escuro | fundo Sunshine da linha escolhida em 220 ms; as cores do app inteiro fazem transição de 220 ms | corte seco |
| Login (`AuthScreen`) | abrir / trocar modo | identificador e cartão assentam uma vez (momento focal único); formulário troca com `fsyContentSwap`; avisos de erro/sucesso entram com `AnimatedVisibility` | fade |
| Imagens remotas (`RemotePublicImage`) | carregar | crossfade 220 ms do espaço reservado | 150 ms |
| Esqueletos (`FsyLoadingBlock`) | carregando | pulso de opacidade 0,55↔1 (900 ms) só enquanto carrega — único repetido, para ao terminar | parado |
| Administração (`AdminHubScreen`) | trocar módulo | chips com seleção Sunshine; conteúdo troca com `fsyContentSwap` | fade |

## 3b. Movimento autônomo (sem toque)

| Onde | Coreografia | Pausa / limites | Reduzido |
| :-- | :-- | :-- | :-- |
| Entrada da Início (`fsyHomeEntrance`) | faixa do momento → funções do perfil → Programação → Avisos → Companhia → Galeria; cada grupo sobe 16 dp e passa de opacidade 0,6 a 1 em 420 ms, defasagem 90 ms (~0,8 s no total). Uma vez por exibição | conteúdo legível desde o 1º quadro; não repete | sem entrada |
| Avisos da Início (`AnnouncementRotator`) | avisos **reais** não urgentes trocam a cada 10 s; entrada desliza 1/6 da largura + fade em 350 ms, saída 1/8 + fade em 250 ms; contagem "n de N" | urgentes ficam fixos acima e nunca giram; pausa ao tocar/ler o cartão, com TalkBack, com o app fora do primeiro plano; botões Anterior/Pausar-Retomar/Próximo | sem troca automática; só anterior/próximo com fade |

Nada inventado para decorar: sem mensagens fictícias, progresso ou "sincronizando". Sem partículas, flash ou laço decorativo; a marca oficial não anima.

## 4. Háptica (`FsyHaptics`)
`tick` seleção/aba; `confirm` ação concluída (curtir, salvar, abrir função); `reject` sair; `grab/step/drop` no arraste. Respeita a configuração do sistema.

## 5. Acessibilidade
Nada depende só do movimento: estados têm texto/ícone (`stateDescription` no lembrete e na curtida; `Role.Tab`/`RadioButton`/`Switch`). Reordenação tem alternativa por botões. Nenhum flash > 3/s.

## 6. Widgets
- **Launcher (Android 12+):** `appWidgetBackground()` (Glance) e `@android:id/background` (Destaques) habilitam a transição do widget para o app ao tocar.
- **Destaques (RemoteViews `ViewFlipper`):** páginas trocam só pelas setas; entrada desliza 12% + fade (260 ms, desaceleração), saída 8% + fade (180 ms). `autoStart=false`, sem `flipInterval`, sem atualização para animar. Com "Remover animações", usa `widget_fsy_highlights_static` (sem in/out).
- **Glance 1.1:** sem animação de conteúdo (limite da plataforma). Mudança de estado vem da própria atualização (Agora → A seguir, dia ativo em Sunshine).

## 7. Como verificar
Capturar quadros em sequência de: troca de aba (indicador no meio do caminho), troca de dia na agenda, abrir detalhe da linha do tempo, curtir, Organizar → arrastar, abrir agenda do dia no Início, Aparência Claro→Escuro. Repetir com escala de animação 0 (deve haver só fades/cortes).
