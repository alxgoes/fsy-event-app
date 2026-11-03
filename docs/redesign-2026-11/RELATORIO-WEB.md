# Relatório web — redesign de novembro de 2026

## Alterações

- **Início:** `src/components/dashboard/YouthDashboard.tsx` limita a largura da coluna e do cartão “Momento do evento” (`min-w-0`, `max-w-full`, `overflow-hidden`) e preserva o arco decorativo. As datas passam a vir de `src/lib/event/identity.ts`.
- **Gestão:** `src/components/admin/AdminLayout.tsx` concentra a navegação; `ExecutiveDashboard.tsx` mostra números reais e atividade recente, sem cartões de módulos duplicados. `ScheduleManager.tsx` confirma claramente a substituição integral da agenda. `MedicalDashboard.tsx` e `MediaManager.tsx` agrupam comandos secundários em “Mais ações”, mantendo as ações. Os demais gestores receberam nomes de módulos consistentes, linguagem simples, cores oficiais, números em Inter tabular e ajustes de alvos de toque.
- **Companhias e datas:** nomes de companhias substituem identificadores crus nas telas de gestão; `src/app/api/medical/route.ts` devolve `company_name`, com contrato em `src/types/medical.ts`. `src/app/api/schedule/route.ts` e `src/services/scheduleService.ts` usam as constantes de `identity.ts`. `src/app/login/page.tsx` reduz repetições e corrige o exemplo de estaca; `src/app/manifest.ts` elimina a duplicação do nome.
- **Testes:** `tests/profile-photo-review.test.cjs` verifica o gatilho da migração `202611020001_profile_photo_review.sql`, moderação por companhia, motivo da recusa e rejeição de arquivo não imagem. `tests/schedule-visibility.test.cjs` verifica a agenda do jovem. `tests/registrations-intake.test.cjs` gera ZIP de teste diretamente em Node, sem depender de Python.
- **Troca de cargo:** já existia em Gestão → Contas e acessos → Gerenciar → Dados e cargo → Aplicar cargo. Direção, coordenação e logística podem atribuir os sete cargos, com autoridade equivalente. A própria conta e a última administração habilitada são protegidas pela API e pelo banco; o histórico usa autoria do servidor. O modal agora acompanha o resumo atualizado da conta. `allowedActions()` deixa de anunciar ações de perfil para contas Auth sem perfil, sem criar fluxo novo de recuperação.
- **Sessões abertas:** `useProfile.ts` consulta o perfil em segundo plano ao voltar à aba, ao renovar o token e a cada minuto com a aba visível. Uma mudança confirmada de cargo recarrega a página para aplicar os redirecionamentos e descartar a interface anterior. Não há sobreposição de consultas nem recargas repetidas para cargo igual. As APIs já consultavam o cargo protegido a cada requisição; testes confirmam rebaixamento imediato com o mesmo cookie/Bearer.

## Verificação final — retomada em 02/11/2026

| Comando | Resultado |
| --- | --- |
| `npm.cmd run lint` | Aprovado, zero avisos. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd test` | Aprovado: 205 testes, 0 falhas, 0 cancelados e 0 ignorados, em 19,73 s. |
| `npm.cmd run build` | Aprovado: compilação em 5,1 s, TypeScript e 28/28 páginas geradas, com um único worker. |

Os quatro comandos foram repetidos em sequência na branch `feat/redesign-simplificacao-2026-11`, após os ajustes de cargo e a revisão final das migrações de fotos/autorizações. O problema anterior de acesso às fontes não se repetiu. Logs em `D:\Projects\PC\FSY\_trabalho\logs\retomada-gpt\`: `web-role-lint.log`, `web-role-typecheck.log`, `web-role-test-final.log` e `web-role-build-final.log`.

## Pendente

- A frente de verificação web não executou navegador: Puppeteer não estava disponível no escopo de busca autorizado. Não iniciei servidores nem instalei dependências.
- Os roteiros antigos `scripts/visual-qa/verify.cjs` e `assert.cjs` ainda exigem reordenação de cartões e Instagram no Início, removidos por decisão do redesign. Não foram usados como validação do comportamento atual; precisam de atualização antes de uma futura auditoria automatizada de navegador.
- A auditoria visual completa permanece fora das evidências desta frente. Houve inspeção estática e verificação automatizada de lógica, acesso, banco e compilação.

Esta frente não acessou planilhas reais, mudou a matriz de permissões, aplicou migrações, publicou ou executou Git de escrita. As verificações foram serializadas com Android. A gravação do evento de auditoria continua separada da mudança de cargo; uma falha do evento é informada como `audited:false` pela API.
