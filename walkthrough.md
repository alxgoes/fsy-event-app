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
