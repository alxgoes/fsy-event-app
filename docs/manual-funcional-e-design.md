# Manual funcional e de design — FSY Sessão Ribeirão Preto 2

Versão local verificada em 20/10/2026. Preparação da equipe em **05/02/2027**; participantes de **06 a 10/02/2027**. Tema: **Regozijai-vos em Cristo / Rejoice in Christ**, Filipenses 4:4. Este é o portal da sessão Ribeirão Preto 2, sem representar um portal institucional global.

O manual descreve o código entregue. A conexão real com Supabase, migrações externas, configuração de e-mail e publicação continuam pendentes. A auditoria ampliada ficou em **14/20 (70%)**, abaixo da meta acima de 95%. Consulte a seção 13 antes de preparar a operação do evento.

## Índice

1. Finalidade e públicos
2. Papéis e permissões
3. Entrada, cadastro e recuperação
4. Páginas e tarefas do dia a dia
5. Gestão de contas
6. Personalização dos cartões
7. Fotos do Drive e Instagram
8. Instalação PWA e conectividade
9. Sistema visual e acessibilidade
10. Arquitetura, contratos e dados
11. Configuração e migrações
12. Manutenção, publicação e retorno
13. Evidências, limitações e pendências

## 1. Finalidade e públicos

O portal reúne programação, companhia, alojamento, comunicados e mídia. Consultores acompanham seus jovens e publicam para a própria companhia. Saúde e inclusão mantêm registros privados. Logística organiza transporte; mídia publica fotos; coordenação e casal diretor acompanham a sessão e administram os módulos permitidos.

Conta de acesso, perfil e ficha médica são entidades distintas. É possível cadastrar uma ficha e acompanhar inclusão sem criar login para o participante. Não é necessário recriar identidades para vincular dados existentes.

A interface usa português do Brasil e foi pensada para uso móvel. Datas do evento e atividades atuais são interpretadas no fuso **America/Sao_Paulo**, independentemente do fuso do aparelho.

## 2. Papéis e permissões

A fonte executável é `src/lib/auth/permissions.ts`. A interface apresenta os controles; o servidor revalida a identidade e as permissões a cada operação, com políticas do banco como outra camada.

| Cargo | Destino inicial | Operação principal |
| --- | --- | --- |
| `jovem` | `/dashboard` | Portal, programação, avisos gerais/da companhia e seus próprios dados permitidos |
| `consultor` | `/consultor` | Companhia atribuída, jovens vinculados e comunicados da companhia |
| `midia` | `/admin/media` | Gestão de fotos e mídia |
| `medico` | `/admin/medical` | Saúde, atendimentos e inclusão |
| `logistica` | `/admin` | Gestão operacional, companhias, programação, avisos, mídia, auditoria e contas de cargos inferiores |
| `coordenador` | `/admin` | Gestão dos módulos e contas inferiores; ações sensíveis conforme a matriz |
| `casal_diretor` | `/admin` | Gestão geral, sujeita às proteções de própria conta e última administração |

Saúde/inclusão preservam o acesso de `medico`, `logistica`, `coordenador` e `casal_diretor`. A permanência do acesso da logística ainda exige a decisão de domínio registrada no plano; não foi ampliada nesta retomada.

Na gestão de contas, a hierarquia é casal diretor → coordenador → logística → demais cargos. Coordenador e logística gerenciam cargos inferiores. O casal diretor pode gerenciar os demais alvos, respeitando as proteções. Suspender, excluir ou definir uma senha administrativa exige `coordenador` ou `casal_diretor` e autorização sobre o alvo. Logística não executa essas ações sensíveis.

Não é permitido alterar o próprio cargo, suspender/excluir a própria conta ou redefinir a própria senha pela ação administrativa. A última conta administrativa habilitada, considerando coordenação e casal diretor, é protegida também no banco. Jovens não escolhem cargo, companhia ou quarto pelo cadastro público. E-mail e metadados fornecidos pelo usuário não conferem privilégios.

## 3. Entrada, cadastro e recuperação

### Entrar e cadastrar

Em `/login`, escolha entrar, cadastrar-se ou recuperar acesso. O cadastro usa Supabase Auth e cria perfil com cargo inicial `jovem`; informações como nome, estaca e telefone complementam o cadastro. Se o projeto exigir confirmação de e-mail, a pessoa precisa seguir o link enviado pelo Auth antes de entrar.

