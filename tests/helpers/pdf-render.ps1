Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
function AwaitResult($operation, $resultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  $task.Result
}
function AwaitAction($operation) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
  $task = $method.Invoke($null, @($operation))
  $task.Wait()
}
$inputPdf = (Resolve-Path -LiteralPath $args[0]).Path
$outputPng = [IO.Path]::GetFullPath($args[1])
$file = AwaitResult ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inputPdf)) ([Windows.Storage.StorageFile])
$pdf = AwaitResult ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$page = $pdf.GetPage(0)
$stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
AwaitAction ($page.RenderToStreamAsync($stream))
$stream.Seek(0)
$reader = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
$out = [IO.File]::Create($outputPng)
$reader.CopyTo($out)
$out.Dispose()
$reader.Dispose()
$page.Dispose()
