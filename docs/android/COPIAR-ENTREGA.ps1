param(
    [string]$Destino = 'D:/Projects/PC/FSY/_trabalho'
)

$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$origem = Join-Path $repo 'docs/android/entrega/capturas'
$relatorio = Join-Path $repo 'docs/android/RELATORIO-ANDROID.md'
if (!(Test-Path -LiteralPath $relatorio) -or !(Test-Path -LiteralPath $origem)) {
    throw 'O relatório e o pacote de capturas precisam estar prontos antes da cópia.'
}

# Executar pelo responsável quando a pasta externa estiver liberada para escrita.
# A cópia preserva arquivos anteriores; não exclui nem move diretórios.
$capturas = Join-Path $Destino 'capturas/android-depois'
$auditorias = Join-Path $Destino 'auditorias'
New-Item -ItemType Directory -Path $capturas, $auditorias -Force | Out-Null
Copy-Item -LiteralPath $relatorio -Destination (Join-Path $auditorias 'RELATORIO-ANDROID.md') -Force
Get-ChildItem -LiteralPath $origem -File -Recurse -Filter '*.png' | ForEach-Object {
    $relativo = $_.FullName.Substring($origem.Length).TrimStart('\', '/')
    $alvo = Join-Path $capturas $relativo
    New-Item -ItemType Directory -Path (Split-Path -Parent $alvo) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $alvo -Force
}
Write-Output "Relatório e capturas copiados para $Destino"