O botão de Google depende de o provedor e seus redirecionamentos estarem configurados no projeto. O fluxo preserva a identidade mantida pelo Supabase. Não existe entrada de demonstração que conceda acesso administrativo.

### Esqueci minha senha

1. Escolha **Esqueci minha senha** ou o modo de recuperação.
2. Informe o e-mail da conta.
3. O portal apresenta uma resposta genérica, sem revelar se o endereço existe.
4. Abra o link válido recebido e defina a nova senha em `/redefinir-senha`.
5. Retorne à entrada conforme a orientação da tela. Link inválido/expirado exige novo pedido.

A validade e os requisitos adicionais de senha dependem da configuração do Supabase; a aplicação valida sua política local e exibe os erros suportados. O processo aceita o retorno de recuperação do Auth e a confirmação por `token_hash` em `/auth/confirm`. As Redirect URLs precisam ser configuradas antes do uso externo.

Em conta Google, a recuperação pode criar uma senha **do portal** para o mesmo cadastro, conforme os recursos do Auth. Não altera nem recupera a senha do Google. A integração desse caso precisa ser validada em conta de teste no projeto real.

## 4. Páginas e tarefas do dia a dia

| Página | O que oferece |
| --- | --- |
| `/dashboard` | Saudação, dados da companhia/quarto, informações da sessão, programação ou contagem regressiva, avisos, galeria e Instagram |
| `/schedule` | Programação por dia com horário, local, categoria e descrição. Dia Zero aparece para a equipe habilitada; jovens veem dias 1 a 5 |
| `/announcements` | Consulta e busca de comunicados gerais/da companhia, prioridade e interações do portal |
| `/consultor` | Dados da companhia, lema, indicadores, mural de comunicados e lista de jovens com busca e contatos disponíveis |
| `/admin` | Indicadores consolidados, acessos aos módulos e comunicados recentes |
| `/admin/companies` | Companhias, vínculos de participantes e consultores, lema e demais dados permitidos |
| `/admin/schedule` | Cadastro/edição da programação oficial pela equipe autorizada |
| `/admin/announcements` | Gestão dos comunicados e seu escopo |
| `/admin/media` | Cadastro, edição, visibilidade e remoção autorizada de registros de fotos |
| `/admin/logistics` | Operações de transporte e informações de ônibus/caravanas |
| `/admin/medical` | Fichas médicas, atendimentos e acompanhamento de inclusão |
| `/admin/counselor-audit` | Histórico de alterações/publicações dos consultores, busca e filtros |
| `/admin/users` | Contas e acessos, detalhados na seção 5 |
| `/offline`, `/acesso-negado` | Orientação sem conexão ou sem permissão |

A programação consulta dados disponíveis e dispõe de fallback da programação oficial. Não há presença ou sincronização contínua prometida. No portal, o cálculo da atividade é atualizado a cada minuto sem refazer a busca: um intervalo sem atividade não inventa um evento em andamento; a próxima atividade é selecionada cronologicamente. Antes do evento aparece a contagem regressiva; depois, a edição é identificada como concluída.

Os indicadores administrativos consultam `medical_records` para prontuários e contam os comunicados independentemente da lista limitada de recentes. Esses indicadores não são uma medição de pessoas online.

### Consultor

O painel exige companhia atribuída para as ações correspondentes. Permite editar o lema, publicar comunicados com prioridade/categoria e consultar os jovens vinculados. O servidor deriva autor e escopo confiável da sessão. O painel oferece confirmação antes de remover um comunicado.

Os contatos exibidos permitem abrir telefone ou WhatsApp quando informados. A existência do atalho não comprova que o número está atualizado nem envia uma mensagem automaticamente.

### Saúde e inclusão

As fichas registram informações médicas e contatos de referência. Busca, filtros de alergias graves e indicadores ajudam a equipe a localizar participantes. Atendimentos usam `medical_appointments`, separados dos dados de transporte; o jovem só recebe a informação própria permitida, sem notas internas da equipe.

Em **Inclusão**, selecione uma ficha existente ou cadastre um jovem sem login. Registre necessidades, apoios, contatos, entrevistas e fase do acompanhamento. Uma entrevista realizada exige resumo. A decisão é humana e exige justificativa; participação com apoio exige plano. Arquivar preserva o histórico.

