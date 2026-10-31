# Compilação e entrega Android — 31/10/2026

Estado verificado: APK release Kotlin/Compose compilado e assinado. Sem WebView para funcionalidades internas.

## Evidências

- `assembleRelease`, `testReleaseUnitTest` e `lintRelease`: `BUILD SUCCESSFUL`.
- 7 testes JVM aprovados: ordenação/isolamento por conta, PKCE/deep links, agenda/fuso/horário silencioso, papéis, vínculo push, campos JSON e rotas/respostas das APIs de contas/inclusão.
- Lint Android: 0 erros, 23 avisos (versões de dependências, organização de intent-filter, convenções Compose e recursos de ícone/SDK). Não são 23 falhas de compilação.
- `apksigner verify`: aprovado, RSA3072, assinatura v2 e v3. `zipalign -c -p 4`: aprovado.
- Pacote `br.com.fsyrp2.app`, versão 1.0.0 (1), mínimo Android 8/API26, destino/compilação API35; sem flag debuggable.
- Identidade e hash do arquivo: `android/release-metadata.json`.
- Logs locais fora Git: `preproducao/android-release-8.log`, `android-signature-final.txt` e resultados JVM/lint em `android/app/build/`.

## Limites de validação

Nenhum aparelho físico ou emulador conectado. Navegação visual, gesto de arraste real, OAuth, widgets no launcher e entrega real de FCM não foram executados em aparelho. Os testes JVM não provam esses comportamentos.

A ordem dos cartões Android é persistida localmente por conta. Os grupos/cartões próprios da interface nativa não alteram as preferências de layout da web.

A autorização acompanha os papéis reais do backend: não existe concessão fictícia de permissões granulares por campo de perfil. Formulários de contas, logística, agenda, saúde e inclusão usam os campos/ações aceitos nas APIs web. Dados desconhecidos não são inventados.

## Reproduzir a compilação

JDK21, Gradle8.9 (wrapper com SHA256 fixado), Android SDK35 e Build Tools oficiais. Um build pesado de cada vez; Gradle com um worker e compilação Kotlin no próprio processo.

Configuração pública Supabase/portal em `android/local.properties` ou variáveis documentadas em `app/build.gradle.kts`. Arquivo Firebase cliente em `android/app/google-services.json`. A chave privada de servidor FCM nunca é usada no APK.

Assinatura: `android/keystore.properties` aponta para a identidade persistente armazenada fora Git em `secrets/android`. Preserve a chave e as senhas para futuras atualizações. Nunca gere outra chave para substituir uma versão já instalada.

Com Java/SDK configurados, executar a partir de `android`:

```powershell
.\gradlew.bat :app:assembleRelease :app:testReleaseUnitTest :app:lintRelease
```

## Banco e ficha PDF

As migrações `202610310001` e `202610310002` foram aplicadas juntas em uma transação ao projeto Supabase confirmado. Antes: zero objetos-alvo existentes. Depois: seis tabelas novas com RLS forçada, zero grants de tabelas/funções para anon/authenticated, contagens antigas preservadas (Auth6/perfis6/companhias4/agenda82/prontuários0). O snapshot de estrutura/contagens não equivale a dump completo de dados/Auth/Storage.

A ficha de autorização sintética foi renderizada e inspecionada após corrigir marcação de sexo e sobreposição médica. Modelo oficial preservado byte a byte; cinco testes PDF aprovados. Não foi usado dado pessoal real.

## Publicação do APK

Release público: https://github.com/alxgoes/fsy-event-app/releases/tag/android-v1.0.0

Download HTTPS verificado: https://github.com/alxgoes/fsy-event-app/releases/download/android-v1.0.0/fsy-rp2-2027-v1.0.0-release.apk

O digest SHA256 publicado pelo GitHub coincide com `android/release-metadata.json`. A chave de assinatura permanece fora Git; o release contém apenas APK e soma de verificação.

Portal publicado: https://fsy-event-app.vercel.app/instalar — produção READY, HTTP200. `/api/app-release` retorna `ready_direct_download`, tamanho e SHA256 do APK real. Consultas sem sessão às rotas administrativas e de dispositivos retornaram401 JSON. Web lint/typecheck/build finais aprovados.
