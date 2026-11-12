# Atualização automática do app Android — arquitetura e brief (11/11/2026)

Executar **depois** que os briefs WEB e ANDROID desta pasta terminarem (mexe nos mesmos arquivos). Mesmas regras de convivência:
nenhum git de escrita, pt-BR, sem jargão na interface, jovem não vê nada de gestão.

## Por que hoje é preciso desinstalar
1. O build `debug` usa o **mesmo** `applicationId` (`br.com.fsyrp2.app`) do `release`, mas outra assinatura. O Android recusa atualizar
   um app por outro com assinatura diferente → só instalando do zero.
2. Instalar um APK com `versionCode` igual ou menor que o instalado também é recusado.
3. O app não sabe que existe versão nova: quem atualiza é a pessoa, baixando o APK à mão.

## Decisões
- **Uma assinatura só nos celulares:** todo APK distribuído é `release`, assinado com o keystore oficial (`android/keystore.properties`,
  fora do Git). O `debug` ganha `applicationIdSuffix = ".debug"` e nome "FSY (teste)": instala ao lado, nunca conflita.
- **`versionCode` sempre crescente**, garantido pelo script de publicação (recusa publicar se não for maior que o publicado).
- **O app se atualiza sozinho** a partir do manifesto que o site já serve em `GET /api/app-release` (rota pública).
- **Hospedagem do APK:** GitHub Releases do repositório (público), tag `android-v<versionName>`, como já é feito.

## Servidor (`src/lib/app-distribution/android-release.ts`, `src/types/app-distribution.ts`)
- Se `NEXT_PUBLIC_ANDROID_APK_URL` não estiver definida e `android/release-metadata.json` tiver `sha256` e `sizeBytes`, derivar
  `downloadUrl = https://github.com/alxgoes/fsy-event-app/releases/download/android-v<versionName>/<apkFileName>`
  (dono/repositório em uma constante). Assim publicar = atualizar o JSON + criar a release; não é preciso mexer em variável da Vercel.
- Acrescentar ao metadado (opcionais, retrocompatíveis): `minSupportedVersionCode` (abaixo disso a atualização é obrigatória) e
  `releaseNotesPtBr: string[]` (até 5 linhas curtas, linguagem simples).
- Testes: URL derivada, URL de ambiente tem precedência, metadado incompleto → sem link.

## Android — atualizador interno (`android/app/src/main/java/.../update/`)
Fluxo:
1. **Verificar**: ao abrir o app e ao voltar ao primeiro plano, no máximo 1× a cada 6 h (WorkManager periódico diário como reforço), e pelo botão
   **Mais › "Verificar atualização"**. Lê `/api/app-release`; há atualização se `androidMetadata.versionCode > BuildConfig.VERSION_CODE`,
   `applicationId` igual ao do app, `sha256` presente e `downloadUrl` HTTPS em host permitido (`github.com`,
   `objects.githubusercontent.com`, `release-assets.githubusercontent.com` — seguir redirecionamentos só entre esses hosts).
2. **Baixar** em segundo plano para `cacheDir/updates/` (retomar/limpar arquivos antigos; respeitar rede medida: em dados móveis perguntar antes).
3. **Conferir antes de instalar** (falhou → apaga e não instala): tamanho e **SHA-256** iguais aos do manifesto; pacote do APK =
   `br.com.fsyrp2.app`; `versionCode` do APK > instalado; **certificado de assinatura do APK = certificado do app instalado**
   (`PackageManager.getPackageArchiveInfo` + `GET_SIGNING_CERTIFICATES`).
4. **Instalar** com `PackageInstaller` (sessão `MODE_FULL_INSTALL`), receiver para o resultado.
   - Android 12+ (API 31): `setRequireUserAction(USER_ACTION_NOT_REQUIRED)` + permissão `UPDATE_PACKAGES_WITHOUT_USER_ACTION`.
     Quando o próprio app foi quem instalou a versão atual, o sistema atualiza **sem perguntar**; caso contrário mostra uma confirmação.
   - Permissão `REQUEST_INSTALL_PACKAGES`; na primeira vez, levar a pessoa à tela "Permitir desta fonte" com uma explicação de uma frase.
   - Resultado `STATUS_PENDING_USER_ACTION` → abrir o intent de confirmação do sistema.
5. **Depois**: ao reabrir, mostrar "Atualizado para a versão X" com as novidades (`releaseNotesPtBr`), uma vez.

Interface (mesmos componentes FSY; nada disso revela gestão):
- Faixa discreta no topo do Início/Mais: "Nova versão 1.2.3 disponível" · **Atualizar**. Durante o download: barra de progresso e "Baixando…".
- Obrigatória (`versionCode < minSupportedVersionCode`): tela cheia "Atualize para continuar" com um botão; sem atalho para pular.
- Mais › "Sobre o app": versão instalada, "Verificar atualização", data da última verificação.
- Erros em pt-BR claro (sem rede, espaço insuficiente, arquivo não conferiu, instalação cancelada), sempre com "Tentar de novo".
Preferência "Atualizar automaticamente" (ligada por padrão; desligada = só avisa).
Testes: comparação de versões, validação de host/hash/pacote/assinatura (com APKs falsos de teste), limite de 6 h, estados da interface no harness visual
(disponível, baixando, erro, obrigatória) em 320–412 dp e fonte 200 %.

## Publicação em um comando — `scripts/publicar-android.ps1`
Parâmetros: `-Versao 1.2.3 -Notas "linha 1","linha 2" [-MinimaSuportada 5]`. Passos, parando no primeiro erro:
1. Confere árvore limpa e que `keystore.properties` existe; calcula `versionCode` = publicado + 1; grava versão no `build.gradle.kts`.
2. `gradlew testReleaseUnitTest assembleRelease lintRelease` (JDK 21, `GRADLE_USER_HOME` no D:).
3. `apksigner verify --print-certs`: exige esquemas v2/v3 e **o mesmo SHA-256 de certificado** de `android/release-metadata.json` (nunca trocar de chave).
4. Calcula tamanho e SHA-256, grava `android/release-metadata.json` (com notas e mínima suportada).
5. Mostra o resumo e **pede confirmação** antes de qualquer ação externa; então `gh release create android-v<versão> <apk> --notes ...`,
   e deixa o commit do metadado pronto para o PR (o site passa a anunciar a versão quando o PR entra em `main` e a Vercel publica).
Nunca imprime senhas; nunca envia o keystore.

## Limites honestos (documentar no relatório e na tela "Sobre o app" quando fizer sentido)
- A **primeira** instalação da versão com atualizador ainda é manual (e, se o celular tiver um build de teste antigo com outra assinatura,
  exige desinstalar uma última vez). Dali em diante não é mais preciso desinstalar.
- Atualização sem nenhuma confirmação só em Android 12+ e a partir da segunda atualização feita pelo próprio app; alguns aparelhos
  (inclusive Samsung) podem mostrar um toque de confirmação ou a verificação do Play Protect.
- Alternativa futura com atualização 100 % automática: publicar na Google Play (teste interno/fechado), que exige conta de desenvolvedor.

## Entrega
`docs/android/RELATORIO-ATUALIZADOR.md` (até 400 palavras): o que foi feito, resultado honesto de testes/build/lint, o que só dá para
confirmar num aparelho real (instalação sem confirmação, comportamento na One UI).