Alterações de inclusão usam versão e transação. Um formulário desatualizado recebe conflito e deve ser recarregado. Fichas com acompanhamento não são apagadas por cascata. Veja também [Acompanhamento de inclusão](inclusao.md).

## 5. Gestão de contas

A lista combina dados do Supabase Auth e perfis do portal, com paginação/filtros. Exibe, quando disponíveis: nome, e-mail, cargo, companhia, provedor, criação, confirmação de e-mail, último acesso e estado de suspensão. **Último acesso não significa online agora.** A implementação busca contas do evento com limite de segurança de dez mil; não é um diretório de escala ilimitada.

As ações oferecidas dependem do cargo e do alvo:

- **Editar dados e vínculos:** valida campos e companhia. Autoria é registrada no servidor.
- **Alterar cargo:** aplica hierarquia e protege a última administração habilitada.
- **Suspender/reativar:** suspensão bloqueia o perfil antes do banimento no Auth; reativação libera o perfil depois do Auth. Se uma etapa falhar, o resultado pode permanecer bloqueado; conferir/repetir a ação. Não há uma transação HTTP única entre os dois serviços.
- **Excluir:** exige confirmação do alvo e recusa vínculos que precisam permanecer, como inclusão, histórico, atendimentos ou fotos. Use suspensão quando for necessário preservar registros. Não há lixeira/recuperação prometida para exclusão física.
- **Recuperação de senha:** envia pelo Auth ao e-mail da conta, conforme configuração e permissões.
- **Definir nova senha do portal:** somente direção/coordenação autorizada; a senha anterior não é lida. A nova senha não é devolvida nem registrada na auditoria. Para a própria conta, use recuperação.
- **E-mail individual:** selecionar destinatário, escrever assunto e mensagem, revisar e confirmar. O backend usa Resend quando configurado; a resposta significa **aceito para envio**, sem comprovar entrega na caixa postal.

A trilha administrativa registra ator, alvo, ação, data e detalhes limitados. Não contém senhas nem o corpo integral da mensagem. Se a gravação da auditoria falhar depois de uma ação, o retorno indica seu estado; a equipe deve conferir o resultado, sem presumir que repetir uma exclusão é inofensivo.

Falha ao consultar o perfil de um alvo interrompe a operação: não é tratada como prova de cargo inferior. Os testes de recuperação/envio/remoção usam mocks e identidades fictícias. Não foram enviados e-mails ou excluídas contas reais para validar a entrega.

## 6. Personalização dos cartões

Escolha **Personalizar layout** no grupo disponível. Fora desse modo, a página mantém clique, seleção e rolagem normais.

1. Use a alça para arrastar com mouse/toque.
2. Alternativamente, use **Subir/Descer** ou, na alça, Enter e as setas conforme o rótulo.
3. **Salvar layout** confirma a ordem; **Cancelar** descarta o rascunho.
4. **Restaurar padrão** repõe a sequência original no rascunho; salve para confirmar.

Mudanças são anunciadas para leitores de tela e o foco acompanha o controle usado. A preferência é individual, por conta e grupo/página, com versão e IDs estáveis. Usa uma mesma ordem para celular e desktop (`all`). Cartões desconhecidos são descartados; novos cartões entram numa posição utilizável.

O salvamento usa `user_layout_preferences` com RLS e cópia local isolada. Se a sincronização falhar, a tela informa **salvo só neste aparelho**. Troca de conta não deve reutilizar a preferência de outra pessoa. A persistência real entre aparelhos depende de aplicar as migrações e restabelecer o banco.

Cobertura: cartões do portal; indicadores e módulos administrativos; indicadores e formulário/lista do mural do consultor; indicadores das fichas médicas. Alertas, navegação, busca e abas essenciais ficam fixos. Listas/tabelas de registros, cronologia oficial e fluxos de entrada não são reordenados. A cobertura tela a tela está em [implementation_plan.md](../implementation_plan.md).

**Ordem visual não é ordem de conteúdo.** Mover o cartão Programação não altera horários; mover o mural não muda prioridade ou data dos avisos. Não foi identificado contrato de ordem editorial livre que justificasse criar um arraste administrativo de registros.

## 7. Fotos do Drive e Instagram

