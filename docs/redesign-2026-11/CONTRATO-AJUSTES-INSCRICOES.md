# Ajustes de autorizações — complemento do contrato web/Android

Complementa `docs/contratos-inscricoes-e-autorizacoes.md`. Este complemento fica no diretório autorizado pelo brief; o documento anterior não foi editado.

## Acesso e privacidade

Todos os endpoints continuam exclusivos de `userManagers` (coordenador, casal diretor e logística ativos), por cookie web ou Bearer nativo. Respostas usam `Cache-Control: private, no-store, max-age=0` e `Vary: Cookie, Authorization`. Mutações e prévias POST exigem a mesma validação de origem das rotas existentes. Jovem recebe 403; a página web o redireciona ao início.

## Dados originais e ajustes

`RegistrationRecord` mantém os campos importados e `rawColumns` intactos. Acrescenta `hasAuthorizationAdjustments` e `authorizationAdjustments`, que é nulo ou:

```ts
{
  values: AuthorizationAdjustmentValues;
  editedByUserId: string;
  editedByName: string;
  editedAt: string; // ISO 8601
}
```

A projeção `minimal` retorna o selo booleano, mas omite os valores dos ajustes. A autoria vem da sessão e do perfil protegido, nunca do corpo enviado pelo cliente.

`AuthorizationAdjustmentsSchema`, em `src/types/registrations.ts`, aceita somente: `firstName`, `lastName`, `birthDate`, `sex`, `phone`, `cpf`, `documentRgOrPassport`, `issuingAgency`, `guardianName`, `guardianPhone`, `stakeName`, `wardName`, `bishopName`, `bishopEmail`, `tshirtSize`, `medicalInfo`, `dietaryInfo`, `healthConditionsSummary`, `healthConditionsDetails`.

Valores são strings; vazio limpa um campo opcional. Nome não pode ser vazio. Data deve ser uma data real de nascimento, passada, em dd/mm/aaaa. CPF deve ter 11 dígitos e verificadores válidos; telefone deve ter DDD e 10/11 dígitos, aceitando formatação e prefixo +55. Apenas campos alterados precisam ser enviados; avisos de dados importados não impedem corrigir outro campo.

## PATCH `/api/admin/registrations/[id]`

Mescla campos enviados com ajustes existentes:

```json
{"adjustments":{"guardianName":"Conceição Fictícia","phone":"(16) 99999-0000"}}
```

Desfaz todos os ajustes, voltando a usar o original:

```json
{"resetAdjustments":true}
```

Retorna 200 com `RegistrationRecord` atualizado; 400 para ID/corpo inválidos; 401/403 para acesso negado; 404 para inscrição ausente. A gravação é atômica, serializada com importações, e registra autor/data também ao desfazer. Não altera identidade, situação, cargo, contadores nem planilha original.

## Prévia e downloads

POST `/api/admin/registrations/[id]/authorization-pdf?download=0` aceita `{"adjustments":{...}}` e devolve PDF com original + ajustes salvos + rascunho, sem persistir. Para prévia sem rascunho, use GET com `download=0`. Mesmas regras de acesso, validação e cabeçalhos do download. GET individual e ZIP usam os ajustes salvos automaticamente.

Arquivos individuais: `autorizacao-<nome>-<sobrenome>.pdf`, sem acentos. Homônimos em um ZIP recebem ID no nome para evitar colisão. Cancelados não geram PDF individual (409) e são excluídos dos ZIPs. Seleção explícita permite pendentes; lote por filtro inclui somente aprovados (e `Confirmado` legado), até 50 por parte. Cabeçalhos de progresso e manifesto permanecem compatíveis.

## Reimportação e retenção

A tabela privada `registration_authorization_adjustments` referencia o ID canônico. Upsert e substituir tudo preservam esse ID e seus ajustes quando a chave de identidade coincide. A exclusão do inscrito/lote elimina seus ajustes em cascata. A migração aditiva é `202611020002_registration_authorization_adjustments.sql`, com RLS forçada, sem grants para PUBLIC/anon/authenticated e RPCs exclusivas do servidor.

O resumo da prévia acrescenta `authorizationAdjustmentImpact: { retainedCount, removedCountOnReplaceAll }`. Substituições que removeriam inscritos ajustados exigem `acknowledgeAdjustmentRemoval: true` no commit e confirmação explícita na interface. A RPC confere isso novamente dentro da transação, inclusive para ajustes gravados após a prévia. Identidades legadas cuja chave mudou aparecem como remoção/inserção, com o mesmo aviso de perda de ajustes; não são mescladas por similaridade.

## Importação e situação

Identidade: CPF presente com 11 dígitos, senão documento normalizado + nascimento, senão nome normalizado + nascimento. CPF inválido gera aviso, sem inventar zeros. Entre duplicatas permanece a aprovada mais recente, senão a mais recente por data/hora; cópias idênticas das abas de tipo e `Todas` são unificadas. Descartes geram avisos com data mantida e campos divergentes. Sobrenome ausente gera aviso. Somente falhas estruturais do arquivo/abas/cabeçalhos e planilha vazia bloqueiam a importação. Cancelados são guardados, mas excluídos das contagens por tipo e das autorizações; pendentes têm situação visível.
