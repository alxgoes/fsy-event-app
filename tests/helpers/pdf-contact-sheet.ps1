$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$folder = (Resolve-Path -LiteralPath 'docs/redesign-2026-11/amostras-pdf').Path
$files = @(Get-ChildItem -LiteralPath $folder -Filter '*.pdf' | Sort-Object Name)
$columns = 6
$cellWidth = 200
$cellHeight = 305
$rows = [Math]::Ceiling($files.Count / $columns)
$canvas = New-Object Drawing.Bitmap ($columns * $cellWidth), ($rows * $cellHeight)
$graphics = [Drawing.Graphics]::FromImage($canvas)
$graphics.Clear([Drawing.Color]::White)
$font = New-Object Drawing.Font 'Arial', 7
for ($i = 0; $i -lt $files.Count; $i++) {
  $temporary = Join-Path $folder 'conferencia-temporaria.png'
  & "$PSScriptRoot/pdf-render.ps1" $files[$i].FullName $temporary
  $image = [Drawing.Image]::FromFile($temporary)
  $x = ($i % $columns) * $cellWidth
  $y = [Math]::Floor($i / $columns) * $cellHeight
  $graphics.DrawImage($image, [single]$x, [single]$y, [single]200, [single]283)
  $label = $files[$i].BaseName.Replace('autorizacao-', '')
  $graphics.DrawString($label, $font, [Drawing.Brushes]::Black, [single]($x + 3), [single]($y + 284))
  $image.Dispose()
  Remove-Item -LiteralPath $temporary
}
$canvas.Save((Join-Path $folder 'conferencia-fixture.png'), [Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$canvas.Dispose()
$font.Dispose()
"Conferidas $($files.Count) páginas em série."
