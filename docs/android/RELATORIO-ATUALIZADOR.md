# Atualização automática — Android 1.3.0 (6) · 11/11/2026

Arquitetura: `docs/atualizacao-2026-11-11/ATUALIZACAO-AUTOMATICA.md`.

## O que existe agora
- **Servidor** (`src/lib/app-distribution/android-release.ts`): sem `NEXT_PUBLIC_ANDROID_APK_URL`, o manifesto `GET /api/app-release`
  aponta para a release do GitHub `android-v<versão>/<apk>` desde que `android/release-metadata.json` tenha SHA-256 e tamanho válidos.
  Campos opcionais `minSupportedVersionCode` (força a atualização) e `releaseNotesPtBr` (até 5 linhas).
- **App** (`app/.../update/`, controlador em `FsyAppState`):
  - verifica ao abrir e ao voltar ao app (no máximo a cada 6 h) e uma vez por dia em segundo plano (WorkManager); botão em Mais › Sobre o app;
  - baixa só de `github.com`/`*.githubusercontent.com`, pergunta antes em rede móvel medida;
  - antes de instalar confere tamanho, SHA-256, pacote `br.com.fsyrp2.app`, versão maior que a instalada e **o mesmo certificado do app instalado**;
    qualquer falha apaga o arquivo;
  - instala por `PackageInstaller` (Android 12+ pede instalação sem confirmação); sem permissão "instalar desta fonte", leva às configurações
    e continua sozinho ao voltar;
  - faixa no Início e em Mais, tela obrigatória quando abaixo da versão mínima, aviso "Atualizado para a versão X" com as novidades;
    preferência "Atualizar automaticamente" (ligada por padrão).
  - O build de teste chama-se **"FSY (teste)"** (`br.com.fsyrp2.app.debug`): instala ao lado do oficial e só verifica atualização quando pedido.
- **Publicação**: `scripts/publicar-android.ps1 -Versao 1.3.1 -Notas "…" [-MinimaSuportada N] [-Simular]` — calcula o versionCode,
  compila/testa o release, confere assinatura v2/v3 e o certificado oficial, grava o metadado e só cria a release no GitHub após confirmação.

## Verificação
Ver resultados no commit/PR desta entrega. Testes unitários novos: `AppUpdateValidatorTest` (hosts permitidos, versão, manifesto incompleto,
versão mínima, intervalo de 6 h, APK adulterado/assinatura diferente recusado e apagado).

## Só confirmável no aparelho
Instalação sem confirmação (depende do Android 12+ e de a versão atual ter sido instalada pelo próprio app; One UI/Play Protect podem pedir um toque),
retomada após conceder a permissão, comportamento em dados móveis.
**A primeira instalação da 1.3.0 é manual**; se o celular tiver um build de teste antigo com o mesmo pacote, desinstale-o uma última vez.