### Galeria

O Drive permanece como origem; a página usa uma grade própria em lugar do palco/iframe pesado. Categorias aparecem quando há mais de uma. As miniaturas reservam proporção e carregam progressivamente. **Ver mais fotos** amplia o conjunto exibido.

Ao abrir uma foto, o lightbox permite visualização inteira, navegação quando houver outras imagens, fechamento e retorno do foco. A pasta/original podem ser abertos no Drive. URL inválida e imagem indisponível mostram estado próprio. A visibilidade cadastrada e a autorização continuam relevantes; a aplicação não torna um arquivo privado público nem modifica suas permissões no Google.

Arquivos inacessíveis no Drive não são recuperados pela galeria. O vínculo e o compartilhamento correto precisam ser conferidos pela equipe de mídia.

### Instagram

O feed é de leitura, via Behold. Mostra a legenda integral recebida, respeita quebras de linha e trata menções, hashtags e URLs como texto/âncoras, sem renderizar HTML de terceiros.

No cartão, **Ver mais/Ver menos** controla a legenda. Quando recolhida, os trechos ocultos não criam links focáveis pelo teclado. Ao ampliar a publicação, há imagem inteira (`object-contain`), região acessível para rolar uma legenda longa e acesso ao original. Sem legenda, a interface informa essa condição; sem imagem ou feed disponível, oferece o estado correspondente e o perfil oficial. Falha de requisição oferece nova tentativa.

Vídeos usam miniatura e link ao original; não há reprodução completa de vídeo dentro desse componente. Não existem curtidas simuladas no Instagram. Curtidas dos comunicados são interações distintas do portal, persistidas pelo seu próprio contrato.

## 8. Instalação PWA e conectividade

O portal pode ser instalado pelo navegador quando suportado. Use **Instalar App** e siga a orientação exibida:

- **Android/navegador compatível:** aceitar o convite nativo disponível ou usar o menu de instalação/adicionar à tela inicial.
- **iPhone/iPad:** abrir no Safari, usar Compartilhar e **Adicionar à Tela de Início**, conforme o sistema.
- **Desktop:** usar o recurso de instalação oferecido pelo navegador compatível.

A disponibilidade do convite depende do navegador, HTTPS e critérios de instalação. Não foi comprovada instalação em aparelho físico nesta execução.

A PWA não é um aplicativo nativo Android/iOS. Atualizações e dados da sessão precisam de conexão. O service worker mantém uma estratégia restrita de recursos públicos e fallback offline; APIs privadas e respostas autenticadas não são persistidas por ele. Serviços podem manter cópias locais específicas, como programação; avisos/companhia usam isolamento por conta. Saúde e inclusão exigem rede e não têm modo clínico offline prometido.

Ao sair ou trocar de conta, não use um cache antigo como prova de acesso atual. Suspensão precisa das novas políticas para bloquear também consultas diretas com um JWT ainda válido.

## 9. Sistema visual e acessibilidade

### Identidade

`DESIGN.md`, o guia de marca e o código existente orientam a identidade. O sidecar `.impeccable/design.json` é histórico e não deve substituir a documentação vigente.

| Uso | Referência |
| --- | --- |
| Azul principal / hover | `#007DA5` / `#005E7C` |
| Destaque amarelo | `#FFE48A` |
| Rosa de destaque | `#FC4E6D` |
| Verde de apoio | `#93C742` |
| Ação destrutiva da marca | `#D45311` |
| Fundo / superfície | `#FAF8F5` / branco |
| Pergaminho | `#F5EFCA` |
| Texto / secundário | `#0F172A` / `#64748B`, com variantes escuras |

Cinzel e Cormorant Garamond atendem títulos/destaques; Inter atende interface e leitura. O padrão Seigaiha e as marcas FSY são elementos específicos deste evento. As superfícies novas de galeria/campos usam bordas suaves; cartões anteriores preservam elementos táteis da identidade.

Paleta de marca não garante contraste por si só. Branco sobre rosa/ciano em alguns componentes existentes continua pendente de correção. Não reutilize essas combinações como se já tivessem aprovação WCAG.

### Campos e estados

