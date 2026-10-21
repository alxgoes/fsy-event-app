# Plano de implementação aprovado — FSY

> Nota de 20/10/2026: o tema foi alterado por ordem do usuário para **Alegrar-se em Cristo**, substituindo a grafia "Alegra-se em Cristo" registrada abaixo como histórico.

Atualizado em 20/10/2026. Escopo autorizado pelo usuário nesta conversa: implementar recuperação do Supabase, segurança, identidade dos formulários, galeria Drive, personalização dos cartões, leitura integral do Instagram, gestão de contas e auditoria Impeccable. Ao final, escrever o manual completo do produto e do design. Aplicativos nativos Android/iOS ficam para uma etapa futura.

Repositório: `https://github.com/alxgoes/fsy-event-app.git`. Site: `https://fsy-event-app.vercel.app/`. Base analisada: `84b22b9935d2f6ef073bcbc9e0edf7a03df2a608`.

## Estado da entrega local e orientação final

Atualização posterior ao plano: execução exclusiva GPT-6.1-Sol medium, sem novos agentes/modelos. Tema exato **Alegra-se em Cristo**. Next 16/React 19, acessibilidade, cache/cancelamento e complemento RLS foram integrados. Lint/tipos, 145 testes serializados, quatro testes PWA após bump v3 e build final com um worker passaram. O root confirmou migrações 001–003 e contagens/políticas remotas preservadas. Por instrução final, a confirmação visual ocorre na CI após push pelo root, sem novo build local e sem aguardar CI neste executor. O manual é a última edição substantiva. A nota >95% não está demonstrada; não converter aprovação de CI em 20/20 automático.

## 1. Contexto para o agente executor

