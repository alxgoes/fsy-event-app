# Auditoria complementar — Next 16 e acessibilidade

## Resultado e limite da entrega corrente

A identidade FSY e o tema exato **Alegra-se em Cristo** foram preservados/centralizados. Os achados confirmados entraram em um lote de correção; lint, tipos, testes e build final passaram. **A confirmação visual final foi transferida para GitHub Actions por instrução expressa do usuário, para poupar o Mac. Não foi executada nem aguardada por este executor.**

Não há nova nota consolidada demonstrada. A última pontuação concluída é a histórica **14/20 (70%)**, preservada abaixo; ela não é uma medição automática do código atual. A meta >95% exige 20/20 nesta versão e **continua sem comprovação**. Passar no gate automatizado não atribui 20/20 nem certificação WCAG.

| Dimensão | Evidência atual | O que ainda precisa de confirmação |
| --- | --- | --- |
| Acessibilidade | Pares estáveis de saudação/contadores/urgência corrigidos; rótulos, nomes visíveis, contraste dinâmico de companhia, painel/teclado da agenda e foco ajustados | Nova coleta axe sem violações; leitor de tela, estados/diálogos fora das fixtures e superfícies com imagem/canvas |
| Desempenho | 145 testes; cache de ondas, pausa/redução de movimento, TTL/dedupe e teto de 4 leituras; build com 1 worker | Não houve FPS em aparelho físico nem carga simultânea de produção; as simulações de requests não são economia financeira medida |
| Responsividade | 56 combinações e 6 ampliações 200% sem overflow de documento; zero campos sem rótulo; link Início ampliado após coleta | Confirmação dos alvos 44×44 e filtros sobrepostos apontados pelo detector; nem todo diálogo foi exercitado |
| Temas | Tokens de contraste, fundos estáveis, fundo escuro atenuado e alternador preservado | Coleta final usando o estado real de next-themes, incluindo alternância de ida/volta |
| Integridade | Contratos mantidos, tema centralizado, autenticação/escopos testados, cache PWA v3, sem curtidas/conteúdo simulados na aplicação | Hierarquia de títulos e padrões históricos de cartões/sombras ainda exigem avaliação contextual; não confundir fixtures com banco real |

## Passagem agrupada executada

Puppeteer + axe + detector DOM original: **14 rotas × 2 tamanhos × 2 temas = 56 casos**, dados fictícios locais. Mais seis casos com fonte 200% em 390/768 px (dashboard, programação e contas). Zero overflow horizontal de documento, zero campos visíveis sem nome e zero erros JS registrados. Legenda integral, imagem `object-contain`, região rolável, Escape e mover/salvar/recarregar/restaurar layout passaram na coleta inicial.

O levantamento inicial tinha oito casos com alvo pequeno (o mesmo link Início), 22 casos com `aria-prohibited-attr`, 34 com `label-content-name-mismatch`, quatro com `aria-valid-attr-value` e 21 com `color-contrast`. As categorias podem coexistir no mesmo caso; não somar como telas distintas. A coleta escura alternava só a classe CSS: o fundo dependente de `resolvedTheme` não acompanhou. Esses contrastes não são prova da aparência final escura. O runner corrigido grava o tema antes da navegação e aguarda a classe real; a confirmação está na CI.

## Correções concretas após a coleta

- Saudação branca sobre azul FSY #005e7c (7,26:1); contador grafite/rosa (5,48:1); urgência branco/vermelho escuro (6,47:1). Metadados operacionais de 9–11 px passaram a 12 px.
- Início com mínimo 44 px e foco visível; cores ativas escuras preservam texto branco. Formulários mantêm os componentes compartilhados.
- Marca vetorial com papel `img`; nomes de menu derivados do conteúdo visível; notificação inclui contagem; foto com erro inclui o aviso visível no nome acessível.
- Abas da agenda têm painel existente, seleção/foco e setas/Home/End; contagem sem opacidade que reduzia contraste.
- Companhia escolhe preto/branco pela luminância da cor configurada. Ação médica, prioridade, destrutivos e superfícies escuras foram ajustados; o selo urgente não perde contraste por pulsar a opacidade.
- Fundo Seigaiha escuro atenuado; avisos críticos com superfície opaca. Cache PWA v3 elimina os caches v1/v2 na ativação, preservando caches alheios.

