# Android 1.2.2 (5) — simplificação e atualização de novembro de 2026

Este documento substitui as descrições de personalização, Perfil e rotação de avisos presentes no histórico da versão 1.1.0, e incorpora as entregas da versão 1.2.2 (`versionCode = 5`, 11/11/2026): sincronização ponta a ponta da foto de perfil com proteção contra laço de tentativa em URLs assinadas expiradas, link do grupo da companhia no WhatsApp (Jovem, Consultor e Gestão com alerta de companhia sem consultor) e auditoria completa de enquadramento responsivo (320 a 412 dp × fontes 1.0, 1.3 e 2.0). Veja detalhes em [RELATORIO-2026-11-11.md](RELATORIO-2026-11-11.md).

## Telas e navegação

- Quatro abas fixas: Início, Agenda, Avisos e Mais. Não há ordenação ou personalização de cartões, inclusive na equipe e na saúde.
- Início: tema em uma linha editorial, Agora/A seguir com relógio de 30 segundos, progresso, contagem antes da sessão, local oficial, agenda compacta com foco no item, companhia, dois avisos recentes e faixa de fotos.
- Mais: avatar com anel Sunshine, iniciais ou foto, companhia, consultores, quarto quando conhecido, Fotos/Instagram, aparência, Notificações e uma saída. Consultor e Gestão só existem para cargos autorizados. Fotos, Notificações, Consultor e Gestão usam telas empilhadas; voltar retorna a Mais.
- Avisos: autor, cargo e tempo relativo, Todos/Não lidos, leitura conforme visibilidade e curtida com retorno tátil e animação. O foco recebido de outra tela é consumido depois do destaque.
- Fotos: grade de três colunas, visualizador paginado em tela cheia, pinça e toque duplo. Instagram de reserva: `fsy_ribeiraopreto`.
- Gestão: componentes FSY, ordem fixa, confirmações de exclusão e editor de agenda com dias e categorias em português, validando HH:MM e fim posterior ao início.

## Foto de perfil

O Photo Picker do Android não pede acesso ao armazenamento. O processamento centraliza o recorte quadrado, limita a 1024 px, aplica orientação e comprime JPEG a 85%. Processamento e envio vivem no estado do ViewModel. Os estados pendente, aprovado e recusado seguem `src/types/profile-photo.ts`, com cancelamento e motivo da recusa. Foto aprovada pode ser removida com confirmação.

Consultor/gestão têm fila de fotos, contador em Mais, prévia grande, aprovação e recusa com motivo de pelo menos três caracteres. A lista de jovens usa somente fotos aprovadas retornadas por `/api/profile/photo/company`. Falhas de imagens assinadas solicitam novas URLs; fotos remotas ficam somente em memória e são descartadas ao sair.

## Cargos e contas

Em Mais → Gestão → Contas e acessos → Gerenciar, direção, coordenação e logística escolhem um dos sete cargos em português e usam Aplicar cargo. As ações vêm das permissões retornadas pelo servidor; o próprio cargo e a última conta de gestão continuam protegidos. O formulário usa o mesmo padrão de janela com limites finitos já empregado nos demais diálogos FSY, evitando um ciclo de medição nos campos de texto.

O app revalida o perfil ao retomar e a cada minuto enquanto está ativo. Alterações de cargo/companhia limpam os dados da autorização anterior, reaplicam a navegação e recarregam o conteúdo. Falhas temporárias mantêm a tela; suspensão ou sessão recusada encerram o acesso. O papel salvo offline é neutro e não concede funções de equipe.

## Inscrições e autorizações

A gestão pode editar os 19 campos previstos no contrato da autorização, conferir o rascunho em uma prévia, salvar, baixar o PDF salvo e desfazer ajustes com confirmação. O selo Editado acompanha autoria e data. Só os campos alterados são enviados; avisos da importação não impedem corrigir outro dado. Os valores originais da planilha e a identidade da inscrição permanecem intactos.

