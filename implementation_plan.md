# Implementação FSY — posição em 20/10/2026

Plano autorizado completo: [docs/plano-implementacao-2026-10-20.md](docs/plano-implementacao-2026-10-20.md). Base preservada: `ffe14ca`, branch `feat/retomada-seguranca-ux-2026-10`. Executor GPT-6.1-Sol, esforço médio; uma revisão GPT-6-Astra, somente leitura, realizada via Orca. Nenhum executor Claude reativado.

| Etapa | Estado | Resultado / limite |
| --- | --- | --- |
| Segurança e contratos | Implementado localmente | Guards, matriz, autoria no servidor, migrações 202610200001 e 202610200002; revisão Astra incorporada. |
| Supabase real | Impedimento externo | Sem acesso ao painel/projeto e sem credenciais reais. Host do exemplo não resolvia no checkpoint. Não foi provada recuperação; nenhum dado real alterado. |
| Gestão de contas e recuperação | Implementado; integração externa pendente | Lista Auth+perfil, ações conforme hierarquia, confirmação e auditoria; Resend/Redirect URLs precisam de configuração. |
| Instagram e galeria Drive | Implementado localmente | Contrato compartilhado, legenda integral, Ver mais/menos, diálogo e original; sem curtida simulada. Galeria usa Drive como origem. |
| Layout individual | Implementado nos grupos de cartões | Portal, administração, consultor e indicadores médicos. Ver cobertura abaixo. |
| Campos FSY | Implementado nos módulos previstos | Input/Textarea/NativeSelect, rótulos associados e estilos de foco/autofill. Checkbox/radio e upload preservam recursos nativos. |
| Correções funcionais | Implementado localmente | Tabela médica correta, contagem total de avisos, cargos Dia Zero, fuso São Paulo, recálculo por minuto; removida alegação de tempo real e role em query. |
| Dependências | Diagnóstico e plano entregues | shadcn somente desenvolvimento; Next 14 ainda possui advisories. Migração principal permanece pendente em docs/dependencias-2026-10-20.md. |
| Verificação integrada | Concluída localmente, com limites | 118 testes aprovados; lint/tipagem/build aprovados. QA em 14 telas × 2 viewports, confirmação específica aprovada. Impeccable 14/20 (70%); meta >95% pendente. |
| Publicação/banco | Não executado | Preparação e retorno documentados; nada enviado ao GitHub/Vercel/Supabase nesta retomada. |
| Manual funcional/design | Entregue | docs/manual-funcional-e-design.md, escrito por último a partir do comportamento verificado. |

## Cobertura de personalização

| Tela | Conteúdo que pode ser reordenado | Mantido fixo |
| --- | --- | --- |
| `/dashboard` | Cartões do portal, galeria e Instagram | Cabeçalho e avisos essenciais |
| `/admin` | Indicadores e seis acessos aos módulos | Cabeçalho, atualizar, comunicados recentes |
| `/consultor` | Indicadores; formulário e lista de comunicados | Identificação da companhia, erros e abas |
| `/admin/medical` | Indicadores das fichas | Alertas, busca, abas, tabelas, atendimentos e inclusão |
| `/admin/users`, `/admin/companies`, `/admin/schedule`, `/admin/announcements`, `/admin/media`, `/admin/logistics`, `/admin/counselor-audit` | Sem grupo de cartões independentes adicional: listas/tabelas/formulários operacionais permanecem na ordem de conteúdo | Navegação, filtros, formulários e registros |
| `/schedule`, `/announcements`, login, recuperação, offline | Não reordenáveis: cronologia, avisos e fluxos de entrada | Programação oficial, prioridade e passos do formulário |

A personalização não altera sequência oficial nem ordem administrativa de dados. Não foi identificado campo de ordem editorial livre nos contratos existentes. Não foi criado arraste que altere datas ou registros clínicos. Preferências são por conta, grupo/página, versão e breakpoint `all`; RLS e cache local isolam contas. Persistência em Supabase real aguarda migrações e acesso.

## Próxima intervenção externa necessária

O responsável deve identificar o projeto Supabase utilizado pela Vercel, verificar se está pausado/ativo e disponibilizar acesso ou exportação/backup preservando Auth e IDs. Depois: conferir migrações anteriores, exportar banco/Auth e aplicar 202610200001 → 202610200002. Configurar Redirect URLs de recuperação, origem pública e, se desejado, Resend. Não reconstruir um banco vazio como suposta recuperação.
