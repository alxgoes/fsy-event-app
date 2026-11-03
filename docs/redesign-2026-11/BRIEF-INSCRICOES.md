# Brief — Importação de inscrições e autorizações dos pais (web) · nov/2026

Repositório: `D:\Projects\PC\FSY\fsy-event-app` (branch `feat/redesign-simplificacao-2026-11`).

## Regras (obrigatórias)
- **Dados pessoais de menores.** Use SOMENTE a planilha fictícia `tests/fixtures/inscricoes-2027-sintetica.xlsx`.
  Não procure, abra ou copie nenhuma planilha real (Downloads, Desktop etc.). Nunca grave dados reais em logs, testes ou documentos.
- Edite somente `src/**`, `tests/**`, `supabase/migrations/**`, `public/templates/**` (se precisar) e `docs/redesign-2026-11/**`.
  Outro agente edita `android/**` ao mesmo tempo. **Nenhum comando git de escrita.** Não rode `next dev`/`next start`.
- Todas as rotas continuam restritas à gestão (grupo de cargos já usado nas rotas de inscrições). Jovem nunca acessa nem vê a existência disso.
- pt-BR em tudo. Leia `DESIGN.md` e `docs/contratos-inscricoes-e-autorizacoes.md` antes.

## Contexto
A planilha oficial exportada pela Igreja tem 3 abas (`Consultor`, `Participante`, `Todas` = união das duas) e 34 colunas (A–AH);
a fixture reproduz exatamente os cabeçalhos e os padrões reais. O orquestrador rodou o importador na planilha real (localmente) e achou:
1. **Corrigido pelo orquestrador:** o cabeçalho longo da coluna AC muda de redação a cada ano → `headersMatch()` em `src/lib/registrations/xlsx-parser.ts`
   (normaliza acentos/espaços e, para frases longas, compara só o início). Mantenha e cubra com teste.
2. **Duplicatas conflitantes bloqueiam a planilha inteira** (17 casos reais): a mesma pessoa aparece 2× porque cancelou e se inscreveu de novo
   ou atualizou dados. Coluna S "Situação" tem `Aprovado`, `Cancelado`, `Aguardando aprovação`, `Em lista de espera`; coluna R "Data" é
   `dd/mm/aaaa, hh:mm:ss`. Regra nova: entre duplicatas, fica a inscrição **Aprovada** mais recente (senão a mais recente de qualquer situação);
   as outras viram aviso "Inscrição duplicada: mantida a de dd/mm" com as colunas que divergiam. **Não bloqueia.**
3. **Sobrenome vazio bloqueia tudo** (1 caso): vira aviso; o nome completo usa só o nome.
4. **Pessoas diferentes confundidas** (CROSS_SHEET_MISMATCH / chave de deduplicação): a chave não pode juntar duas pessoas com mesmo nome e
   data de nascimento/documento diferentes. Reveja `computeRegistrationDedupKey` (use documento/CPF quando houver, senão nome normalizado + data de nascimento).
5. Só bloqueia de verdade: arquivo que não é planilha, abas ausentes, cabeçalhos realmente incompatíveis, planilha vazia.
6. Inscrições `Cancelado` ficam guardadas mas fora das autorizações e das contagens de participantes; `Aguardando`/`Lista de espera` aparecem com etiqueta.

## Autorizações dos pais (PDF)
O gerador está em `src/lib/pdf/authorization-pdf.ts` com o modelo `ficha-autorizacao-template.pdf`. Verifique com a fixture que cada PDF sai
**sem erro**: acentos, nomes longos (quebra/redução de fonte sem cortar), datas dd/mm/aaaa, CPF formatado 000.000.000-00, RG com órgão emissor,
telefones formatados, responsável, estaca/ala, bispo, informações médicas/alimentares, camiseta. Gere PDFs da fixture em
`docs/redesign-2026-11/amostras-pdf/` (são fictícios) e confira o texto extraído de cada um (ex.: `pdf-parse` se já existir, ou leitura do conteúdo) em teste.
Download individual e em lote (ZIP) com nome de arquivo `autorizacao-<nome>-<sobrenome>.pdf` sem acentos.

## Edição antes de baixar (novo)
- Na ficha de cada inscrito (gestão › Inscrições › detalhe), botão **"Editar dados da autorização"**: formulário com os campos que vão para o PDF,
  validação (CPF com dígito, datas, telefones), **pré-visualização do PDF** atualizada e "Salvar".
- Guardar as edições como **ajustes** separados dos dados importados (o original da planilha nunca é perdido; reimportar não apaga ajustes
  sem avisar), com quem editou e quando; selo "Editado" na lista; botão "Desfazer ajustes".
- API: `PATCH /api/admin/registrations/[id]` (mesmo grupo de cargos, mesma origem, schema Zod em `src/types/registrations.ts`), e o PDF usa
  dados importados + ajustes. Se precisar de coluna/tabela nova, crie migração aditiva em `supabase/migrations/` com RLS igual às tabelas de
  inscrições existentes (sem acesso para `anon`/`authenticated`; só o servidor).
- Contrato documentado em `docs/contratos-inscricoes-e-autorizacoes.md` (o app Android vai consumir depois).

## Interface
Tela de Inscrições mais simples: importar (arrastar arquivo) → resumo claro (X inscritos, Y avisos agrupados por tipo, nada técnico) →
confirmar. Lista com busca, filtro por tipo/situação/estaca, seleção múltipla, "Baixar autorizações" (selecionados ou todos aprovados).

## Verificação
`npm run lint`, `npm run typecheck`, `npm test` (adicione testes: duplicatas resolvidas, sobrenome vazio, homônimos separados,
cabeçalho AC alternativo, PDF com acentos/nome longo, PATCH com ajustes e desfazer, jovem recebe 403/404).
Não rode `npm run build` (sem acesso às fontes do Google no sandbox).

## Entrega
`docs/redesign-2026-11/RELATORIO-INSCRICOES.md` (até 600 palavras): o que mudou, resultados dos comandos, migração nova (se houver) e pendências.
