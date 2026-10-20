# Entrega local complementar — 20/10/2026

Tema exato **Alegra-se em Cristo**, centralizado em `src/lib/event/identity.ts`, aplicado a marca, cartões, login/rodapé, carregamento, metadados e PWA; lemas e horários preservados.

Next 16.4.2/React 19.3.1, cookies/params assíncronos, Proxy, flat ESLint; 0 vulnerabilidades de produção, 0 críticas no audit completo (13 avisos em ferramentas de desenvolvimento). Requisições deduplicadas/limitadas e canceladas no cleanup; contraste/semântica/alvos corrigidos em lote. Cache PWA v3.

Verificação: lint sem erros/avisos, tipos, **145/145 testes serializados**, **4/4 PWA** após o bump e **build final aprovado com um worker**. A última tentativa de interromper pelo root encontrou PID já encerrado e não matou o build aprovado. QA inicial: 56 casos axe/DOM, 6 casos de texto 200%, zero overflow/rótulos ausentes, interações de legenda/diálogo/layout passaram. A coleta revelou achados corrigidos depois; a confirmação final é da CI e ainda não foi executada neste checkout. Não declarar 20/20.

O root confirmou Supabase Healthy e aplicação atômica de 001–003: contagens preservadas (Auth/perfis 6, companhias 4, agenda 82, fotos 4, avisos 0), 3 tabelas novas, 15 restrições de perfil ativo, 9 políticas sensíveis exatas, zero grants inesperados; jovem com 1 perfil próprio, leitura esperada e sem UPDATE médico/agenda. Snapshot JSON privado fora Git não é pg_dump/Storage completo. Google nome/logo salvos, OAuth em Teste; SMTP custom OFF e nenhum provedor de envio confirmado.

O usuário autorizou upload/implantação, sob execução do root após o commit local. Este executor não faz push/deploy, não aguarda CI, não envia e-mails nem exclui dados reais. Nenhum novo modelo/agente. Evidências: `docs/evidencias-next16-2026-10-20/`; pendências detalhadas na auditoria e no manual.

---

## Histórico anterior preservado (d1055c7; estados externos superados acima)

# Revisão de fluidez e navegação

## Continuação: acompanhamento de inclusão

A nova área foi integrada ao painel médico e ao banco Supabase. O fluxo e as migrações estão documentados em `docs/inclusao.md`. Nesta continuação, também foram corrigidas as permissões antes apontadas: servidor e middleware consultam o cargo atual em `profiles`, alterações do cargo pelo navegador são bloqueadas no banco e as mutações médicas/agendamentos exigem autorização. As notas legadas de agendamentos foram preservadas integralmente com acesso restrito; as APIs usam a tabela médica dedicada.

Os achados de autorização abaixo descrevem a auditoria anterior e foram resolvidos nesta continuação. Os pontos sobre métricas e fuso da programação continuam fora destas mudanças.

## Resultado

A lateral de gestão ganhou superfície flutuante, cantos arredondados, seleção azul FSY com animação de mola e sombras suaves. Foram removidos selos redundantes e a descrição extensa do menu. Links e ações têm 48 px de altura mínima; o fechamento móvel tem 44 × 44 px. O menu responde a Escape, contém o foco e o devolve ao botão de abertura.

As ondas de fundo continuam se movendo e reagindo ao ponteiro. Os motivos fora da região iluminada são reutilizados, evitando reconstruir cada arco a cada quadro. Neon e letras suspendem animações quando não estão visíveis; o indicador de rolagem agrupa medições no próximo quadro. Preferências de movimento reduzido são respeitadas nas alterações.

O perfil passou a ser consultado uma vez pelo provider, sem buscas adicionais por consumidor. As cinco consultas independentes do resumo administrativo são executadas em paralelo. Respostas atrasadas de perfil não restauram a sessão após logout.

Textos genéricos e emojis decorativos foram retirados das áreas revisadas. As publicações fictícias do fallback do Instagram foram removidas. Em caso de indisponibilidade, a galeria oferece acesso ao perfil real. O script Behold que não correspondia a um widget renderizado deixou de ser carregado.

## Offline

O service worker v2 guarda recursos estáticos e a página de indisponibilidade, sem persistir respostas de APIs ou HTML autenticado entre sessões. A migração remove somente caches antigos do FSY. Dados locais de companhia e comunicados usam chaves separadas por usuário e companhia; entradas antigas compartilhadas são descartadas. A interface não promete funcionamento integral sem conexão. A navegação autenticada requer rede; uma tela já aberta pode continuar exibindo os dados carregados.

## Evidências

