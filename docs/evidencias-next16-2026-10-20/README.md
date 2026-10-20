# Evidências do lote complementar

- `tests.log`: suíte global serial, 145/145, após integração de requisições/RLS/tema e antes do último lote visual.
- `service-worker.log`: 4/4 após v3, inclusive exclusão de v1/v2 e preservação de caches alheios.
- `lint.log`: confirmação após as últimas alterações de componentes.
- `types.log`: typecheck independente; o build final também verificou tipos.
- `build-inicial.log` e `build-final.log`: dois builds completos aprovados; tentativas interrompidas não são contadas como aprovação. O último build terminou antes da tentativa de interrupção do root.
- `audit-producao.json`: zero vulnerabilidades; `audit-completo.json`: 13 (11 altas/2 moderadas), zero críticas, cadeia de desenvolvimento.
- `impeccable-estatico.json`: achados brutos anteriores ao lote final, sem novos ignores.
- `inicial-visual-report.json.gz` e `inicial-impeccable-dom.json.gz`: 56 combinações originais, seis casos de fonte 200% e interações; gzip preserva integralmente os dados.
- `resumo-qa-inicial.json` e capturas: diagnóstico da primeira passagem, não a confirmação das últimas correções. A coleta escura tinha a limitação de next-themes descrita na auditoria.

Não há artefato de confirmação final local: por instrução do usuário, `.github/workflows/validar.yml` executará build, QA e `scripts/visual-qa/assert.cjs` após push pelo root, sem aguardar a CI neste executor. A CI usa Chrome no Ubuntu (`--no-sandbox` só quando CI), sem segredos reais e sem Supabase externo, com artefatos por 7 dias. Esse gate não equivale a nota Impeccable 20/20.

Nenhum backup privado de banco/Auth está nesta pasta ou no Git. O snapshot remoto permanece fora do repositório e não é pg_dump/Storage completo.

## Confirmação posterior

A execução final na nuvem foi concluída pelo coordenador, sem novo build pesado no Mac: [CI da main aprovada](https://github.com/alxgoes/fsy-event-app/actions/runs/39492496466). As evidências finais e a verificação publicada estão em [evidencias-publicacao-2026-10-20](../evidencias-publicacao-2026-10-20/). Os parágrafos anteriores preservam o estado do handoff antes dessa confirmação.
