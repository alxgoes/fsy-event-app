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
