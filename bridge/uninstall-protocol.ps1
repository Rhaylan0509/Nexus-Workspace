$ErrorActionPreference = 'Stop'
$protocolKey = 'HKCU:\Software\Classes\nexusworkspace'
if (Test-Path -LiteralPath $protocolKey) {
  Remove-Item -LiteralPath $protocolKey -Recurse -Force
}
Write-Output 'Protocolo nexusworkspace:// removido deste usuário do Windows.'