`Input`, `Textarea`, `NativeSelect`, `Field` e `PasswordInput` centralizam superfície, borda, foco, erro, desabilitado e preenchimento automático. Campos textuais usam 16 px no celular para reduzir o zoom automático de foco do iOS e altura mínima de 44 px. O campo de senha oferece exibir/ocultar e atributos compatíveis com gerenciadores.

Rótulo, dica e erro devem permanecer associados ao controle. Checkbox, radio, seleção de arquivos e listas nativas mantêm comportamento do sistema; sua aparência aberta pode variar por navegador/OS. Não se promete controle visual total dessas superfícies.

Novos controles de layout oferecem teclado, foco e anúncio de posição. Diálogos devem ter título, Escape, fechamento e foco previsíveis. Movimento reduzido é respeitado pelos componentes que usam essa preferência; o aviso offline não pula continuamente. Alguns textos pequenos, links operacionais e contrastes anteriores ainda constam na auditoria.

### Padrões reutilizáveis

Reutilize controles de formulário, contratos TypeScript, guard de servidor, JSON privado sem cache, ordenação por IDs estáveis, preferência individual com versão e auditoria sem segredos. Adapte a paleta e a tipografia ao produto de destino. Separe marca, datas, programação, companhias e regras médicas específicas do FSY da infraestrutura genérica.

## 10. Arquitetura, contratos e dados

Next.js App Router com React 18/TypeScript e Tailwind. Componentes em `src/components`; rotas e APIs em `src/app`; serviços de consulta em `src/services`; autenticação, layout e integração em `src/lib`. Framer Motion atende interações existentes. Componentes de diálogo usam Base UI.

Contratos precedem integração de frontend/backend. Referências principais:

- `src/types/accounts.ts`: resumo, ações, estados e validação de contas.
- `src/types/instagram.ts`, `src/types/media.ts`: publicações e fotos.
- `src/types/inclusion.ts`: acompanhamento e regras de entrada.
- `src/lib/auth/permissions.ts`: grupos, hierarquia e destinos.
- `src/lib/layout/order.ts`: normalização e movimento da ordem visual.

| Dados | Armazenamento |
| --- | --- |
| Identidade/provedores | Supabase Auth, `auth.users` |
| Cargo, companhia, contatos e suspensão | `profiles` |
| Companhias | `companies` |
| Programação | `schedule_items` e fallback oficial versionado |
| Comunicados/interações | `announcements`, `announcement_likes` |
| Fotos | `media_photos`; arquivos continuam na origem Drive |
| Transporte | `transport_logistics` |
| Saúde/atendimentos | `medical_records`, `medical_appointments` |
| Inclusão | `inclusion_cases`, `inclusion_interviews`, `inclusion_history` |
| Auditoria | `counselor_audit_logs`, `admin_account_events` |
| Ordem individual | `user_layout_preferences` |

O middleware protege rotas e verifica origem das mutações; as APIs também autorizam operação/objeto e derivam autoria confiável. Clientes administrativos são exclusivos do servidor. RLS/grants limitam consultas diretas. Parte da escrita de conteúdo é reservada ao backend; preferências individuais seguem sua política própria.

O limitador local de requisições é por instância de processo; não equivale a um limitador distribuído em todos os nós serverless. O Supabase Auth também aplica suas configurações de proteção. Não há afirmação de segurança absoluta ou integração real comprovada só por testes locais.

## 11. Configuração e migrações

Use Node 22 ou 24 e npm. Copie `.env.example` para `.env.local`, preenchendo o projeto correto. Não versione chaves.

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública para o cliente sob RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor; operações administrativas |
| `NEXT_PUBLIC_SITE_URL` | Origem pública dos links enviados |
| `NEXT_PUBLIC_BEHOLD_FEED_ID` / `BEHOLD_FEED_ID` | Feed de Instagram configurado |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envio individual transacional; sem configuração fica indisponível |

No Supabase Auth, incluir URLs válidas de `/redefinir-senha` e `/auth/confirm` do domínio publicado; conferir callback do Google e template de recuperação. Um template com `token_hash` pode usar `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`, com a origem correta. Não colocar tokens em relatórios/logs.

Preservar/exportar banco **e Auth** antes de alterações. Conferir histórico real antes de aplicar:

1. Migrações anteriores de inclusão/atendimentos de setembro de 2026.
2. `202610200001_security_hardening.sql`.
3. `202610200002_account_safety.sql`.

