$ErrorActionPreference = 'Stop'

$bridgeDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeScript = Join-Path $bridgeDirectory 'bridge.py'
$envFile = Join-Path $bridgeDirectory '.env'
$pythonLauncher = (Get-Command 'py.exe' -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $bridgeScript)) {
  throw "Bridge não encontrada: $bridgeScript"
}
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Configure bridge/.env antes de registrar o protocolo.'
}

$registryPath = 'Software\Classes\nexusworkspace'
$protocolRegistration = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registryPath)
$commandRegistration = $protocolRegistration.CreateSubKey('shell\open\command')
$protocolRegistration.SetValue('', 'URL:Nexus Workspace Xournal Bridge', [Microsoft.Win32.RegistryValueKind]::String)
$protocolRegistration.SetValue('URL Protocol', '', [Microsoft.Win32.RegistryValueKind]::String)
$commandRegistration.SetValue('', ('"{0}" "{1}" --once "%1"' -f $pythonLauncher, $bridgeScript), [Microsoft.Win32.RegistryValueKind]::String)
$commandRegistration.Close()
$protocolRegistration.Close()

Write-Output 'Protocolo nexusworkspace:// registrado somente para este usuário do Windows.'
Write-Output 'Ao clicar em “Abrir no Xournal++”, o navegador pedirá para abrir a bridge local.'