- `npm.cmd run lint`: sem erros ou avisos.
- `npm.cmd run build`: compilação de produção e verificação de tipos aprovadas; 23 páginas estáticas geradas.
- `node --test tests/profile-provider.test.cjs tests/offline-cache.test.cjs tests/seigaiha-performance.test.cjs tests/service-worker-cache.test.cjs`: 11 casos aprovados.
- Perfil com três consumidores: uma consulta de usuário e uma consulta de perfil. Testes cobrem logout com resposta atrasada, atualização de autenticação e desmontagem.
- Canvas 1440 × 900: 8.712 arcos por quadro no algoritmo anterior; após aquecimento, 0 arcos e 1.089 cópias sem ponteiro. Com ponteiro, 336 arcos locais e 1.047 cópias.
- Canvas 390 × 844: 3.584 arcos anteriores; 0 arcos e 448 cópias sem ponteiro. Com ponteiro, 328 arcos e 407 cópias.
- Vinte eventos de ponteiro antes de um quadro produzem uma leitura de posição. Testados também pausa por aba oculta, movimento reduzido, redimensionamento e descarte.

Os números do canvas são contagens de operações em um teste controlado, não medições de FPS, tempo de GPU ou velocidade em um celular real. Não há percentual de ganho de desempenho atribuído ao aplicativo inteiro.

## Inspeção visual

Inspecionados login, visão geral autenticada e programação administrativa. A seleção do menu acompanha a navegação e fecha a gaveta no celular. Foram conferidos os tamanhos 1366 × 900 e 390 × 844, com rolagem e temas claro/escuro. A lateral não provoca transbordamento horizontal; os controles visíveis medidos atendem aos tamanhos indicados acima. Na confirmação final em produção, abrir o menu colocou o foco em Fechar menu lateral; Shift+Tab alcançou Sair da conta dentro da gaveta e Escape devolveu o foco ao botão de abertura. O build foi repetido e aprovado após essa correção. Não foram feitas alterações em registros do evento durante os testes.

## Auditoria Impeccable

Avaliação estática e visual das áreas alteradas, sem certificação WCAG do site inteiro:

| Dimensão | Nota / 4 | Evidência e limite |
| --- | --- | --- |
| Acessibilidade | 3 | Controles da lateral, foco e Escape revisados; outros módulos ainda possuem controles pequenos. |
| Desempenho | 3 | Redução comprovada de operações e consultas; FPS de dispositivo não medido. |
| Responsividade | 3 | Lateral validada em desktop e celular; nem todos os formulários passaram por teste completo. |
| Temas | 3 | Lateral clara/escura coerente; cartão destacado da programação ainda expõe o padrão de fundo no tema escuro. |
| Integridade de implementação | 3 | Identidade preservada e conteúdo fictício removido; há inconsistências funcionais anteriores abaixo. |
| Total | 15 / 20 | Bom, com pontos específicos a revisar. |

O detector foi executado pelos agentes. Alertas de cores/raios da lateral foram normalizados. O texto pequeno da marca e a animação do aviso offline foram examinados como elementos existentes; a animação tem alternativa por preferência de movimento reduzido.

## Achados anteriores fora das alterações de fluidez

- **P1 — Origem do papel de acesso:** `src/lib/supabase/server.ts` e `src/middleware.ts` aceitam `user_metadata.role` como fallback. Metadados controláveis pelo usuário não devem fundamentar autorização. O middleware também aceita a cookie `fsy_role`. Revisar a origem confiável e a invalidação dos papéis em conjunto com as políticas do banco; esta entrega não altera RBAC.
- **P2 — Contagem médica:** `ExecutiveDashboard` conta `youth_medical_profiles`, enquanto a API de registros usa `medical_records`. Confirmar qual total a coordenação quer ver antes de alterar o significado da métrica.
- **P2 — Total de comunicados:** a métrica atual deriva de uma lista limitada a quatro comunicados. Separar contagem e lista em revisão funcional futura.
- **P2 — Fuso da programação:** `calculateActiveAndNextEvents` combina data UTC com hora local. Próximo do fim do dia, a atividade pode ser selecionada pelo dia incorreto. A revisão de datas não faz parte das mudanças visuais deste ciclo.
- **P2 — Destaques no tema escuro:** alguns cartões existentes da programação têm fundo translúcido e deixam as ondas competir com o texto. A sidebar revisada usa superfície opaca para preservar leitura.

As skills locais de backend e domínio contêm nomes de papéis e tema desatualizados; foram usados os contratos reais do código, `PRODUCT.md`, `DESIGN.md` e a programação existente. Não foram alteradas datas, tema, conteúdo cadastrado ou permissões.

## Entrega local

As alterações da revisão inicial permaneceram locais até a solicitação seguinte de inclusão e envio ao GitHub. A entrega seguinte reúne ambos os conjuntos de alterações.

# Retomada de implementação — 20/10/2026

Este registro substitui as pendências correspondentes dos relatos anteriores, sem apagar seu histórico. Base preservada `ffe14ca`; execução GPT-6.1-Sol medium. Revisão única GPT-6-Astra medium pelo Orca, sandbox somente leitura e `-a never`, encerrada após os achados; sem Claude ou outros subagentes. Snapshots da conta Codex: 7% no início e 9% no checkpoint; Claude 48% da janela/32% semanal, sem reativação nesta execução. Cotas são compartilhadas e não medem custo exclusivo deste projeto. Nenhum crédito/reset comprado ou consumido voluntariamente.

