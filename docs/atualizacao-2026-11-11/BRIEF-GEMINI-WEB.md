# Brief Gemini — WEB/servidor (11/11/2026)

Repositório `D:\Projects\PC\FSY\fsy-event-app`, branch `feat/whatsapp-fotos-enquadramento-2026-11`.
Leia primeiro, inteiro: `docs/atualizacao-2026-11-11/ARQUITETURA.md` (contrato — siga à risca), `DESIGN.md`, `AGENTS.md`.

## Limites
- Edite **somente** `src/**`, `tests/**`, `supabase/migrations/**`, `scripts/visual-qa/**`. Outro agente edita `android/**` em paralelo: não toque.
- **Nenhum git de escrita** (commit/checkout/reset/stash/clean/restore). Não aplique migração em banco nenhum. Não rode `next dev`/`next start`
  fora do roteiro `scripts/visual-qa/verify.cjs`. Não abra nem procure planilhas reais (dados de menores) — só `tests/fixtures/*-sintetica.xlsx`.
- pt-BR, sem jargão técnico na interface. Alvos de toque ≥ 44 px. Jovem nunca vê nada de gestão/consultor.
- Lint do projeto proíbe `setState` síncrono em `useEffect` (use `startTransition` ou derive).

## Tarefas
1. **Link do WhatsApp da companhia** — implementar exatamente o item 2 de ARQUITETURA.md: migração, `src/types/company-whatsapp.ts`,
   `src/app/api/companies/whatsapp/route.ts`, interface do jovem (Início + Mais), do consultor (`CounselorPanel.tsx`) e da gestão (`CompanyManager.tsx`).
2. **Escopo do consultor** (item 3): auditar as rotas listadas; corrigir qualquer caso em que um consultor alcance outra companhia; testes por rota.
3. **Paridade com o app** (item 4): teste `tests/native-api-parity.test.cjs`. Confirmar com teste que `/api/profile/photo` aceita Bearer no proxy
   (o orquestrador já incluiu `/api/profile` em `BEARER_API_PREFIXES`).
4. **Enquadramento web** (item 5): rodar/estender `scripts/visual-qa/verify.cjs` (já mede texto que ultrapassa botões e colisões) para cobrir
   `/mais`, `/fotos`, `/consultor`, `/admin/companies`, `/admin/inscricoes` e os novos diálogos em 320/360/390/768/1280 px, fonte 100 % e 200 %,
   claro/escuro. Corrigir tudo o que vazar. O roteiro usa Puppeteer por `FSY_PUPPETEER_MODULE`; se não houver Puppeteer disponível, faça a
   auditoria estática (alturas fixas, `whitespace-nowrap`, `truncate` em rótulos de ação, linhas de botões sem `flex-wrap`) e diga isso no relatório.
5. Testes novos (padrão `tests/*.test.cjs`, harness em `tests/helpers/`): migração (RLS: `authenticated` não lê nem escreve a tabela),
   GET por cargo (jovem só a própria; consultor só a própria; gestão todas; outra companhia nunca vaza), PUT (consultor de outra companhia → 404,
   jovem → 403, link inválido → 400, normalização, remover com `null`, auditoria sem o link), `normalizeWhatsappInvite`.

## Verificação obrigatória (rodar e colar o resultado no relatório)
`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

## Entrega
`docs/atualizacao-2026-11-11/RELATORIO-WEB.md` (até 500 palavras): arquivos alterados, o que foi corrigido no escopo do consultor,
achados de enquadramento (antes/depois), resultado honesto de cada comando, e o que ficou pendente. Não diga que algo passou sem ter rodado.
