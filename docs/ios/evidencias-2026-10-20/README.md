# Verificação visual do iPhone — 20/10/2026

O root observou o aparelho real pela janela Espelhamento do iPhone, usando Orca Computer Use após o humano liberar Acessibilidade e captura de tela. Não foi usado simulador.

- Antes da correção: abertura com os círculos F·S·Y permanecia visível.
- Após a atualização do Claude: tela de entrada observada, com o texto **Alegrar-se em Cristo**; `entrada-iphone.png` registra essa tela sem credenciais ou dados de participantes.
- Retorno OAuth: com confirmação humana específica, o root acrescentou `fsyrp2://auth-callback` às Redirect URLs do projeto Supabase existente. Total passou de quatro para cinco; Site URL e os quatro retornos anteriores foram preservados.
- O humano concluiu a autenticação do Google e confirmou entrada no app. Root observou o Início nativo com as abas Início/Agenda/Avisos/Perfil e o tema correto. Não preencheu, extraiu nem registrou senha/token do iPhone.
- A primeira visita à Agenda expôs erro de carregamento. Claude corrigiu a relação ambígua dos autores de avisos e o descarte de leituras bem-sucedidas. Após atualização, root reabriu o app às 23h03 com a sessão preservada e observou a Agenda com atividades, horários, locais e seletor de dias; `agenda-iphone.png` registra apenas programação, sem dados de participantes. Logs do executor confirmaram 82 atividades válidas. Avisos exibiu estado vazio sem erro e horário de atualização; a consulta retornou zero registros para a conta, sem comparação com o portal.
- Tema do site publicado e conferido em `/login`, `/manifest.webmanifest` e `/sw.js`: detalhes em `publicacao-tema.json`. CI da revisão web aprovada.

Capturas de prompts de senha/autopreenchimento ou de dados autenticados não foram adicionadas ao repositório. Esta evidência não certifica todos os fluxos ou acessibilidade do aplicativo.
