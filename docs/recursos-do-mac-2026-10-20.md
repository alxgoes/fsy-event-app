# Contenção de recursos do Mac — 20/10/2026

O usuário relatou travamentos durante o trabalho no Orca. O diagnóstico encontrou 8 GB de RAM, cerca de 7,3 GB de swap em uso e carga média de um minuto de 169,26. Esses números são do sistema inteiro e não atribuem toda a memória ao Orca.

Havia um build Next do FSY em execução e testes de banco iniciados pelo outro agente. O build e seu worker foram encerrados e as sessões GPT Sol e Claude foram interrompidas com Escape. Uma conferência posterior não encontrou build, testes ou servidor FSY ativos. Os arquivos e as sessões foram preservados; nenhum outro aplicativo/projeto foi encerrado.

Após a interrupção, a carga de um minuto caiu de 169,26 para 99,21 e depois para 39,61. Na última amostra às 16:08:43, a CPU estava 58,54% ociosa. O sistema ainda fazia swap, portanto isso indica alívio da carga, sem provar recuperação total da responsividade. O swap pode continuar alocado depois que o pico termina; seu tamanho sozinho não comprova lentidão atual.

Foram fechadas duas abas temporárias criadas pelo coordenador (Google Cloud após salvar a marca e uma duplicata do Supabase). A aba original do Supabase foi mantida. Não foram fechadas abas de trabalho não relacionadas.

## Prevenção aplicada

- `npm test` executa um arquivo de teste por vez (`--test-concurrency=1`), evitando várias instâncias PGlite simultâneas.
- O build Next usa um worker (`experimental.cpus: 1`, sem aumento baseado em memória).
- `AGENTS.md` exige uma única tarefa pesada por vez e proíbe retomada automática após sobrecarga.
- Build, suíte de banco e QA visual interrompidos devem ser retomados sequencialmente em momento adequado. Nenhum novo build foi iniciado para verificar esta contenção.

## Estado preservado do projeto

O Supabase foi restaurado e as contagens de dados foram verificadas. Nome e logo foram salvos no Google Auth. Código de interface/framework e requisições permanece no checkout; lint/typecheck e 136 testes tinham passado antes do complemento RLS. O build final foi interrompido por recursos, não aprovado. O complemento RLS teve 9 testes próprios e 22 testes de banco anteriores aprovados no terminal Claude; sua documentação ainda estava sendo escrita quando a sessão foi interrompida. Nenhuma dessas migrações foi aplicada remotamente.

## Retomada serial e encerramento

Após autorização explícita, apenas GPT-6.1-Sol retomou. A suíte serial passou em 145/145, lint/tipos passaram e o build final completou todas as rotas e Proxy com um worker. A última tentativa de interrupção pelo root encontrou o PID 3659 já encerrado: **esse último build passou e nenhum processo foi morto naquela tentativa**. Não confundir com as interrupções anteriores, inclusive uma recompilação parcial encerrada pelo executor para consolidar o lote de contraste antes do build que passou. Amostras durante a retomada mostraram 47–54% de memória livre; não são garantia futura.

Por instrução final do usuário, não haverá outro build/QA local. A confirmação final usa GitHub Actions (`.github/workflows/validar.yml`); o root fará push/implantação e checagem publicada. O executor encerra sem manter processos de QA próprios.