O registro e o rascunho ficam somente na memória do estado retido: sobrevivem a rotação, tema e fonte, sem entrar no Bundle nem na cópia offline. São apagados ao fechar, sair do módulo, trocar conta ou perder permissão. PDFs temporários são apagados e suas permissões de leitura revogadas ao sair/trocar conta; arquivos antigos também expiram na abertura e retomada do app. A substituição de inscrições com ajustes exige confirmação explícita de perda dos ajustes.

Os testes verificam campos parciais, validação, corpos PATCH/reset, transporte autenticado de prévia/download e confirmação de importação. O teste visual usa um PDF deliberadamente inválido para verificar o erro em português e a preservação do rascunho; a renderização bem-sucedida por PdfRenderer ainda requer validação em aparelho.

## Dados, acesso e segundo plano

- `ScheduleVisibility` filtra Dia Zero, categoria Equipe e a preparação interna de categoria Logística dos bancos antigos para jovem/cargo desconhecido em toda a agenda consumida por telas, widgets e lembretes. Itens públicos de Logística continuam disponíveis.
- Sem perfil confirmado, nenhum destino de equipe é exibido. Cargo salvo offline não concede acesso; links de equipe recusados retornam ao Início silenciosamente.
- `OfflineCache` guarda perfil, companhia, agenda e avisos por conta em arquivo privado, fora do backup. Logout apaga essa cópia. Não guarda fichas médicas, inclusão nem a lista de jovens. Leituras independentes preservam agenda e avisos se o perfil falhar.
- `FsyAppViewModel` preserva o estado em mudanças de configuração; campos de formulário usam estado salvável. O callback de conectividade é desregistrado ao encerrar o estado.
- `SessionTokens` centraliza a renovação entre app, push e widgets. O trabalho de push é persistido no WorkManager, revalidando conta e vínculo antes de exibir o aviso autenticado.
- Lembretes usam `setAndAllowWhileIdle`, ou precisão exata quando permitida. O padrão global é desligado; o silêncio não suprime lembretes pessoais. Há aviso de permissão negada.
- Campos opcionais de quarto, ônibus e pasta de fotos são mapeados quando retornados; ausência não vira informação inventada. Cadastro envia `stake` e valida `PasswordPolicy`.

## Reprodução e evidências

Executar uma tarefa Gradle por vez. JDK21 e SDK35 já existentes. Caches e diretório de usuário Java no D:, definidos somente no ambiente do comando. Não instalar emuladores nem alterar o Windows.

```powershell
$env:JAVA_HOME='C:/Program Files/Java/jdk-21'
$env:GRADLE_USER_HOME='D:/Projects/PC/FSY/_ferramentas/gradle-home'
$env:ANDROID_HOME='D:/Projects/PC/FSY/_ferramentas/android-sdk'
$env:ANDROID_USER_HOME='D:/Projects/PC/FSY/_ferramentas/android-user'
$env:JAVA_TOOL_OPTIONS='-Duser.home=D:/Projects/PC/FSY/_ferramentas/java-user'
cd android
.\gradlew.bat --no-daemon :app:compileDebugKotlin
.\gradlew.bat --no-daemon testDebugUnitTest
.\gradlew.bat --no-daemon assembleDebug lintDebug
```

O harness é exclusivo de debug, usa servidor HTTP local dentro dos testes e imagens sintéticas em memória. Não precisa mais iniciar `scripts/qa-android-visual-server.cjs`. HTTP é liberado exclusivamente para loopback no debug; release permanece HTTPS. O ripple nativo é desligado nas capturas Robolectric por incompatibilidade de ociosidade; escala, navegação e formulários continuam reais. Isto não valida fluidez/háptica em hardware.

Resultados finais e inventário de imagens: relatório da entrega e `CAPTURAS-2026-11.md`. Sem aparelho, permanecem pendentes OAuth/FCM reais, Photo Picker físico, TalkBack e Doze/launcher. Nenhuma publicação faz parte desta entrega.
