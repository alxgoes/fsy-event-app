# Relatório de inscrições e autorizações — 02/11/2026

## Alterações

O importador mantém a inscrição aprovada mais recente entre duplicatas; sem aprovação, usa a data/hora mais recente. Descartes geram avisos com a data mantida e os campos divergentes. Sobrenome vazio também gera aviso. A identidade usa CPF/documento ou nome normalizado com nascimento, separando homônimos. A tolerância existente do cabeçalho AC foi preservada e testada. Somente falhas estruturais bloqueiam a importação.

Cancelados permanecem guardados, fora das contagens por tipo e das autorizações. Aguardando aprovação e lista de espera têm etiquetas. A interface oferece arrastar arquivo, resumo com avisos agrupados, confirmação, busca, filtros, seleção múltipla e downloads dos selecionados ou de todos os aprovados, em partes de até 50 PDFs.

O detalhe permite editar dados da autorização, validar CPF/data/telefone, visualizar o PDF, salvar e desfazer ajustes. Os dados originais permanecem intactos. Ajustes registram autor/data e exibem selo “Editado”. A reimportação preserva ajustes da mesma identidade; substituir inscritos ajustados exige confirmação explícita, conferida novamente na transação.

Foram acrescentados PATCH de detalhe e POST de prévia sem persistência, mantendo cargos de gestão, validação de origem e respostas privadas. Testes verificam que jovem recebe 403 e não alcança armazenamento. A página também verifica o cargo no servidor.

## PDFs

Foram gerados e revisados 38 PDFs exclusivamente da fixture sintética, em `amostras-pdf/`. A extração dos streams é testada; uma conferência independente com `pdftotext` confirmou nomes, datas, documentos, CPF, telefones, responsável, estaca/ala, bispo, camiseta e textos médicos/alimentares nos 38 arquivos, sem avisos de capacidade.

A revisão visual incluiu folha de contato, exemplo acentuado e nome longo com saúde em duas linhas. Corrigiu-se também a leitura de “Sexo feminino/masculino”, agora marcada nos 38 PDFs. O modelo original permanece intacto, com uma página e campos legais desconhecidos em branco. Textos excessivos preservam o conteúdo e emitem aviso de capacidade para conferência. Os nomes de download seguem `autorizacao-<nome>-<sobrenome>.pdf`, sem acentos.

## Verificações repetidas após a revisão final

- `npm.cmd run lint -- --no-cache`: aprovado, sem erros ou avisos.
- `npm.cmd run typecheck -- --incremental false`: aprovado.
- `npm.cmd test`: **197 aprovados, zero falhas, zero ignorados**, concorrência de um arquivo.

As opções evitam gravar cache fora dos diretórios autorizados. Build e servidores Next não foram executados.

## Migração e pendências

Migração aditiva: `supabase/migrations/202611020002_registration_authorization_adjustments.sql`, com tabela separada, RLS forçada, acesso exclusivo do servidor e proteção transacional contra perda de ajustes. A cadeia de migrações foi validada em PGlite; falta aplicá-la no ambiente de destino.

O complemento de contrato está em `CONTRATO-AJUSTES-INSCRICOES.md`: o contrato anterior fica fora dos diretórios editáveis e não foi alterado. Falta incorporar esse complemento ao documento central quando autorizado.

Não houve homologação interativa web nem execução de `/impeccable audit`, indisponível nesta sessão; houve revisão manual de código e dos PDFs. Nenhuma planilha real foi procurada ou utilizada; nenhum git de escrita foi executado; `android/**` não foi alterado por este trabalho.