## Implementação efetiva

- InstagramFeed consome `src/types/instagram.ts`, preserva quebras de linha e usa tokens de texto seguros nos trechos expandidos. Ver mais/menos informa `aria-expanded`; detalhe usa diálogo compartilhado, região rolável, imagem inteira e link ao original. Curtidas locais e cache do contrato antigo foram removidos. Na legenda recolhida, texto simples evita focar links ocultos pelo corte visual. Mural suavizado conforme galeria.
- Personalização aplicada às métricas e módulos da administração, métricas e mural do consultor e indicadores médicos. O portal jovem já estava integrado. Cobertura e exclusões justificadas por cronologia/segurança estão em `implementation_plan.md`; nenhum registro clínico ou horário ganhou ordenação arbitrária.
- Campos dos módulos administrativos, consultor e avisos migrados para os controles FSY. Mantidos recursos nativos de checkbox, radio e upload. Rótulos de formulário foram associados; os filtros da auditoria receberam nomes acessíveis. Removidos overrides de aparência que substituíam a identidade dos campos, inclusive CSS de inclusão. Botões têm mínimo de 44×44 px; âncoras pequenas remanescentes estão na auditoria.
- Métrica de saúde consulta `medical_records`; a contagem de avisos usa `count: exact`, independente da lista recente. Dia Zero usa os cargos vigentes, incluindo `medico`. Removidos o texto enganoso de tempo real e o cargo em query na auditoria. Atividade usa `America/Sao_Paulo`, ordem cronológica, ausência real de atividade nos intervalos e atualização por minuto sem novas buscas.
- Incorporadas as três correções confirmadas da revisão Astra: consultas de alvo falham fechadas; políticas restritivas de perfil ativo; trigger transacional da última administração. Nova migração `202610200002_account_safety.sql`, após 001. Suspensão marca o perfil antes do banimento no Auth; reativação faz o inverso. Falha parcial permanece fechada e requer repetição/conferência, pois Auth e perfil não compartilham uma única transação HTTP.
- shadcn movido para desenvolvimento. Conferência do lockfile: nenhuma versão de pacote alterada; flags `dev` recalculadas. Audit final mantém 25 pacotes sinalizados (2 críticos/18 altos/5 moderados), incluindo ferramentas de desenvolvimento. Next 14 permanece pendente de migração; ver `docs/dependencias-2026-10-20.md`.

## Validação real

- `npm run lint`: sem avisos/erros. Build final também executou lint e verificação TypeScript.
- `npm test`: **118/118 aprovados**. Cinco testes novos de segurança executam as políticas/trigger no Postgres PGlite e falhas de APIs simuladas. Três novos testes de programação cobrem virada UTC/local, intervalos e encerramento.
- `npm run build`: aprovado, 25 páginas geradas, com URL Supabase local fictícia e chaves `dev`. A confirmação após as duas últimas correções de acessibilidade também passou. Não prova integração de produção.
- QA em Puppeteer: 14 rotas × desktop 1365×900/celular 390×844. Nenhum overflow horizontal de documento. Filtros corrigidos confirmados em segunda passagem específica. Legenda longa, diálogo, Escape após animação, mover/salvar/recarregar/restaurar layout aprovados com dados fictícios. Arquivos JSON e cinco capturas selecionadas em `docs/evidencias-2026-10-20/`.
- Detector Impeccable estático e DOM oficial executados, com achados preservados. **14/20 (70%) na avaliação ampliada; não atingiu >95%**. Contrastes e textos pequenos restantes foram documentados, sem alterar regras ou ignorar achados. Não houve aparelho físico, leitor de tela, zoom 200% ou validação de todos os diálogos.
- `git diff --check`: sem erros de whitespace.

## Limites de operação e retorno

A consulta DNS atual de `vhbmnnpgftrrovjtvbzo.supabase.co` retornou **ENOTFOUND** e `.env.local` continua ausente. Isso não prova que o projeto foi apagado. Falta identificar o projeto real da Vercel e obter acesso ao painel/backup. Nenhuma recuperação ou migração foi executada no Supabase externo. Não houve envio de e-mails, exclusão de contas reais, push ou deploy.

Antes de publicar: exportar dados/Auth, conferir o histórico de migrações, aplicar 001 → 002 em ambiente de teste e depois no projeto correto, configurar URLs Auth e variáveis da Vercel/Resend. Confirmar concorrência em conexões PostgreSQL independentes e recuperação em conta de teste. Acesso de logística a saúde/inclusão foi preservado e ainda depende da decisão de domínio registrada no plano.

Para retornar, preservar o artefato anterior e o snapshot do banco/Auth. Reverter código não desfaz migrações; não reaplicar schema antigo nem revogar as proteções por SQL improvisado. Preferir correção progressiva compatível com os dados e restaurar backup apenas sob um procedimento conferido. Os servidores locais de QA e a sessão Astra foram encerrados.

O manual funcional e de design foi escrito como última etapa editorial substantiva, refletindo esses resultados e limitações.
