# Manual funcional e de design — FSY Sessão Ribeirão Preto 2

Versão publicada e verificada em 20/10/2026. Preparação da equipe em **05/02/2027**; participantes de **06 a 10/02/2027**. Tema exato definido pelo usuário: **Alegrar-se em Cristo**, Filipenses 4:4. Este é o portal da sessão Ribeirão Preto 2, sem representar um portal institucional global.

O portal está publicado em https://fsy-event-app.vercel.app. A revisão executável **38ff96b** foi confirmada como Production Ready, com **144 testes, 56 combinações de tela e 26 verificações públicas aprovadas**. Supabase está Healthy; migrações 001–004 aplicadas, dados preservados. Logística, Coordenação e Direção têm a mesma autoridade administrativa. O envio de e-mail depende de serviço ainda não configurado, e Google OAuth permanece em Teste. A nota Impeccable anterior 17/20 é histórica e não foi recalculada nesta revisão. O desenvolvimento iOS foi retomado: a primeira versão nativa está instalada no iPhone e a abertura corrigida foi observada; teste autenticado segue pendente. Consulte [entrega iOS](ios/ENTREGA.md). A correção posterior do tema para **Alegrar-se em Cristo** é descrita no mesmo registro; não foi validada pelas evidências históricas da revisão 38ff96b.

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
| `logistica` | `/admin` | Gestão geral, com a mesma autoridade de coordenação e direção |
| `coordenador` | `/admin` | Gestão geral, com a mesma autoridade de logística e direção |
| `casal_diretor` | `/admin` | Gestão geral, sujeita às proteções de própria conta e última administração |

Saúde/inclusão preservam o acesso de `medico`, `logistica`, `coordenador` e `casal_diretor`. O responsável confirmou que logística, coordenação e direção têm a mesma autoridade dentro da plataforma. As APIs revalidam a identidade; políticas de leitura direta mais restritas não são substituídas por permissões abertas.

Por definição expressa do responsável pelo evento, **Logística, Coordenação e Casal Diretor têm a mesma autoridade administrativa**. Os três podem editar perfis, atribuir qualquer cargo, designar companhia/quarto e executar as ações de gestão de contas. Não existe hierarquia entre eles. Participantes, consultores, mídia e equipe médica não recebem gestão geral de contas por essa mudança. As proteções contra autoexclusão, autosuspensão, alteração do próprio cargo e remoção da última administração habilitada continuam iguais para os três.

Não é permitido alterar o próprio cargo, suspender/excluir a própria conta ou redefinir a própria senha pela ação administrativa. A última conta administrativa habilitada, considerando logística, coordenação e casal diretor, é protegida também no banco. Jovens não escolhem cargo, companhia ou quarto pelo cadastro público. E-mail e metadados fornecidos pelo usuário não conferem privilégios.

## 3. Entrada, cadastro e recuperação

### Entrar e cadastrar

Em `/login`, escolha entrar, cadastrar-se ou recuperar acesso. O cadastro usa Supabase Auth e cria perfil com cargo inicial `jovem`; informações como nome, estaca e telefone complementam o cadastro. Se o projeto exigir confirmação de e-mail, a pessoa precisa seguir o link enviado pelo Auth antes de entrar.

O coordenador salvou o nome **FSY Sessão Ribeirão Preto 2** e o logo `public/icons/icon-512.png` no projeto Google `gen-lang-client-0100438624`. OAuth permanece em **Teste**, pendente lançamento geral; não foi comprado domínio. O botão de Google depende de o provedor e seus redirecionamentos estarem configurados no projeto. O fluxo preserva a identidade mantida pelo Supabase. Não existe entrada de demonstração que conceda acesso administrativo.

### Esqueci minha senha

1. Escolha **Esqueci minha senha** ou o modo de recuperação.
2. Informe o e-mail da conta.
3. O portal apresenta uma resposta genérica, sem revelar se o endereço existe.
4. Abra o link válido recebido e defina a nova senha em `/redefinir-senha`.
5. Retorne à entrada conforme a orientação da tela. Link inválido/expirado exige novo pedido.

