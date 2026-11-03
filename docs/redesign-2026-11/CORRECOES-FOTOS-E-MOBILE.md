# Correções de fotos e enquadramento móvel — 03/11/2026

O cartão de aprovação de foto e as abas da programação comprimiam textos e ações em telas pequenas. O topo da gestão também mostrava somente iniciais, mesmo quando havia uma foto aprovada.

## Comportamento

- O cartão de aprovação usa uma coluna, foto contida, nomes e companhia completos, e ações empilhadas. As abas mantêm a largura dos rótulos e permitem rolagem horizontal sem sobreposição. Ações e formulários da programação podem quebrar linhas.
- O topo e o menu da gestão exibem a foto aprovada obtida pela API de fotos. O menu inclui “Meu perfil e foto”, nomes e e-mails podem quebrar linhas e o painel fica limitado à tela.
- Somente jovens aguardam aprovação do consultor da própria companhia; a exceção administrativa já existente foi preservada. Os seis outros cargos publicam a própria foto imediatamente.
- O contrato HTTP não ganhou campos: envio de jovem retorna `pending`; envio dos outros cargos retorna `approved`, `approved_url` e `pending_url: null`. O servidor usa o cargo protegido do perfil. Uma mudança concorrente de cargo cancela o envio com 409, sem publicar a foto indevidamente.
- A migração normaliza pendências antigas da equipe e pendências de jovens promovidos para outros cargos, preservando os objetos no bucket privado. O banco continua impedindo edição direta dos campos de foto pelo cliente.
- A foto aprovada anterior de um jovem permanece visível enquanto a substituição está em análise. A fila de revisão contém somente jovens e a decisão verifica se envio, cargo e companhia ainda são os mesmos.
- O estado de foto no site é separado por conta e recarrega ao montar, voltar à janela, recuperar conexão e periodicamente, renovando URLs assinadas. O Android preserva a foto aprovada no acesso ao perfil e informa o resultado efetivo do envio.

## Verificação

As verificações usam somente imagens e identidades fictícias. Lint, tipos e 216 testes do servidor/interface passaram. O roteiro visual passou a medir texto que ultrapassa os botões e colisão entre controles, além do transbordamento do documento.

Cobertura prevista no roteiro: 64 combinações de tela/tamanho/tema, 18 casos com fonte 200%, oito casos de cartões/abas em 320 e 360px, envio direto da equipe e quatro casos do avatar/menu da gestão. Os testes do servidor verificam os sete cargos, o consultor da companhia, mudanças concorrentes e a proteção do banco.

Android: versão 1.2.1 (4), atualização da versão 1.2.0. Os 57 testes debug e 22 testes release passaram; build e lint release aprovados, com zero erros e 54 avisos. O APK preserva o certificado anterior, com assinaturas v2/v3 e alinhamento verificados. Hash do instalador: `91692e27f51a95fb814f57a3da28d2022bd397f44c67b5cc5e172eba3781967d` (10.403.395 bytes). Links e conferência pós-publicação serão registrados no relatório de entrega fora do repositório.

Migração aplicada e verificada no Supabase: `20261103040950_profile_photo_youth_only_review.sql`. Histórico alinhado às onze versões locais; gatilho ativo, restrição validada, bucket privado e função inacessível a `anon`/`authenticated`. Contagens de contas e estados das fotos existentes foram preservados.