A segunda migração de outubro acrescenta políticas restritivas de perfil ativo e proteção transacional da última administração. Não reaplicar `schema.sql` sobre um ambiente migrado nem usar seed/reset para supor recuperação de dados.

O host histórico do exemplo `vhbmnnpgftrrovjtvbzo.supabase.co` retornou **ENOTFOUND** nesta execução e não há `.env.local`. Falta acesso ao painel/projeto real usado pela Vercel para distinguir pausa, troca ou indisponibilidade. Não foi provada exclusão do projeto nem restaurado banco real.

## 12. Manutenção, publicação e retorno

```bash
npm ci
npm run lint
npm test
npm run build
```

A suíte usa mocks de API e PostgreSQL PGlite para migrações/RLS reais em banco local. Não toca nos participantes. Um build com variáveis fictícias prova compilação, não autenticação/SMTP do ambiente externo.

Para QA visual, há fixtures e servidor falso em `scripts/visual-qa/`. `verify.cjs` requer Puppeteer, que pode estar em scratchpad indicado por `FSY_PUPPETEER_MODULE`; o build de QA deve usar URL `http://127.0.0.1:54399` e chaves `dev`. O script reserva 3117/54399 e recusa portas ocupadas. A variável `FSY_QA_OUTPUT_DIR` escolhe o destino das evidências. O servidor falso não implementa RLS: não substitui os testes de banco.

Antes de produção: identificar o projeto, obter backup/exportação, aplicar e validar migrações em teste, configurar origens/serviços e testar recuperação numa conta controlada. Confirmar políticas, papéis, suspensão com JWT existente e concorrência entre conexões independentes. Envios de e-mail precisam de conteúdo/destinatário escolhidos para o teste; exclusões reais não são necessárias.

O Next 14.2.35 tem advisories conhecidos. shadcn está apenas em desenvolvimento, sem troca das versões travadas nesta alteração. O plano de migração do framework está em [Dependências](dependencias-2026-10-20.md); não foi executado `npm audit fix --force`. Não publicar presumindo que a remoção de ferramentas de produção corrigiu o framework.

Guardar artefato anterior e snapshot de banco/Auth para retorno. Reverter código não desfaz migrações. Não restaurar políticas permissivas antigas por improviso; preferir correção progressiva compatível com os dados. Recuperação de backup exige procedimento próprio e preservação de identidades/vínculos.

## 13. Evidências, limitações e pendências

Resultado local: **118 testes aprovados**, lint/tipagem/build aprovados; 25 páginas geradas no build. QA em 14 telas nos dois tamanhos, sem overflow horizontal de documento, seguido de confirmação das duas telas corrigidas. Foram verificados legenda integral, detalhe com imagem inteira, região rolável, Escape após animação e mover/salvar/recarregar/restaurar layout com identidades fictícias.

As evidências e capturas selecionadas estão em [evidencias-2026-10-20](evidencias-2026-10-20/). A revisão única de risco foi feita com GPT-6-Astra somente leitura; seus três achados confirmados receberam correções e testes locais pelo executor GPT-6.1-Sol.

A auditoria [Impeccable](auditoria-impeccable-2026-10-20.md) executou detectores estático e DOM e registrou **14/20 (70%)**. Essa é uma avaliação técnica, não uma nota automática de certificação. Permanecem contrastes de textos/selos, metadados pequenos e alguns alvos compactos. A meta **acima de 95% exige 20/20 e não foi atingida**. Achados brutos, falsos positivos e medições durante transição de tema foram diferenciados; nenhuma regra foi alterada para melhorar a nota.

Pendências principais: Supabase real e migrações externas; atualização do Next para linha suportada; correções de contraste/legibilidade; configuração e validação de recuperação/e-mail; decisão sobre logística em saúde/inclusão. Não houve teste em aparelho físico, leitor de tela, zoom 200%, todos os diálogos/cargos nem concorrência PostgreSQL com múltiplas conexões reais.

Nada foi enviado ao GitHub, publicado na Vercel ou aplicado ao Supabase externo nesta retomada. Não houve e-mail enviado ou exclusão de conta real como teste. O próximo executor deve ler [checkpoint GPT](checkpoint-sol-2026-10-20.md) e [resultados](../walkthrough.md), preservando o trabalho e sem repetir a análise completa.