A validade e os requisitos adicionais de senha dependem da configuração do Supabase; a aplicação valida sua política local e exibe os erros suportados. O processo aceita o retorno de recuperação do Auth e a confirmação por `token_hash` em `/auth/confirm`. O coordenador conferiu as Redirect URLs de produção/** e `/auth/callback`; os fluxos completos de recuperação ainda exigem uma conta controlada e serviço de envio definido. SMTP customizado permanece OFF. Não houve envio real nesta validação.

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
- **Alterar cargo:** gestores podem atribuir qualquer cargo a outra conta; protege a última administração habilitada.
- **Suspender/reativar:** suspensão bloqueia o perfil antes do banimento no Auth; reativação libera o perfil depois do Auth. Se uma etapa falhar, o resultado pode permanecer bloqueado; conferir/repetir a ação. Não há uma transação HTTP única entre os dois serviços.
- **Excluir:** exige confirmação do alvo e recusa vínculos que precisam permanecer, como inclusão, histórico, atendimentos ou fotos. Use suspensão quando for necessário preservar registros. Não há lixeira/recuperação prometida para exclusão física.
- **Recuperação de senha:** envia pelo Auth ao e-mail da conta, conforme configuração e permissões.
- **Definir nova senha do portal:** direção, coordenação ou logística; a senha anterior não é lida. A nova senha não é devolvida nem registrada na auditoria. Para a própria conta, use recuperação.
- **E-mail individual:** selecionar destinatário, escrever assunto e mensagem, revisar e confirmar. O backend usa Resend quando configurado; a resposta significa **aceito para envio**, sem comprovar entrega na caixa postal.

**Sem `RESEND_API_KEY` e `EMAIL_FROM`, o envio individual fica indisponível.** Não há provedor SMTP/transacional confirmado pelo usuário nem entrega em produção comprovada. A trilha administrativa registra ator, alvo, ação, data e detalhes limitados. Não contém senhas nem o corpo integral da mensagem. Se a gravação da auditoria falhar depois de uma ação, o retorno indica seu estado; a equipe deve conferir o resultado, sem presumir que repetir uma exclusão é inofensivo.

Falha ao consultar o perfil de um alvo interrompe a operação: não libera uma operação sem conhecer o perfil do alvo. Os testes de recuperação/envio/remoção usam mocks e identidades fictícias. Não foram enviados e-mails ou excluídas contas reais para validar a entrega.

## 6. Personalização dos cartões

Use o pequeno botão com ícone de grade no canto direito do grupo, identificado por **Personalizar layout** ao passar o mouse ou usar tecnologia assistiva. Ele mantém alvo de toque 44×44 px, sem texto ou barra larga em repouso. Fora desse modo, a página mantém clique, seleção e rolagem normais.

1. Use a alça para arrastar com mouse/toque.
2. Alternativamente, use **Subir/Descer** ou, na alça, Enter e as setas conforme o rótulo.
3. **Salvar layout** confirma a ordem; **Cancelar** descarta o rascunho.
4. **Restaurar padrão** repõe a sequência original no rascunho; salve para confirmar.

Mudanças são anunciadas para leitores de tela e o foco acompanha o controle usado. A preferência é individual, por conta e grupo/página, com versão e IDs estáveis. Usa uma mesma ordem para celular e desktop (`all`). Cartões desconhecidos são descartados; novos cartões entram numa posição utilizável.

O salvamento usa `user_layout_preferences` com RLS e cópia local isolada. Se a sincronização falhar, a tela informa **salvo só neste aparelho**. Troca de conta não deve reutilizar a preferência de outra pessoa. As migrações estão aplicadas e o banco restabelecido. Na sessão real do coordenador, uma preferência foi salva com confirmação de sincronização, persistiu após recarregar e foi restaurada ao padrão. Não houve teste entre dois aparelhos físicos.

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

A fila/cache de leitura é por aba: no máximo 4 tarefas simultâneas, 24 em espera, timeout de 12 segundos contando a fila e até 50 entradas. Agenda, companhia e fotos usam TTL de 60 segundos; avisos, 20 segundos. Chamadas iguais em voo compartilham busca; contas diferentes têm chaves distintas. Troca de conta limpa/aborta o cache em memória; curtidas invalidam avisos. Login, escritas clínicas e urgências não entram nessa fila.

O efeito do painel jovem passa um `AbortController` aos quatro serviços e cancela no cleanup. API 401/403, rede, timeout ou cancelamento não disparam uma segunda consulta direta ao banco; só resposta 5xx permite esse fallback, ainda sob RLS. O armazenamento offline existente mantém os limites próprios. Saúde/inclusão não recebem cache clínico por essa camada.

O service worker usa **`fsy-pwa-v3`**: na ativação, remove apenas caches FSY anteriores e preserva caches alheios. Isso renova a página offline/ícones e os recursos públicos após a atualização; uma tela já aberta pode precisar ser recarregada. APIs privadas, HTML autenticado e payloads React não são guardados pelo service worker. Não foi comprovada a atualização de uma instalação física.

Cache não é autorização; as políticas restritivas de perfil ativo foram aplicadas pelo coordenador. O navegador não mantém fila global entre todos os participantes e não há promessa de redução financeira medida em produção. Veja [Requisições e custos](requisicoes-e-custos.md).

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

Cinzel e Cormorant Garamond atendem títulos/destaques; Inter atende interface e leitura. O padrão Seigaiha e as marcas FSY são elementos específicos deste evento. Galeria e campos mantêm suas superfícies próprias. Os blocos de gestão, cartões de indicadores, módulos, menu lateral e botões usam a mesma profundidade tátil da identidade FSY: borda estruturada, sombra deslocada, estado pressionado e foco visível. Os tokens --fsy-depth-border, --fsy-depth-ink, --fsy-depth-panel-shadow e --fsy-depth-button-shadow centralizam claro/escuro; fsy-panel e o escopo fsy-admin aplicam o padrão sem modificar conteúdo ou autorização.

A constante de identidade é `src/lib/event/identity.ts`; marca, cartões, login/rodapé, carregamento, metadados e PWA usam **Alegrar-se em Cristo**. Lemas das companhias e horários foram preservados. A citação de Filipenses no cartão continua como escritura, distinta do texto do tema.

Paleta não garante contraste: a saudação usa branco sobre `--fsy-hero` #005e7c (7,26:1), o contador rosa usa grafite (5,48:1) e urgência usa branco/vermelho escuro (6,47:1). `--fsy-link` adapta a ação ao tema; o fundo escuro foi atenuado e avisos importantes usam superfície estável. IDs de companhia escolhem preto/branco pela luminância da cor configurada. Essas medidas não substituem QA sobre superfícies com imagem/canvas.

### Campos e estados

`Input`, `Textarea`, `NativeSelect`, `Field` e `PasswordInput` centralizam superfície, borda, foco, erro, desabilitado e preenchimento automático. Campos textuais usam 16 px no celular para reduzir o zoom automático de foco do iOS e altura mínima de 44 px. O campo de senha oferece exibir/ocultar e atributos compatíveis com gerenciadores.

Rótulo, dica e erro devem permanecer associados ao controle. Checkbox, radio, seleção de arquivos e listas nativas mantêm comportamento do sistema; sua aparência aberta pode variar por navegador/OS. Não se promete controle visual total dessas superfícies.

Novos controles de layout oferecem teclado, foco e anúncio de posição. Diálogos devem ter título, Escape, fechamento e foco previsíveis. Movimento reduzido é respeitado pelos componentes que usam essa preferência; o aviso offline não pula continuamente. Textos funcionais de 9–11 px foram ampliados a 12 px; marca gráfica pode conter tipografia menor, repetida em texto maior no portal. Links operacionais têm alvo mínimo 44×44 e foco; links dentro de parágrafos permanecem inline. As abas da agenda oferecem setas, Home/End e painel associado. A confirmação final e os limites constam na auditoria. A galeria administrativa usa o diálogo compartilhado com título, Escape e retorno do foco; a galeria jovem carregou uma foto real do Drive inteira na inspeção publicada.

### Padrões reutilizáveis

Reutilize controles de formulário, contratos TypeScript, guard de servidor, JSON privado sem cache, ordenação por IDs estáveis, preferência individual com versão e auditoria sem segredos. Adapte a paleta e a tipografia ao produto de destino. Separe marca, datas, programação, companhias e regras médicas específicas do FSY da infraestrutura genérica.

## 10. Arquitetura, contratos e dados

Next.js **16.4.2** App Router com **React/React DOM 19.3.1**, TypeScript e Tailwind. Cookies e parâmetros dinâmicos usam o contrato assíncrono; `src/proxy.ts` substitui middleware preservando os guards. ESLint 9/flat config oficial executa separado do build; regras novas não foram desativadas. Componentes em `src/components`; rotas e APIs em `src/app`; serviços de consulta em `src/services`; autenticação, layout e integração em `src/lib`. Framer Motion atende interações existentes. Componentes de diálogo usam Base UI.

Contratos precedem integração de frontend/backend. Referências principais:

- `src/types/accounts.ts`: resumo, ações, estados e validação de contas.
- `src/types/instagram.ts`, `src/types/media.ts`: publicações e fotos.
- `src/types/inclusion.ts`: acompanhamento e regras de entrada.
- `src/lib/auth/permissions.ts`: grupos, equivalência administrativa e destinos.
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

O Proxy protege rotas e verifica origem das mutações; as APIs também autorizam operação/objeto e derivam autoria confiável. Clientes administrativos são exclusivos do servidor. RLS/grants limitam consultas diretas. Parte da escrita de conteúdo é reservada ao backend; preferências individuais seguem sua política própria.

A proteção de abuso de rotas é local à instância; não equivale a um limitador distribuído em todos os nós serverless. A camada de leituras `src/lib/requests` é por aba e não compartilha cache no servidor entre usuários. O Supabase Auth também aplica suas configurações de proteção. Não há afirmação de segurança absoluta ou integração real comprovada só por testes locais.

## 11. Configuração, dados preservados e políticas

Use Node 22 ou 24 e npm. Copie `.env.example` para `.env.local`, preenchendo o projeto correto. Nunca versione chaves, exports de participantes ou identidades do Auth.

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública para o cliente sob RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor; operações administrativas |
| `NEXT_PUBLIC_SITE_URL` | Origem pública dos links |
| `NEXT_PUBLIC_BEHOLD_FEED_ID` / `BEHOLD_FEED_ID` | Feed de Instagram |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envio individual transacional; indisponível sem configuração |

O Supabase `vhbmnnpgftrrovjtvbzo` estava pausado e foi retomado pelo coordenador. O painel confirmou restauração e Healthy. A inspeção verificou Auth 6, perfis 6, companhias 4, agenda 82, fotos 4 e avisos 0; `/api/media` publicado respondeu 200. Nenhum dado foi recriado.

O coordenador preservou fora do Git um **snapshot JSON privado** de 12 tabelas públicas, `auth.users` e `auth.identities`, além da inspeção de schema/políticas/funções/grants/constraints. Isso **não é pg_dump nem backup completo de Storage**. Sua localização e conteúdo privado não devem entrar em commits/artefatos de CI.

A sequência aplicada e confirmada remotamente foi:

1. Histórico anterior de inclusão/atendimentos, conferido pelo coordenador.
2. `202610200001_security_hardening.sql`.
3. `202610200002_account_safety.sql`.
4. `202610200003_remote_policy_cleanup.sql`.
5. `202610200004_equivalent_administrators.sql`: alinha a proteção da última administração aos três cargos equivalentes, sem mudar cadastros nem remover RLS.

O bundle 001–003 foi comparado por hash e aplicado em transação única pelo root. Resultado confirmado: contagens anteriores iguais, três tabelas novas, 15 políticas `active_profile_required`, nove políticas sensíveis exatas e `unexpected_grants = 0`. A limpeza remove políticas permissivas extras por tabela e recria a allowlist; não depende de nomes históricos/truncados. Não executa seed/reset/DELETE de registros.

O teste remoto com role authenticated e claims de um jovem leu só o próprio perfil (1), agenda 82, companhias 4, fotos 4, zero eventos administrativos e não tinha UPDATE em medical_records/schedule_items. Nenhum registro foi alterado pelo teste. Isso comprova esses casos e não toda combinação de cargo/fluxo. Consulte [Segurança RLS recuperada](seguranca-rls-recuperada.md).

Leitura direta de prontuários fica com médico/coordenação/direção; transporte com logística/coordenação/direção, sem o marcador de armazenamento de atendimentos; avisos globais/própria companhia, ou todos para gestão; auditoria só gestão. Escritas nessas quatro tabelas passam pelo servidor autorizado. service_role é exclusivo do servidor. A matriz de acesso das APIs, incluindo a equivalência dos três cargos de gestão, continua separada da leitura direta pelo navegador.

No Auth, preservar URLs válidas de `/redefinir-senha`, `/auth/confirm` e callback Google. Um template com `token_hash` pode usar `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha` na origem correta. Nunca registrar tokens. SMTP custom OFF e provedor não definido significam que recuperação/envio de produção ainda não foram validados.

## 12. Manutenção, CI, publicação e retorno

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm audit --omit=dev
npm run build
```

Em Mac de 8 GB, execute **uma tarefa pesada por vez**. `npm test` usa `--test-concurrency=1`; o Next usa `experimental.cpus: 1`. Não aumente paralelismo para acelerar. Se houver pressão real de recursos, interrompa e registre checkpoint; não encerre apps ou processos de outros projetos.

A suíte usa mocks de API e PostgreSQL PGlite para migrações/RLS locais, sem participantes reais. Build com variáveis fictícias prova compilação/tipos, não Auth/SMTP de produção. O build usa Webpack suportado; não há migração adicional de bundler.

`.github/workflows/validar.yml` usa Node 22, npm ci, lint, tipos, testes seriais, audit de produção, build e QA/assert. `scripts/visual-qa/verify.cjs` usa Puppeteer/axe, reserva 3117/54399 e recusa portas ocupadas. O Supabase é falso/local e requisições ao Supabase externo são abortadas pelo runner. As imagens/identidades são fixtures. `FSY_PUPPETEER_MODULE`, `FSY_AXE_MODULE` e `FSY_QA_OUTPUT_DIR` configuram as ferramentas e o destino. Chrome usa `--no-sandbox` apenas em CI; localmente mantém o padrão.

O gate `assert.cjs` exige 56 casos axe, nenhum ignore, nenhum overflow/campo sem nome/alvo operacional abaixo de 44 px/erro JS e confirma legenda, diálogo, layout e alternância de tema. Há seis casos com fonte 200%. A CI guarda artefatos por sete dias. A confirmação final foi delegada ao GitHub por instrução do usuário, sem outro build/QA local ou espera por CI neste executor.

Next 16.4.2 substitui a linha 14 sem suporte. A consulta final retornou **zero vulnerabilidades de produção e zero críticas no conjunto completo**; restam 13 avisos (11 altos, dois moderados) na cadeia de desenvolvimento. Não houve force, override de peers ou migração às cegas de ferramentas adicionais. Veja [Dependências](dependencias-2026-10-20.md). Isso é uma leitura pontual, não garantia futura.

A revisão executável 38ff96b foi enviada à main e confirmada como Production Ready na Vercel. [CI da revisão aprovada](https://github.com/alxgoes/fsy-event-app/actions/runs/39497300627); [execução na main](https://github.com/alxgoes/fsy-event-app/actions/runs/39498012904). NEXT_PUBLIC_SITE_URL está configurado para https://fsy-event-app.vercel.app em Production. As verificações publicadas conferiram rotas, sessão existente, contas, mídia e arquivos PWA. Recuperação/envio exigem serviço definido e conta controlada; não enviar e-mails a participantes ou excluir contas reais como teste.

Guardar artefato anterior e snapshot privado para retorno. `d1055c7` preserva a base anterior no Git, sem recomendar recolocar um framework vulnerável em produção. Reverter código não desfaz banco; conferir compatibilidade e preferir correção progressiva. Não reaplicar schema antigo nem restaurar políticas permissivas para contornar falhas. Uma restauração completa exige procedimento próprio além do snapshot JSON disponível.

## 13. Evidências, limitações e pendências

**Confirmação final:** a revisão executável 38ff96b passou na CI de preparação: lint, tipos, **144/144 testes**, auditoria de produção sem vulnerabilidades conhecidas no momento e build Next 16. O Mac não executou novas compilações pesadas nesse fechamento. A cadeia de desenvolvimento ainda possui 13 alertas (11 altos/2 moderados), registrados em [Dependências](dependencias-2026-10-20.md); a leitura é pontual e não garante ausência de vulnerabilidades futuras.

**Telas e interações:** 14 rotas × dois tamanhos × dois temas = **56 casos axe sem violações automáticas**, nenhum overflow de documento, campo visível sem nome, alvo abaixo de 44 px ou erro JS nos casos medidos. Seis ampliações de fonte 200% passaram. Legenda integral, imagem inteira, região rolável, Escape, retorno de foco da galeria administrativa, alternância real dos temas e mover/salvar/recarregar/restaurar layout passaram com fixtures. O detector final não repetiu os achados de títulos pulados e texto ocluído do filtro Espiritual. Incompletes do axe e demais avisos DOM permanecem nas evidências; ausência de violação automática não certifica todos os estados WCAG.

**Site publicado:** Vercel confirmou Production Ready, fonte main/38ff96b, e as **26/26 verificações HTTP** passaram. Login, manifesto com tema correto, cache PWA v3, página offline, recuperação e ícone responderam; páginas privadas redirecionaram ao login. Onze APIs privadas recusaram acesso anônimo com 401; mutação de origem externa recebeu 403; e-mail inválido foi recusado antes de envio. Instagram respondeu pelo Behold com seis publicações.

**Sessão autenticada:** a sessão Google existente abriu o portal como Logística. Na revisão atual, a área de contas carregou seis cadastros sem erro, com **todos os seis controles Gerenciar habilitados**. Ao abrir outra conta, os sete cargos e o seletor de companhia estavam disponíveis. Nenhuma mudança de cargo, senha, dados de participante, exclusão ou envio de e-mail foi realizada como teste. Na validação da publicação anterior, a preferência da própria conta foi salva, persistiu após recarregar e foi restaurada; uma foto real do Drive carregou inteira e o diálogo fechou com Escape. A revisão atual voltou a confirmar layout e galeria com fixtures.

As [evidências da revisão de gestão](evidencias-gestao-2026-10-20/) preservam os resultados atuais. As [evidências da publicação anterior](evidencias-publicacao-2026-10-20/) preservam JSON bruto comprimido e capturas exclusivamente de dados fictícios, além da síntese publicada sem dados pessoais. As [evidências iniciais Next 16](evidencias-next16-2026-10-20/) e [anteriores](evidencias-2026-10-20/) permanecem como histórico. Não há snapshot privado de banco/Auth no Git. A revisão Astra foi única e somente leitura; nenhum novo agente foi iniciado no fechamento.

**Impeccable anterior: 17/20 (85%).** A nota é uma avaliação fundamentada da publicação anterior das cinco dimensões, detalhada na [auditoria final](auditoria-impeccable-2026-10-20.md), e substitui a nota histórica 14/20. A meta >95% exigiria 20/20 e **não foi atingida**. Ainda há cores de marca literais fora dos tokens, oportunidades de medida de linha e cobertura manual/desempenho sem comprovação. Passar no axe não atribui nota máxima.

**Pendências operacionais:** o usuário informou que ainda não possui serviço de envio. SMTP customizado está OFF e não há Resend configurado; o envio individual permanece indisponível e recuperação/entrega de e-mail não foram validadas em produção. Nome e logo Google foram salvos, mas OAuth permanece em Teste e requer lançamento geral antes do uso amplo pelos participantes. Nenhum domínio pago foi contratado.

**Limites adicionais:** leitor de tela, aparelhos e instalação/atualização PWA físicos, todos os cargos/diálogos e carga PostgreSQL entre conexões independentes não foram testados. O acesso da logística nas APIs de gestão foi confirmado pelo responsável; a leitura direta permanece limitada conforme a política de cada tabela. A fila de leituras é por aba, sem promessa de economia financeira em produção. Aplicativos nativos Android/iOS continuam uma etapa futura. O usuário pausou o iOS antes de o Claude criar código nativo; nenhum Xcode/SDK foi instalado.

Este manual foi a **última etapa editorial substantiva** da entrega. O código, a recuperação do banco, as proteções aplicadas e a publicação estão confirmados nos limites acima; e-mail, lançamento geral OAuth e a meta de qualidade máxima permanecem explicitamente pendentes.

## 14. Revisão de gestão e pausa do iOS — 20/10/2026

Solicitação adicional do responsável: os três cargos de gestão têm as mesmas permissões; painéis, lateral e botões devem compartilhar a profundidade visual do FSY; o controle de layout deve ser discreto. A implementação mantém autenticação, verificação de origem, auditoria, validações e proteção dos registros vinculados. Nenhuma conta foi promovida ou alterada como teste.

A migração 004 foi aplicada e confirmou logistics_in_guard=true, Auth/perfis 6/6, companhias 4, agenda 82 e fotos 4, sem alteração de registros. A revisão 53f337c passou na [CI 39496314057](https://github.com/alxgoes/fsy-event-app/actions/runs/39496314057), inclusive teste visual de Logística com todos os botões de gerenciamento habilitados e sete opções de cargo na conta de direção. Os testes também preservam bloqueio de não gestores, conta própria e última administração ativa. A confirmação visual usa fixtures, sem enviar e-mails ou trocar senhas reais.

Após a primeira inspeção, o mesmo padrão de profundidade foi aplicado também aos cartões com wrappers de animação e classes condicionais, e o foco ganhou contorno explícito. Build e verificação visual permanecem obrigatórios na CI para qualquer publicação. A confirmação adicional 38ff96b passou na CI 39497300627, com as mesmas 56 combinações sem violações automáticas. A inspeção publicada confirmou seis contas gerenciáveis, sete cargos e seleção de companhia. A nota histórica 17/20 não é recalculada automaticamente por esta revisão.

O iOS está pausado por solicitação humana. Claude foi interrompido ainda na leitura; não foram criados fontes iOS nem instalados Xcode, SDKs ou simuladores. O planejamento privado foi preservado fora do repositório. O web app continua independente dessa etapa.
