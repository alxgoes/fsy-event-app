# Android 1.2.0 (3) — relatório da retomada

02/11/2026 · branch `feat/redesign-simplificacao-2026-11`. Retomada e troca de cargos concluídas com commits locais; publicação e instalação permanecem como etapas separadas.

## Telas e correções

- **Início, Agenda, Avisos e Mais:** navegação em quatro abas, cartões fixos, Agora/A seguir com relógio, agenda resumida, companhia, dois avisos e fotos. Mais reúne perfil, aparência e notificações; consultor e gestão aparecem somente para os cargos autorizados.
- **Agenda e acesso:** `Models.kt` agora também oculta a preparação interna marcada como Logística nos bancos antigos. Dia Zero e Equipe continuam ocultos para jovem/cargo desconhecido, incluindo telas, widgets e lembretes. A logística pública permanece visível. Testes cobrem também links de gestão redirecionados ao Início.
- **Inscrições:** `RegistrationsAdminScreen.kt`, `PortalApiClient.kt` e `Models.kt` seguem o contrato dos 19 campos da autorização: edição parcial, validação, autoria/data, selo Editado, prévia, PDF salvo e desfazer com confirmação. Substituir inscrições ajustadas exige confirmação explícita. Originais e identidade da importação ficam intactos.
- **Continuidade e privacidade:** `FsyAppState.kt` retém registro/rascunho só em RAM durante rotação/tema/fonte; limpa ao sair, trocar conta ou perder acesso. `AdminHubScreen.kt` preserva o módulo selecionado. `FsyExternal.kt` apaga PDFs temporários e revoga permissões ao sair/trocar conta; `MainActivity.kt` também expira arquivos antigos na retomada.
- **Revisão visual:** corrigidos contraste da Galeria escura, português de Consultores e singular jovem, quebra dos selos e nomes acessíveis dos interruptores. Selos usam pares semânticos de contraste. `network_security_config.xml` debug declara explicitamente subdomínios desabilitados nos três endereços locais.

- **Cargos:** Mais → Gestão → Contas e acessos → Gerenciar permite aos três cargos de gestão escolher os sete cargos em português. A API fornece as ações disponíveis; próprio cargo e última gestão seguem protegidos. O formulário ganhou janela de medidas finitas. Ao retomar e a cada minuto ativo, o perfil é revalidado; mudança de acesso limpa dados antigos e reaplica a navegação.

## Verificação

| Verificação | Resultado |
| --- | --- |
| `:app:compileDebugKotlin` | Aprovado; recompilado também pelos testes finais. |
| `testDebugUnitTest` | 51 testes, zero falhas e zero ignorados. |
| Cargos, edição de conta e revalidação do perfil | Aprovados; testes visuais com gráficos nativos e fonte 200%. |
| `assembleDebug` e `lintDebug` finais | Aprovados; lint com zero erros e 52 avisos, sem supressões novas. |
| `git diff --check` | Aprovado. |

Os avisos incluem textos em recursos de widgets, versões de dependências, atributos, convenções e o uso condicionado de alarmes exatos. Não foram atualizadas dependências neste ciclo. Logs e snapshot dos 41 testes: `D:/Projects/PC/FSY/_trabalho/logs/retomada-gpt/`. Caches e temporários da verificação ficaram no D:; uma tarefa pesada por vez.

APK local: `app-debug.apk`, 13.730.532 bytes, versão `1.2.0-debug`, código 3. SHA256: `db878342c9d06dfa82a852ab4745e24a115344d2b66194afab55a4e18c4d9581`. É um APK de teste; não foi assinado/publicado como release.

## Capturas e limites

90 PNGs finais copiados para `D:/Projects/PC/FSY/_trabalho/capturas/android-depois/retomada-2026-11-02/`; lista completa em `CAPTURAS-2026-11.md`. Incluem claro/escuro, 360 dp, fonte 200%, Mais/foto pendente, revisão do consultor, editor da autorização e erro de prévia, widgets e movimento. Auditoria Impeccable registrada à parte, sem achados abertos no escopo revisado.

Somente identidades fictícias foram usadas. O transporte autenticado de prévia/download foi testado; a prévia visual automatizada cobre PDF corrompido, erro em português e rascunho preservado. A renderização bem-sucedida do PDF e a abertura externa ainda precisam de aparelho, assim como Photo Picker, OAuth/FCM reais, TalkBack, Doze, launcher e háptica. Capturas Robolectric não comprovam esses comportamentos.

Migrações e agenda foram aplicadas no Supabase após autorização, com conferência documentada em `docs/redesign-2026-11/APLICACAO-SUPABASE.md`. Os commits locais registram o redesign completo; publicação do site, push/PR e distribuição do APK são etapas separadas.