## Achados preservados e pendências específicas

**P1 — confirmação de acessibilidade:** as correções acima compilaram e passaram no lint, mas ainda exigem o gate visual final no GitHub. Não registrar os achados como confirmados resolvidos visualmente antes desse resultado. CI exige 56 casos axe, nenhum ignore, alvos 44 px, rótulos, overflow, erros JS e interações.

**P2 — detector DOM:** a primeira passagem registrou, entre outros, 90 ocorrências de contraste, 16 saltos de títulos e duas de oclusão de texto nos filtros de `/admin/schedule`. As duas últimas não foram descartadas como falso positivo: checar o filtro “Espiritual” no celular; há rolagem interna, mas o detector apontou cobertura de 33%. Marca tipográfica pequena (12 ocorrências) é conteúdo gráfico repetido por texto maior no portal; não foi renomeada para esconder o achado. Links com alvo mínimo e padding calculado zero são avisos geométricos a interpretar, sem relaxar o alvo.

**P2 — contexto visual:** Inter/paleta ciano e cartões táteis pertencem ao FSY; não são por si só falhas. `gradient-text` no body não corresponde a texto com gradiente pintado no código inspecionado. Sombras/padrões históricos e títulos pulados continuam registrados. O detector estático inicial retornou 13 entradas; os cinco avisos incluem cinza sobre cor com variantes/hover e a tipografia Inter de e-mail. Não houve nova regra ou ignore para melhorar pontuação.

**Limites:** axe deixa superfícies complexas em `incomplete`; ausência de violação automática não prova contraste sobre toda imagem/canvas. Não houve leitor de tela, aparelho físico, instalação PWA física, e-mail de produção ou teste de todos os cargos/diálogos. A situação remota de RLS é tratada em documento próprio e não recebe nota visual.

Evidências em [evidencias-next16-2026-10-20](evidencias-next16-2026-10-20/), incluindo JSON bruto comprimido, resumo e capturas da primeira passagem. A CI guarda sua confirmação por sete dias. Nenhum novo QA/build local será iniciado neste fechamento.

---

## Relatório histórico anterior — d1055c7

# Auditoria Impeccable — 20/10/2026

Método: skill local Impeccable 4.1.3 (`reference/audit.md`), detector estático em `src/` e detector DOM oficial injetado via Puppeteer em 14 rotas, desktop 1365×900 e celular 390×844. Dados de desenvolvimento fictícios, com Supabase falso local; não houve leitura de contas reais. As evidências estão em `docs/evidencias-2026-10-20/`. Não é Lighthouse nem certificação WCAG.

## Integridade da implementação

A identidade FSY, programação de fevereiro, papéis e alertas foram preservados. A galeria, os campos compartilhados e o layout individual usam contratos existentes. O feed mostra legenda integral e não simula curtidas. A intenção visual está coerente, mas há dívida de acessibilidade herdada e variação entre superfícies suaves novas e cartões anteriores. Veredito: **parcial; meta de qualidade global ainda não alcançada**.

| Dimensão | Nota / 4 | Evidência e limite |
| --- | --- | --- |
| Acessibilidade | 2 | Nomes dos campos e teclado dos novos controles melhorados. Há contraste insuficiente em textos existentes, abaixo. Não houve leitor de tela nem auditoria de cada diálogo. |
| Desempenho | 3 | Build aprovado, imagens progressivas, atualizações periódicas sem nova busca e requisições agrupadas. Sem medição de FPS/dispositivo físico. |
| Responsividade | 3 | Nenhum overflow horizontal de documento nas 28 combinações. Há links operacionais pequenos e texto funcional abaixo de 11 px. |
| Temas | 3 | Claro e escuro inspecionados; permanecem cores literais e contraste a corrigir. Parte da primeira coleta escura ocorreu durante transição e não é medida estável. |
| Integridade | 3 | Contratos compartilhados, estados vazios/erro e autoria do servidor. Persistem padrões históricos e advertências a interpretar em contexto. |
| **Total** | **14/20 — 70%** | **Bom na faixa da skill, abaixo da meta solicitada (>95%, que exige 20/20).** |

