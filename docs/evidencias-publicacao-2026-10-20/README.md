# Evidências finais de publicação

Código validado: 16b9a54cc43959aa67f61067a74e4c10fb9cc7f7. [Execução aprovada no GitHub](https://github.com/alxgoes/fsy-event-app/actions/runs/39491681275).

- Lint, tipos, 145 testes, auditoria de produção e compilação aprovados na nuvem.
- 56 combinações: 14 rotas, desktop/celular e claro/escuro, com Supabase fictício. Zero violações axe, overflow de documento, campos sem nome, alvos abaixo de 44 px ou erros JS nos casos medidos.
- Seis casos com fonte 200%, leitura integral de Instagram, tema e layout persistido passaram. Diálogo administrativo fecha com Escape e restaura foco.
- JSON bruto comprimido preserva também incompletes do axe e avisos do detector. Capturas são exclusivamente de fixtures; não representam participantes reais.
- A CI usa Chrome Ubuntu, sem credenciais reais. Nenhum snapshot de banco/Auth foi incluído. Artefatos completos permanecem na execução por sete dias; estes arquivos preservam os resultados principais.

Não equivale a certificação WCAG ou nota Impeccable 20/20. Consulte a auditoria e o manual para as limitações.

A mesma revisão passou novamente na [CI da main](https://github.com/alxgoes/fsy-event-app/actions/runs/39492496466). Vercel confirmou Production Ready no deployment CjWjuLXmqcsREgtzcBavYw7SJTY7. `verificacao-publicada.json` registra 26/26 verificações HTTP e a síntese da inspeção autenticada, sem cadastros, e-mails ou credenciais. A própria preferência de layout foi restaurada; nenhuma conta foi editada/excluída nem e-mail enviado como teste.
