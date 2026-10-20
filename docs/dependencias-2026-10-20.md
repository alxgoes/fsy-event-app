# Dependências — lote complementar em 20/10/2026

A migração local foi implementada para **Next 16.4.2**, com **React/React DOM 19.3.1**, tipos React 19, **eslint-config-next 16.4.2** e **ESLint 9.39.5**. A linha 16 está em suporte ativo na [política oficial](https://nextjs.org/support-policy); versões/API de migração foram conferidas no [guia oficial do Next 16](https://nextjs.org/docs/app/guides/upgrading/version-16), registro npm e [advisories do projeto](https://github.com/vercel/next.js/security/advisories).

Esta atualização substitui o roteiro que permaneceu pendente no commit `d1055c7`. A integração do lote de requisições foi concluída após handoff. **Lint, typecheck, 145 testes serializados e build Webpack com um worker passaram**.

## Mudanças efetivas

- `cookies()` assíncrono no cliente servidor e callback Auth; contextos de contas/inclusão aguardam `params`, com testes adaptados ao contrato do framework.
- Middleware renomeado para `proxy`, preservando as regras de segurança.
- `next lint` substituído pela CLI ESLint e flat config oficial. Nenhuma regra nova foi desativada. Ajustes de efeitos/refs atendem às regras React adicionais.
- Build mantém Webpack via `next build --webpack`, flag oficialmente suportada, evitando acrescentar uma migração de bundler à mudança de framework.
- shadcn e os plugins de CSS ficam somente em desenvolvimento. A classificação reflete uso no build, sem afirmar que retirar um pacote do runtime corrige sua vulnerabilidade.
- `npm audit fix --ignore-scripts` executado sem force, para atualizações compatíveis das transitivas. Nenhuma instalação usou `--force`, `--legacy-peer-deps` ou override de major.

## Auditoria de dependências

O conjunto anterior sinalizava 25 pacotes (2 críticos, 18 altos, 5 moderados). Depois da atualização compatível: **13 avisos totais, 0 críticos**, na cadeia de ferramentas de desenvolvimento. Após a classificação dos plugins CSS, `npm audit --omit=dev --json` retornou **0 vulnerabilidades de produção** na consulta registrada. Isso é uma leitura pontual do registro, não uma garantia futura de ausência de vulnerabilidades.

Persistem avisos na cadeia de Tailwind 3/globs/PostCSS e ferramentas de lint. O relatório npm sugere Tailwind 4 para parte deles; não foi aplicada essa mudança adicional às cegas. ESLint 9 é a major admitida pelos peers atuais de `eslint-plugin-import`, `eslint-plugin-react` e `eslint-plugin-jsx-a11y` usados pelo config oficial. A versão avisa fim de suporte; migrar para 10 exige atualizar a compatibilidade dos plugins sem forçar peers. Isso não mantém o Next 14 em execução nem um aviso crítico de runtime conhecido.

## Verificação e retorno

A confirmação global passou com **145/145 testes**, lint sem erros/avisos e typecheck. O build Next 16.4.2 passou com `experimental.cpus: 1`; o framework alinhou `jsx: react-jsx`, target ES2017 e tipos de desenvolvimento no tsconfig. O build anterior interrompido por pressão de recursos não foi contado como aprovação. QA visual e evidências estão no relatório Impeccable atualizado.

`d1055c7` permanece como referência anterior. Código/lockfile foram preservados no Git; uma reversão precisa considerar a atualização conjunta de Next, React, tipos e ESLint. Não houve publicação nem migração remota. O coordenador confirmou Supabase Healthy, contagens preservadas e `/api/media` publicado 200. O remoto ainda executa código anterior até a implantação. O coordenador confirmou aplicação atômica de 001–003 e testes remotos de políticas/contagens preservadas. O complemento `202610200003` também passou nos testes locais. Consultar `seguranca-rls-recuperada.md`.