A cobertura é mais ampla que a avaliação histórica de 15/20 em `walkthrough.md`; a diferença de nota não mede uma regressão isolada. A nota acima é uma avaliação técnica fundamentada, não uma pontuação automática emitida pelo detector.

## Achados verificados e prioridades

- **P1 — Contraste da saudação do portal:** branco sobre o extremo ciano `#01B6D1` do fundo pode ficar em aproximadamente 2,4:1 para o título; texto secundário também fica abaixo de 4,5:1. Local: `WelcomeCard`. A próxima correção deve ajustar a superfície/cores e verificar todas as posições do gradiente; não basta trocar um token sem medir.
- **P1 — Pequenos selos com branco sobre rosa/vermelho:** exemplos na contagem de notificações e prioridade de avisos. Branco sobre `#FC4E6D` fica em aproximadamente 3,3:1. Medir e substituir a combinação preservando a semântica de urgência.
- **P2 — Texto funcional pequeno:** partes da marca, metadados e selos têm 9–10 px. A marca decorativa pode ser uma exceção contextual, mas metadados operacionais exigem avaliação de legibilidade.
- **P2 — Links operacionais compactos:** o levantamento geométrico ainda encontrou âncoras menores que 44 px em telas existentes. Links inline de legendas são contados pela varredura, embora pertençam a texto; não confundir essa contagem bruta com número de violações. Os botões têm mínimo global de 44×44 px.
- **P2 — Temas/transições:** a primeira coleta escura mudou a classe e mediu imediatamente; cores intermediárias geraram falsos contrastes, inclusive em controles já opacos. A confirmação das telas alteradas espera a transição terminar. Não usar os valores intermediários como prova de falha final.

Os três filtros sem nome acessível em `CounselorAuditManager` e links focáveis dentro da legenda recolhida foram corrigidos após a primeira passagem; a confirmação específica está registrada separadamente. O teste inicial de Escape consultava o diálogo antes de terminar sua animação de saída; a confirmação aguarda a remoção do DOM.

## Detector e falsos positivos

O detector estático retornou 14 entradas na coleta registrada, incluindo advertências de paleta/tipografia e quatro avisos não consultivos antes da correção pontual da cor do botão de auditoria. Não houve alteração de regras ou inclusão de ignores para melhorar a nota.

O detector DOM executou de fato e encontrou vários padrões repetidos nas 28 combinações. Seus achados estão preservados, inclusive os não confirmados. `ai-color-palette`, gradientes, fonte Inter e cartões aninhados exigem contexto: a paleta e a tipografia são prescritas pelo FSY; o sidecar histórico está desatualizado e não substitui `DESIGN.md`. O método DOM não fez o fallback de contraste por captura de pixels para todas as superfícies. Não se inferiu conformidade integral de um scan estático ou de ausência de overflow.

## Limites e próxima passagem delimitada

Não foram testados aparelhos físicos, zoom de texto a 200%, leitor de tela, todas as combinações de cargos/diálogos ou o Supabase real. Fotos indisponíveis e legenda longa usaram fixtures. O teste de políticas usa Postgres local real, separado do servidor falso visual. A concorrência entre transações independentes da proteção administrativa precisa de confirmação no ambiente Postgres externo antes de produção.

Próxima passagem: `/impeccable colorize` para contrastes confirmados → `/impeccable adapt` para textos e alvos restantes → `/impeccable audit`; `/impeccable polish` somente ao final, com ciclo limitado. Nenhum dos achados remanescentes foi ocultado para declarar 20/20.

## Confirmação final das correções

Em `qa-confirmacao.json`: dashboard e auditoria em ambos os tamanhos, sem overflow e sem campos visíveis sem nome acessível. O número bruto de links compactos do dashboard caiu de 72/71 para 2/1 após retirar links da legenda recolhida da navegação por foco. Legenda expandida, fim do texto no diálogo, imagem `object-contain`, região rolável, Escape após a animação, mudança/salvamento/recarregamento e restauração do layout foram confirmados. A confirmação não repete a certificação do site inteiro nem eleva a nota automaticamente.
