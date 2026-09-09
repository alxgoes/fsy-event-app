# Fluidez e navegação FSY

## Continuação: inclusão e publicação no GitHub

Adicionar acompanhamento de inclusão em Registros & Atendimentos, vinculado à ficha médica e sem conta de login do participante. Contratos em `src/types/inclusion.ts` precedem a UI. Persistir entrevistas, contatos, necessidades, etapas e decisão humana com histórico. Usar os perfis atuais, conforme confirmado pelo usuário. Aplicar e testar migrações no Supabase, verificar a interface e enviar o código ao repositório solicitado, incluindo as melhorias de fluidez anteriores.

## Objetivo

Melhorar a rolagem e as animações sem descaracterizar o evento. Refinar o menu de gestão como uma superfície arredondada e flutuante, com seleção azul FSY, elevação suave e controles acessíveis. Revisar textos genéricos e emojis decorativos.

## Divisão de trabalho

- Interface: `AdminLayout` e CSS próprio; limpeza editorial pontual nas telas existentes.
- Dados: evitar consultas de perfil duplicadas, preservar consistência após logout, paralelizar consultas independentes do resumo administrativo e retirar conteúdo fictício do fallback do Instagram.
- Desempenho e QA: fundo Seigaiha, efeitos fora da tela, indicador de rolagem, mídia e ciclo de vida do PWA.
- Integração e domínio: conferir fluxos, preservar regras de acesso, programação, identidade e alertas de saúde; validar lint, build e telas disponíveis.

## Mapa funcional

- `/login`: entrada, cadastro e recuperação de acesso.
- `/dashboard`: portal jovem, companhia, programação atual, comunicados e fotos.
- `/schedule` e `/announcements`: consulta das atividades e avisos.
- `/consultor`: acompanhamento da companhia por consultores.
- `/admin`: visão geral da coordenação e acesso aos módulos permitidos por perfil.
- Gestão: auditoria de consultores, registros e atendimentos, companhias, programação, logística, comunicados, mídia e usuários.
- PWA: instalação, recursos estáticos e programação previamente salva para situações de conectividade limitada.

## Critérios de entrega

1. Manter o fundo animado, marcas, cores e transições de seleção.
2. Reduzir trabalho contínuo durante rolagem e evitar requisições duplicadas.
3. Navegação por teclado e toque; controles do menu com ao menos 44 px e suporte a movimento reduzido.
4. Não alterar os fatos do evento nem eliminar alertas necessários.
5. Executar lint e build; documentar os limites dos testes autenticados e de desempenho, sem apresentar estimativas como medições reais.

## Notas de domínio

As skills locais contêm referências antigas a nomes de perfis e ao tema. O código, `PRODUCT.md`, `DESIGN.md` e a programação existente orientam esta entrega. A revisão não altera o tema ou as datas: o dia da equipe em 05/02 e a chegada dos jovens em 06/02 explicam os intervalos diferentes mostrados nas áreas correspondentes.
