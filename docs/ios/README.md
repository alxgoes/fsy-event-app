# App iOS — FSY Sessão Ribeirão Preto 2

App nativo SwiftUI para iPhone (iOS 17+), com as mesmas contas, o mesmo banco Supabase (`vhbmnnpgftrrovjtvbzo`) e as mesmas permissões do portal https://fsy-event-app.vercel.app. Tema **Alegrar-se em Cristo**, Filipenses 4:4.

Arquitetura, estado real e pendências: [ENTREGA.md](ENTREGA.md). Contratos de integração: [CONTRATO-WEB.md](CONTRATO-WEB.md).

## 1. Abrir no Xcode

Neste Mac o Xcode completo está fora de `/Applications`. Abra pelo próprio Xcode (`/Users/alexgoes/Downloads/Xcode.app`) → **File › Open** → `ios/FSY.xcodeproj`. Esquema **FSY**; alvos `FSY` (app) e `FSYWidgetsExtension` (widgets + Live Activity). Não há pacotes externos (SPM/CocoaPods).

Para linha de comando, sem alterar a seleção global:

```sh
export DEVELOPER_DIR=/Users/alexgoes/Downloads/Xcode.app/Contents/Developer
```

## 2. Configuração pública (`ios/Config/Local.xcconfig`)

```sh
cp ios/Config/Local.example.xcconfig ios/Config/Local.xcconfig   # arquivo ignorado pelo Git
```

| Chave | Valor |
| --- | --- |
| `SUPABASE_PUBLISHABLE_KEY` | Chave **publicável** do projeto (Supabase → Project Settings → API Keys), a mesma `NEXT_PUBLIC_SUPABASE_ANON_KEY` do portal. Nunca `service_role`/secret. |
| `FSY_DEVELOPMENT_TEAM` | Team ID (10 caracteres) em Xcode › Settings › Accounts. |
| `FSY_BUNDLE_ID` | Identificador único para o seu Team, ex.: `br.com.seunome.fsyrp2`. |
| `FSY_APP_GROUP` + entitlements | Opcional, só com Team pago; ativa os widgets da programação. |

`SUPABASE_HOST` e `PORTAL_HOST` já vêm em `Shared.xcconfig`. Sem a chave publicável o app abre uma tela "Configuração necessária" em vez de falhar.

## 3. Assinatura e Team

Estado em 20/10/2026: Personal Team `K4A892MU5J` configurado no Xcode; o primeiro build com `-allowProvisioningUpdates` gerou o certificado Apple Development e o perfil (validade 7 dias). `Local.xcconfig` já preenchido neste Mac. Em outro Mac:

1. Xcode › Settings › Accounts › **+** › Apple ID (conta gratuita basta para testar; o Xcode cria o certificado de desenvolvimento).
2. Copie o Team ID para `FSY_DEVELOPMENT_TEAM` e defina `FSY_BUNDLE_ID` único.
3. Na primeira abertura no aparelho: iPhone › Ajustes › Geral › VPN e Gerenciamento de Dispositivos › confiar no desenvolvedor.

Team gratuito: app, Live Activity, lembretes locais e login funcionam; perfis expiram em 7 dias; **App Group não é suportado**, então os widgets mostram "Abra o app FSY". Com Team pago, preencha `FSY_APP_GROUP` e descomente as duas linhas de entitlements do exemplo.

## 4. Modo de Desenvolvedor e aparelho

iPhone de teste: iPhone SE (iPhone12,8), iOS 26.6.1, sem Dynamic Island (a Live Activity aparece na Tela Bloqueada). Em 20/10/2026 às 21h14 ficou comprovado: `developerModeStatus=enabled`, `pairingState=paired`, `tunnelState=connected`, `ddiServicesAvailable=true`.

Conferência:

```sh
xcrun devicectl device info details --device 9D90349B-28C9-5857-BAD2-7D0CC6198B2F | grep -E "developerMode|pairing|tunnel|ddi"
```

## 5. Compilar e instalar (serial — Mac de 8 GB)