Leia `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `docs/inclusao.md` e os contratos reais. A análise anterior está em `/Users/alexgoes/Documents/FSY/ANALISE-FSY-2026-10-20.md`; o contexto adicional, em `/Users/alexgoes/Documents/FSY/BRIEF-ORCA-FSY.md`.

Política de execução atualizada por instrução do usuário em 20/10/2026: distribuir trabalho entre Claude e GPT para preservar cotas compartilhadas com outros projetos. GPT 6.1 Sol (`gpt-6.1-sol`) assume a implementação principal, com esforço médio como padrão; GPT Sol (`gpt-6-sol`) pode executar tarefas pequenas bem delimitadas quando houver benefício real; GPT Astra (`gpt-6-astra`) fica reservado a uma revisão pontual de risco/arquitetura. Claude Opus 5.5 (`claude-opus-5-5`) deixa de executar continuamente e permanece ocioso após checkpoint, disponível somente para intervenções curtas justificadas. Não criar várias sessões premium simultâneas nem refazer trabalho concluído só para trocar o modelo.

Utilizar skills Superpowers e Impeccable quando disponíveis para o executor, respeitando os requisitos aprovados e sem repetir uma entrevista de descoberta já resolvida. A execução das etapas está autorizada; resolver escolhas reversíveis com julgamento técnico. Não declarar uma habilidade disponível sem verificá-la, nem trocar o modelo silenciosamente. A instrução de preservar cotas prevalece sobre sugestões de grandes equipes, revisões duplicadas e ciclos abertos de polimento das skills.

### Controle de consumo

- Preservar o trabalho do Claude, commits e arquivos ainda não commitados; trocar o executor somente depois do checkpoint seguro. Um único agente escreve no mesmo conjunto de arquivos por vez.
- Usar resumos curtos, diffs e contratos para transferir contexto. Não reler o repositório completo nem repetir a análise original.
- Astra recebe somente os arquivos/diffs relevantes a uma revisão de risco, com tarefa e saída delimitadas; nenhuma implementação geral ou equipe de subagentes premium. Encerrar ao entregar os achados. Não usar esforço máximo por padrão.
- Não reativar Opus como executor principal nem permitir que ele crie subagentes contínuos sem nova necessidade explícita.
- Executar testes pertinentes; repetir somente após mudanças/falhas, sem builds e capturas redundantes.
- Conferir cotas antes de iniciar lote premium e ao encerrar checkpoints importantes. Limites são da conta inteira: não atribuir aumento exclusivamente a este projeto nem garantir consumo futuro exato.
- Não comprar créditos, consumir resets ou mudar plano/assinatura. Se a margem ficar baixa, não iniciar nova tarefa premium; registrar estado e comunicar a necessidade de ajustar o próximo lote.
- Manter o manual funcional/design como última etapa editorial e conservar todo o escopo aprovado.

Snapshot de controle desta alteração: Claude 40% usado na janela de 5 horas, 31% semanal; Codex/GPT 6% usado na janela semanal. São leituras pontuais da conta, sujeitas ao uso em outros projetos; não são orçamento exclusivo do FSY.

A consulta atual ao Claude local encontrou autenticação configurada, mas `claude plugin list` não listou plugins e não foi encontrado Superpowers nos diretórios locais verificados. Conferir o perfil efetivo do terminal Orca. Se não estiver disponível, informar a limitação e prosseguir com as habilidades existentes; a ausência não impede a implementação. Não alegar uso de Superpowers sem carregá-lo.

Impeccable local: `.agent/skills/impeccable/SKILL.md`, versão 4.1.3. Há backend/QA/domínio em `.agent/skills`, com referências antigas a cargos/tema: conferir com o código e os requisitos atuais. O contexto Impeccable apontou sidecar `.impeccable/design.json` desatualizado em relação a `DESIGN.md`; não usar esse sidecar como autoridade visual. Atualização da própria skill é independente desta entrega.

Preservar marca, fatos do evento e programação: preparação em 05/02/2027 e participantes de 06 a 10/02/2027. Comunicação e interface em pt-BR. Não reescrever a aplicação inteira.

## 2. Sequência e dependências

1. Verificar ambiente, registrar estado inicial e criar branch de trabalho antes de editar implementação.
2. Diagnosticar/preservar o Supabase e preparar correções prioritárias de acesso.
3. Retomar/restaurar o backend pelo caminho adequado e validar permissões antes da retomada operacional.
4. Definir contratos, preferências de layout e gestão de contas; criar migrações e testes correspondentes.
5. Implementar formulários, personalização dos cartões, galeria Drive e leitura do Instagram.
6. Integrar gestão administrativa de contas e mensagens de recuperação/contato.
7. Validar segurança, operação, acessibilidade, desempenho e qualidade Impeccable.
8. Preparar entrega/publicação com evidências e procedimento de retorno.
9. Como última etapa editorial, escrever o manual funcional e o guia de design reutilizável, descrevendo o que efetivamente foi entregue.

Trabalho paralelo só com fronteiras claras de arquivos e contratos definidos primeiro, conforme `AGENTS.md`. Um bloqueio de acesso externo não deve impedir as tarefas locais independentes. Manter progresso e impedimentos registrados, sem confundir implementação local, publicação e recuperação efetiva.

## 3. Supabase: diagnóstico e recuperação

- Conferir o projeto realmente utilizado pela Vercel e as variáveis necessárias, sem imprimir chaves/tokens.
- Verificar estado: ativo, pausado, indisponível, projeto incorreto ou removido. O host do `.env.example` não resolveu na análise anterior; isso não prova exclusão.
- Se pausado, retomar com acesso autorizado. Se ativo, corrigir o motivo concreto de conexão. Se retomada impossível, examinar backups antes de propor reconstrução.
- Preservar dados, contas Auth, IDs e configurações antes de migrações. Não executar reset, exclusão do projeto, seed com overwrite ou restauração destrutiva no ambiente existente.
- Inspecionar tabelas, contagens, migrações, Auth, RLS, URLs de redirecionamento, Google OAuth e SMTP.
- Consolidar baseline seguro e migrações reproduzíveis; não reaplicar `schema.sql` após migrações sem revisar as políticas antigas.
- Conta Auth e ficha de participante são entidades distintas; ficha médica pode existir sem login. Não recriar IDs à toa nem perder vínculos.
- Se depender de login/permissão indisponível, pedir somente a intervenção específica necessária e continuar a implementação local possível.

Aceite: diagnóstico com evidência, dados preservados, conexão validada por leitura real e autenticação funcional. Se acesso externo faltar, registrar explicitamente que recuperação ainda está pendente.

## 4. Segurança e arquitetura — prioridade de retomada

Corrigir as falhas do relatório: cadastro público sobrescrevendo perfis; mídia com mutações sem autenticação; promoção de cargos pelo texto do e-mail; CRUD administrativo sem autorização por cargo; exposição de perfis; alteração própria de companhia/quarto; avisos sem isolamento; autoria de logs fornecida pelo cliente.

- Autorizar no servidor cada operação e cada objeto, além do middleware e da interface.
- Chave administrativa somente no servidor, com validação de sessão/cargo antes do uso. Tornar explícita a fronteira server-only.
- Derivar autor, companhia e escopo da identidade confiável; nunca aceitar privilégio em cookie/metadado/corpo como autoridade.
- Validar payloads e campos editáveis; bloquear atribuição arbitrária de colunas.
- Proteger tabelas com RLS/grants e testar acesso direto, inclusive novas preferências de layout.
- Confirmar com o responsável se logística deve continuar acessando saúde/inclusão; não ampliar esse acesso implicitamente.
- Limitar abuso de cadastro, recuperação, e-mail e mutações sensíveis; conferir proteção contra requisições indevidas no contexto de cookies.
- Guardar trilha confiável de alterações administrativas sem senhas, tokens ou conteúdo médico desnecessário.
- Corrigir métricas médicas/totais, datas/fuso, cargos antigos, falhas ocultadas e operações multi-etapas que possam perder dados.
- Revisar dependências vulneráveis e padronizar runtime Node compatível; não usar atualização forçada sem avaliar migração e regressão.

Aceite: testes negativos sem sessão, cargo errado, ID de terceiro, companhia alheia e tentativa de elevar cargo; testes reais de RLS em ambiente de teste. Nenhuma afirmação de proteção absoluta contra ataques.

## 5. Identidade visual dos formulários

Revisar todos os formulários e componentes compartilhados: input, textarea, select, busca, filtros, datas, senha, checkbox, upload e diálogos. Tratar componentes que usam estilos próprios.

Aplicar tokens FSY para superfície, tipografia, bordas, espaçamento, foco, placeholders e estados de erro/sucesso/desabilitado/autofill. Usar contraste legível nos temas claro e escuro e mensagens de validação úteis em pt-BR. Manter semântica e recursos nativos úteis, inclusive gerenciadores de senhas e teclado adequado no celular.

Aceite: consistência antes/durante/depois da digitação, rótulos acessíveis, foco visível, texto ampliado e alvos de toque de pelo menos 44×44 px. Documentar limitações de controles desenhados pelo sistema/navegador em vez de prometer estilização impossível.

## 6. Cartões e layout personalizável em todo o site

Inventariar os cartões e seções de todas as telas, principalmente portal do jovem, consultor e áreas administrativas. Cada pessoa deve poder organizar as caixas da sua própria página, dentro das áreas que seu cargo já permite acessar.

- Criar modo explícito “Personalizar layout”, com alças de arraste claras, salvar/cancelar e “Restaurar padrão”.
- Permitir reordenar as caixas de conteúdo no desktop e por toque em Android/iPhone, mantendo rolagem, leitura, clique e seleção de texto normais fora da alça.
- Oferecer alternativas acessíveis por teclado e botões de mover para cima/baixo; anunciar mudanças a leitores de tela.
- Persistir preferências no Supabase por usuário e página, com versionamento e IDs estáveis; ajustar comportamento por breakpoint quando necessário. Cache local pode ser fallback, com isolamento por conta e limpeza adequada.
- Layout de uma pessoa não altera o de outra. Preferências antigas devem aceitar novos cartões, descartar IDs inválidos e voltar a um padrão utilizável.
- A ordem de cartões é uma preferência visual. A ordem oficial de programação, fotos ou outros dados é uma alteração de conteúdo distinta, autorizada pelo cargo e persistida com seu contrato próprio.
- Onde a tela oferece ordenação administrativa de conteúdo, permitir o gesto de arrastar também, com rótulo claro sobre o que será alterado e testes de autorização. Não mudar datas/horários ou criar uma ordem arbitrária para registros cronológicos por acidente.
- Alertas críticos, navegação e controles essenciais não podem desaparecer nem perder proteção por causa de uma preferência. O usuário pode reorganizar o conteúdo sem ganhar acessos.
- Reduzir animações quando solicitado pelo sistema, evitar saltos de layout, travamentos e excesso de re-renderizações.

Aceite: reordenar, salvar, recarregar, acessar novamente e restaurar; testar duas contas e dois cargos sem vazamento de preferências; teclado, toque e atualização da versão do layout. Registrar cobertura tela a tela; não reduzir silenciosamente o escopo ao dashboard.

## 7. Galeria Google Drive na página “Sou Jovem”

Substituir a apresentação com fundo preto pesado por uma galeria própria coerente com o FSY. Verificar se o problema vem do iframe do Google Drive; quando vier, apresentar as fotos por componentes do portal mantendo o Drive como origem.

Miniaturas responsivas, carregamento progressivo, dimensões reservadas, categorias quando existirem, estado vazio/erro e visualização ampliada acessível. Imagem deve poder ser vista inteira, sem corte permanente; enquadramento da miniatura pode variar desde que a abertura integral seja clara. Evitar depender de pasta privada ou tornar arquivos privados públicos automaticamente.

Aceite: desktop e celular, temas claro/escuro, foto ampliada, teclas/foco/fechamento, links inválidos, arquivo indisponível e nenhuma exposição de foto oculta.

## 8. Instagram com leitura completa

Revisar feed da primeira página e demais componentes que reutilizam os posts.

- Texto inicialmente resumido pode ter “Ver mais” e “Ver menos”, com estado acessível e leitura integral real.
- Em visualização expandida, permitir rolagem natural ou região de rolagem acessível quando a altura exigir; não esconder o fim da legenda atrás de overlays.
- Mostrar quebras de linha, links e caracteres corretamente; não renderizar HTML de terceiros sem sanitização.
- Permitir abrir a imagem/post integral e o original no Instagram; tratar proporções variadas sem corte irrecuperável.
- Tratar post sem legenda, legenda longa, feed indisponível e imagem ausente.
- Remover ou esclarecer curtidas puramente locais que aparentem ação real no Instagram.

Aceite: legenda longa pode ser lida até o fim no celular e desktop sem quebrar o layout ou a personalização dos cartões.

## 9. Administração de contas e acompanhamento de status

Expandir a gestão para combinar perfis do portal e informações Auth por endpoint administrativo no servidor. Usar paginação/filtros, sem expor campos internos desnecessários.

Exibir nome, e-mail, cargo, companhia, provedor de login, criação, confirmação de e-mail, último acesso e estado de acesso/suspensão quando disponíveis. Último acesso não significa “online agora”; não inventar status em tempo real sem presença implementada.

Implementar operações autorizadas:

1. Editar dados e vínculos de conta com validação e registro de autor.
2. Alterar cargo apenas conforme matriz administrativa, protegendo o último administrador habilitado.
3. Suspender/reativar acesso e excluir conta com confirmação explícita na interface, identificando alvo e efeitos nos vínculos. Analisar FKs de inclusão/histórico antes de exclusão; preservar registros que precisam permanecer. Não tratar soft delete do Supabase como reversível sem comprovar sua semântica.
4. Enviar recuperação de senha por e-mail e implementar o fluxo público completo “Esqueci minha senha” → link válido → nova senha → retorno ao login.
5. Permitir redefinição administrativa da senha do portal quando cabível, com autorização reforçada, sem visualizar/recuperar a senha atual e sem registrar ou enviar senha em texto aberto. Não realizar troca real de senha de terceiros como teste.
6. Para conta Google, identificar o provedor e oferecer recuperação/acesso alternativo do portal conforme recursos suportados e verificação do titular. Não prometer alterar ou recuperar senha do Google. Preservar a identidade/ID e evitar contas duplicadas.
7. Compor mensagem por e-mail para a pessoa selecionada, com destinatário explícito, assunto, prévia e confirmação de envio, por serviço transacional/SMTP configurado no servidor. Diferenciar “aceito para envio” de entrega confirmada.

Links devem usar origens permitidas, expirar e não vazar em logs. Prevenir enumeração no fluxo público, abuso de recuperação e envios repetidos. Proteger ações contra autoexclusão/bloqueio acidental e alterações indevidas de cargos superiores conforme matriz definida.

Durante a implementação, usar mocks/caixa de teste para envio. O pedido autoriza construir a funcionalidade, não enviar mensagens reais a participantes sem conteúdo/destinatário escolhidos para esse envio. Exclusões de contas reais não são necessárias para testar.

Referências oficiais consultadas: https://supabase.com/docs/guides/auth/passwords, https://supabase.com/docs/guides/auth/auth-identity-linking, https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid, https://supabase.com/docs/reference/javascript/auth-admin-deleteuser, https://supabase.com/docs/guides/auth/managing-user-data. Conferir a documentação vigente ao implementar.

Aceite: permissões por cargo, alvo de terceiro, última conta administrativa, confirmação, auditoria, recuperação end-to-end em conta de teste e envio simulado sem vazamento de segredo.

## 10. Impeccable, legibilidade e comportamento

Usar a identidade existente como base. Revisar todas as telas: login, portal jovem, programação, avisos, consultor, módulos administrativos, formulários, modais, galeria, PWA e novos estados.

- Corrigir textos misturados ao fundo, placeholders ilegíveis, contraste, sobreposição, transbordamento e textos cortados.
- Remover padrões visuais/textos genéricos de IA e loops de redirecionamento, busca, efeitos ou salvamento. Preservar animações de identidade intencionais, limitando trabalho quando fora da tela e respeitando redução de movimento.
- Verificar temas claro/escuro, smartphone/tablet/desktop, zoom de texto, teclado, leitores de tela e toque.
- Executar o detector e revisar cada achado em contexto; não silenciar regra ou alterar critérios para melhorar nota.
- Aplicar ciclos de verificação limitados e correções em lotes, registrando pendências reais, sem polimento infinito.

Meta do usuário: nota geral acima de 95% no Impeccable. Na versão local, `/impeccable audit` pontua cinco dimensões de 0 a 4, total de 20: acima de 95% exige 20/20 (19/20 é exatamente 95%). Apresentar pontuação original e percentual, escopo, evidências, data e limitações. Não inventar nota nem confundir com Lighthouse. Se a versão do avaliador mudar, registrar método/denominador e preservar a exigência acima de 95%.

Uma pontuação visual não substitui revisão de segurança. Nenhum P0/P1 conhecido de acesso ou perda de dados deve ser considerado resolvido por uma média. Se a meta não puder ser demonstrada, informar o resultado real e o que falta.

Aceite: relatório real do Impeccable com evidências por dimensão/tela e correções comprovadas, sem certificado fictício do site inteiro.

## 11. Verificação integrada e entrega

- Rodar `npm run lint`, `node --test tests/*.test.cjs` e `npm run build`, além dos testes novos necessários.
- Cobrir autorização de todos os endpoints afetados, RLS, recuperação, contas, layouts persistidos, legendas longas e ordenação administrativa.
- Testar migrações em banco de teste e distinguir build com variáveis fictícias de integração com Supabase real.
- Conferir fluxos por cargo em ambiente autenticado, instalação PWA e cache sem dados médicos privados.
- Registrar evidências visuais antes/depois, dispositivo/viewport e limitações. Não afirmar teste em aparelho físico se só houve emulação.
- Preparar publicação e retorno de versão/migração. Não confundir commit/PR com deploy ou banco migrado. Evitar expor relatório detalhado de vulnerabilidades ainda abertas em artefato público.

Base anterior passou lint/build e 32 testes; isso não dispensa verificar a versão alterada. Não executar alterações destrutivas em produção para provar correções. Novos aplicativos nativos estão fora desta entrega.

## 12. Última entrega: manual funcional e de design reutilizável

Após integração e verificações, escrever `docs/manual-funcional-e-design.md` em pt-BR, com índice e exemplos concretos. O conteúdo deve corresponder ao comportamento final implementado e diferenciar o que depende de configuração ou ficou pendente.

O manual deve explicar:

- Finalidade do site, públicos, papéis e matriz de permissões.
- Login, cadastro, recuperação, conta Google e administração de contas/status/e-mails.
- Todas as páginas, módulos e ações; programação, companhias, consultores, logística, saúde/inclusão e auditoria.
- Personalização dos cartões, salvamento, restauração e diferença entre layout individual e ordem de conteúdo.
- Galeria Drive, Instagram, leitura integral e funcionamento dos estados vazios/erros.
- Instalação PWA iOS/Android, limites offline e diferença para os aplicativos nativos futuros.
- Arquitetura, contratos, tabelas, integrações, migrações, ambiente e operação sem expor credenciais.
- Sistema visual: paleta/tokens, tipografia, superfícies, campos, cartões, estados, responsividade, contraste, foco e movimento.
- Padrões reutilizáveis em futuros projetos, separando infraestrutura genérica dos fatos e marca específicos do FSY.
- Rotina de manutenção, testes, backup/recuperação e publicação/retorno.
- Evidências da auditoria, limitações e pendências efetivas.

Atualizar README e documentos de operação necessários. Criar o manual como última etapa editorial substantiva, depois de verificar a implementação; não entregar um manual descrevendo funcionalidades apenas planejadas.

## 13. Registro obrigatório de progresso

Manter checklist em `implementation_plan.md` ou documento de progresso, indicando por etapa: não iniciada, em andamento, concluída ou impedimento concreto. Atualizar `walkthrough.md` com implementação e testes reais. Pedir intervenção somente quando depender de acesso, decisão de domínio ainda não resolvida ou ação irreversível; continuar tarefas independentes autorizadas.
