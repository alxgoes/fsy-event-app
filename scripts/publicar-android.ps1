[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Versao,

    [Parameter(Mandatory = $true)]
    [string[]]$Notas,

    [Parameter(Mandatory = $false)]
    [int]$MinimaSuportada = 0,

    [Parameter(Mandatory = $false)]
    [switch]$Simular
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Versao -notmatch '^\d+\.\d+\.\d+$') {
    throw "Formato de versão inválido ('$Versao'). Use o formato X.Y.Z (ex.: 1.3.0)."
}

$notasLimpas = @(
    $Notas |
        ForEach-Object { if ($null -ne $_) { $_.Trim() } else { '' } } |
        Where-Object { $_.Length -gt 0 }
)
if ($notasLimpas.Count -eq 0 -or $notasLimpas.Count -gt 5) {
    throw "Informe entre 1 e 5 linhas curtas em -Notas (recebido: $($notasLimpas.Count))."
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$androidDir = Join-Path $repoRoot 'android'
$gradleFile = Join-Path $androidDir 'app\build.gradle.kts'
$metadataFile = Join-Path $androidDir 'release-metadata.json'
$keystorePropsFile = Join-Path $androidDir 'keystore.properties'

if (-not (Test-Path -LiteralPath $metadataFile)) {
    throw "Arquivo $metadataFile não encontrado."
}
if (-not (Test-Path -LiteralPath $gradleFile)) {
    throw "Arquivo $gradleFile não encontrado."
}
if (-not (Test-Path -LiteralPath $keystorePropsFile)) {
    throw "Arquivo android/keystore.properties não encontrado. A assinatura oficial é obrigatória."
}

$metaAtual = Get-Content -LiteralPath $metadataFile -Raw -Encoding UTF8 | ConvertFrom-Json
$versionCodePublicado = [int]$metaAtual.versionCode
$certSha256Esperado = [string]$metaAtual.signerCertificateSha256

if ([string]::IsNullOrWhiteSpace($certSha256Esperado) -or $certSha256Esperado -notmatch '^[a-fA-F0-9]{64}$') {
    throw "Certificado SHA-256 inválido ou ausente em android/release-metadata.json."
}

$gradleTexto = Get-Content -LiteralPath $gradleFile -Raw -Encoding UTF8
$versionCodeGradle = 0
if ($gradleTexto -match 'versionCode\s*=\s*(\d+)') {
    $versionCodeGradle = [int]$Matches[1]
}

$novoVersionCode = [Math]::Max($versionCodePublicado + 1, $versionCodeGradle)
if ($novoVersionCode -le $versionCodePublicado) {
    throw "Recusado: o novo versionCode ($novoVersionCode) precisa ser maior que o publicado ($versionCodePublicado)."
}

$minimaEfetiva = if ($MinimaSuportada -gt 0) {
    $MinimaSuportada
} elseif ($metaAtual.PSObject.Properties.Name -contains 'minSupportedVersionCode' -and $null -ne $metaAtual.minSupportedVersionCode) {
    [int]$metaAtual.minSupportedVersionCode
} else {
    0
}

if ($minimaEfetiva -gt $novoVersionCode) {
    throw "A versão mínima suportada ($minimaEfetiva) não pode ser maior que o versionCode a publicar ($novoVersionCode)."
}

$apkFileName = "fsy-rp2-2027-v$Versao-release.apk"
$tagRelease = "android-v$Versao"
$downloadUrl = "https://github.com/alxgoes/fsy-event-app/releases/download/$tagRelease/$apkFileName"

if ($Simular) {
    Write-Output "=== MODO SIMULAÇÃO (-Simular) — Nenhuma alteração gravada nem publicada ==="
    Write-Output "Repositório          : $repoRoot"
    Write-Output "Keystore configurado : Sim (android/keystore.properties presente)"
    Write-Output "Versão publicada     : $($metaAtual.versionName) (versionCode $versionCodePublicado)"
    Write-Output "Nova versão          : $Versao (versionCode $novoVersionCode)"
    if ($minimaEfetiva -gt 0) {
        Write-Output "Mínima suportada     : versionCode $minimaEfetiva"
    }
    Write-Output "Certificado exigido  : $certSha256Esperado"
    Write-Output "Arquivo APK          : $apkFileName"
    Write-Output "Tag GitHub Release   : $tagRelease"
    Write-Output "URL derivada         : $downloadUrl"
    Write-Output "Notas da versão      :"
    foreach ($linha in $notasLimpas) {
        Write-Output "  - $linha"
    }
    Write-Output "Passos que seriam executados em modo real:"
    Write-Output "  1. Conferir árvore Git limpa e atualizar versionCode=$novoVersionCode / versionName=""$Versao"" em app/build.gradle.kts"
    Write-Output "  2. Executar gradlew --no-daemon :app:testReleaseUnitTest :app:assembleRelease :app:lintRelease"
    Write-Output "  3. Verificar assinatura v2/v3 e SHA-256 do certificado com apksigner verify --print-certs"
    Write-Output "  4. Atualizar android/release-metadata.json com tamanho, SHA-256, notas e mínima suportada"
    Write-Output "  5. Pedir confirmação explícita antes de 'gh release create $tagRelease' e do commit do metadado"
    exit 0
}

# 1. Conferir árvore Git limpa
Push-Location $repoRoot
try {
    $gitStatus = & git status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível verificar o estado do Git."
    }
    if (-not [string]::IsNullOrWhiteSpace(($gitStatus -join "`n"))) {
        throw "A árvore do Git possui alterações pendentes. Faça commit ou limpe antes de publicar."
    }
} finally {
    Pop-Location
}