```sh
cd ios
# Testes de lógica pura no macOS (sem simulador)
./Tests/run-logic-tests.sh
# Build sem assinatura (verificação)
xcodebuild -project FSY.xcodeproj -scheme FSY -configuration Debug -sdk iphoneos \
  -destination 'generic/platform=iOS' -jobs 1 CODE_SIGNING_ALLOWED=NO build
# Build assinado para o iPhone conectado (depois do Team configurado)
xcodebuild -project FSY.xcodeproj -scheme FSY -configuration Debug \
  -destination 'platform=iOS,id=00008030-001115891446402E' -jobs 1 -allowProvisioningUpdates \
  -derivedDataPath build build
xcrun devicectl device install app --device 9D90349B-28C9-5857-BAD2-7D0CC6198B2F build/Build/Products/Debug-iphoneos/FSY.app
xcrun devicectl device process launch --device 9D90349B-28C9-5857-BAD2-7D0CC6198B2F <FSY_BUNDLE_ID>
```

Ou, no Xcode, selecione o iPhone conectado e ▶︎ Run. Uma tarefa pesada por vez; sem simulador.

## 6. Roteiro de teste no aparelho

Use uma conta real controlada (de preferência um `jovem` e uma de gestão). Marque cada passo como aprovado só com observação direta.

1. **Abertura:** fundo azul-noite estático → círculos F·S·Y entram em sequência → entrada. Com Ajustes › Acessibilidade › Movimento › Reduzir Movimento: só esmaece.
2. **Entrar** com e-mail/senha do portal. Senha errada → "E-mail ou senha incorretos…". Conta não confirmada → pede confirmação.
3. **Início:** "Olá, <primeiro nome>!", companhia/quarto iguais ao portal; antes de 06/02/2027 contagem regressiva + primeira atividade; tema e versículo; companhia, lema e consultores; 3 avisos recentes.
4. **Agenda:** dias 1–5 (jovem) ou Dia Zero também (equipe); tocar expande descrição; conferir títulos/horários com /schedule do portal.
5. **Avisos:** mesmos comunicados do /announcements para essa conta; busca, filtros, "Sua companhia", "Você curtiu" quando curtido no portal.
6. **Atualização:** altere um aviso no portal (conta de gestão) → no app, puxe para atualizar ou volte do segundo plano após 30 s → aparece. Rodapé mostra "Atualizado às HH:mm".
7. **Offline:** modo avião → abrir o app → faixa "Sem conexão" e cópia salva; sem dados médicos.
8. **Lembretes:** Perfil › "Lembrete 10 min antes" → pedido de permissão só agora → em Ajustes › Notificações o app aparece. Notificação → "Ver na agenda" abre a atividade.
9. **Live Activity:** Início › "Acompanhar na Tela Bloqueada" → bloquear o iPhone → cartão com título, local e contagem.
10. **Links:** em Safari digite `fsyrp2://avisos` → abre a aba Avisos; `fsyrp2://admin` → nada acontece.
11. **Sair** (Perfil) → confirmação → volta à entrada; lembretes pendentes, Live Activity e cópia local somem. Entrar com outra conta → nenhum dado da anterior aparece.
12. **Sessão expirada:** revogar sessões no Supabase (ou trocar a senha pelo portal) → ao atualizar, o app volta à entrada com "Sua sessão expirou".
13. **Google:** só depois do item 1 de [CONTRATO-WEB.md](CONTRATO-WEB.md); abre a autenticação do sistema, não WebView.
14. **Acessibilidade:** VoiceOver lê rótulos em português; Texto Maior (Ajustes › Tela e Brilho) não corta cartões no SE; claro/escuro.
15. **Painel nativo (equipe):** Início ou Perfil › “Painel de Logística” → navegação SwiftUI com módulos do cargo e contagens reais, sem navegador. Abra Logística › “+” → formulário nativo, Salvar desabilitado vazio; cancele sem criar dado real. Companhias, Programação, Comunicados, Mídia, Contas, Saúde, Inclusão e Auditoria usam as mesmas APIs do site. Listas atualizam ao puxar, ao retornar e a cada 60 segundos enquanto ativas. Validar mutações somente com fixtures isoladas; não excluir contas ou enviar mensagens reais como QA.
16. **Instagram:** Início › cartão Instagram (ou Perfil › Galeria do Instagram) → as mesmas publicações do perfil oficial; vídeo/carrossel com selo; tocar abre o detalhe com zoom por pinça/toque duplo, legenda completa e "Abrir publicação no Instagram". Modo avião → erro com "Tentar novamente".
17. **Fundo:** trocar entre as abas → formas geométricas se reorganizam; com Reduzir Movimento ficam paradas. Conferir contraste no claro e no escuro.