# Atualizar versão em android/app/build.gradle.kts
$gradleAtualizado = $gradleTexto -replace 'versionCode\s*=\s*\d+', "versionCode = $novoVersionCode"
$gradleAtualizado = $gradleAtualizado -replace 'versionName\s*=\s*"[^"]+"', "versionName = ""$Versao"""
Set-Content -LiteralPath $gradleFile -Value $gradleAtualizado -Encoding UTF8 -NoNewline

# 2. Compilar e testar Release (uma tarefa Gradle por vez)
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-21'
$env:GRADLE_USER_HOME = 'D:/Projects/PC/FSY/_ferramentas/gradle-home'

Push-Location $androidDir
try {
    foreach ($task in @(':app:testReleaseUnitTest', ':app:assembleRelease', ':app:lintRelease')) {
        Write-Output "Executando Gradle $task..."
        & .\gradlew.bat --no-daemon $task
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao executar $task."
        }
    }
} finally {
    Pop-Location
}

$apkGerado = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $apkGerado)) {
    throw "APK release não encontrado em $apkGerado."
}

# 3. Verificar assinatura v2/v3 e certificado SHA-256 com apksigner
$sdkRoot = $env:ANDROID_SDK_ROOT
if ([string]::IsNullOrWhiteSpace($sdkRoot)) {
    $sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
}
$apksigner = Get-ChildItem -Path (Join-Path $sdkRoot 'build-tools') -Filter 'apksigner.bat' -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1

if ($null -eq $apksigner) {
    throw "apksigner.bat não encontrado em $sdkRoot\build-tools."
}

$verifyOutput = & $apksigner.FullName verify --verbose --print-certs $apkGerado 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    throw "Falha na verificação do apksigner."
}
if ($verifyOutput -notmatch 'Verified using v2 scheme \(APK Signature Scheme v2\):\s*true') {
    throw "O APK não possui assinatura v2 válida."
}
if ($verifyOutput -notmatch 'Verified using v3 scheme \(APK Signature Scheme v3\):\s*true') {
    throw "O APK não possui assinatura v3 válida."
}
if ($verifyOutput -notmatch 'Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]{64})') {
    throw "Não foi possível ler o SHA-256 do certificado no APK."
}
$certApk = $Matches[1].ToLowerInvariant()
if ($certApk -ne $certSha256Esperado.ToLowerInvariant()) {
    throw "ERRO CRÍTICO: O certificado do APK ($certApk) difere do certificado oficial ($certSha256Esperado)."
}

# 4. Calcular tamanho e SHA-256 e gravar android/release-metadata.json
$apkDestino = Join-Path (Split-Path -Parent $apkGerado) $apkFileName
Copy-Item -LiteralPath $apkGerado -Destination $apkDestino -Force
$sizeBytes = (Get-Item -LiteralPath $apkDestino).Length
$sha256Apk = (Get-FileHash -LiteralPath $apkDestino -Algorithm SHA256).Hash.ToLowerInvariant()
$builtAtIso = (Get-Date).ToUniversalTime().ToString('o')

$novoMeta = [ordered]@{
    applicationId           = 'br.com.fsyrp2.app'
    versionName             = $Versao
    versionCode             = $novoVersionCode
    minSdk                  = [int]$metaAtual.minSdk
    targetSdk               = [int]$metaAtual.targetSdk
    compileSdk              = [int]$metaAtual.compileSdk
    apkFileName             = $apkFileName
    sizeBytes               = $sizeBytes
    sha256                  = $sha256Apk
    signingSchemes          = @('v2', 'v3')
    signerCertificateSha256 = $certSha256Esperado.ToLowerInvariant()
    builtAtIso              = $builtAtIso
}
if ($minimaEfetiva -gt 0) {
    $novoMeta['minSupportedVersionCode'] = $minimaEfetiva
}
$novoMeta['releaseNotesPtBr'] = $notasLimpas

$novoMetaJson = $novoMeta | ConvertTo-Json -Depth 5
Set-Content -LiteralPath $metadataFile -Value $novoMetaJson -Encoding UTF8

# 5. Mostrar resumo e pedir confirmação antes de qualquer ação externa
Write-Output ""
Write-Output "=== RESUMO DA PUBLICAÇÃO ANDROID ==="
Write-Output "Versão       : $Versao (versionCode $novoVersionCode)"
Write-Output "APK          : $apkDestino"
Write-Output "Tamanho      : $sizeBytes bytes"
Write-Output "SHA-256      : $sha256Apk"
Write-Output "Certificado  : $certApk"
Write-Output "URL Release  : $downloadUrl"
Write-Output ""

$confirmacao = Read-Host "Digite PUBLICAR para criar a release no GitHub e registrar o commit local"
if ($confirmacao -cne 'PUBLICAR') {
    throw "Publicação cancelada antes do envio externo."
}

$notasMarkdown = ($notasLimpas | ForEach-Object { "- $_" }) -join "`n"
Push-Location $repoRoot
try {
    & gh release create $tagRelease $apkDestino --title "FSY RP2 Android v$Versao" --notes $notasMarkdown
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao criar a release no GitHub."
    }
    & git add 'android/release-metadata.json' 'android/app/build.gradle.kts'
    & git commit -m "chore(android): publicar versão $Versao ($novoVersionCode)"
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao criar o commit local do metadado."
    }
} finally {
    Pop-Location
}
