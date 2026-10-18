const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORKSPACE = 'D:\\PC\\Documents\\área de trabalho\\Nexus-Workspace';
const DESKTOP_SRC = path.join(WORKSPACE, 'desktop');
const INSTALLED_DIR = 'C:\\Users\\PC\\AppData\\Local\\Programs\\Xournal++ Desktop';
const BUILD_DIR = path.join(WORKSPACE, 'build-installer');
const STAGING_DIR = path.join(BUILD_DIR, 'staging');
const DIST_DIR = path.join(WORKSPACE, 'dist');
const OUTPUT_EXE_NAME = 'Xournal++ Desktop Setup.exe';

const MAKENSIS = 'C:\\Users\\PC\\AppData\\Local\\electron-builder\\Cache\\nsis-3.0.4.1\\nsis-3.0.4.1-1mx3n\\Bin\\makensis.exe';

console.log('--- Construindo Instalador do Xournal++ Desktop ---');

// 1. Limpa e cria pastas de build
fs.rmSync(BUILD_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Copia os binários do Electron da instalação existente
console.log('Copiando binários do Electron para a staging...');
function copyDir(src, dest, ignoreList = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    if (ignoreList.includes(item)) continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath, ignoreList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(INSTALLED_DIR, STAGING_DIR, [
  'Uninstall Xournal++ Desktop.exe',
  'app.asar.backup',
  'app.asar.old',
  'build-installer',
]);

// 3. Garante que resources/app contenha a versão mais recente do código
const targetAppDir = path.join(STAGING_DIR, 'resources', 'app');
fs.rmSync(targetAppDir, { recursive: true, force: true });
fs.mkdirSync(targetAppDir, { recursive: true });
copyDir(DESKTOP_SRC, targetAppDir, ['node_modules', '.git', 'build-installer.js']);

// Se existir app.asar antigo na staging, remove para usar resources/app atualizado
const stagingAsar = path.join(STAGING_DIR, 'resources', 'app.asar');
if (fs.existsSync(stagingAsar)) {
  fs.rmSync(stagingAsar, { force: true });
}

console.log('Arquivos preparados na staging.');

// 4. Gera o script NSIS (.nsi) usando caminhos relativos ao diretório BUILD_DIR
const nsiScriptPath = path.join(BUILD_DIR, 'installer.nsi');
const finalOutputExe = path.join(DIST_DIR, OUTPUT_EXE_NAME);
const desktopOutputExe = path.join('C:\\Users\\PC\\Desktop', OUTPUT_EXE_NAME);

const nsiContent = `
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Name "Xournal++ Desktop"
OutFile "..\\dist\\${OUTPUT_EXE_NAME}"
InstallDir "$LOCALAPPDATA\\Programs\\Xournal++ Desktop"
RequestExecutionLevel user
SetCompressor /SOLID lzma

; Interface Configuration
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalador do Xournal++ Desktop"
!define MUI_WELCOMEPAGE_TEXT "Este assistente instalará o Xournal++ Desktop com a Biblioteca de Cadernos e sincronização automática com o GitHub no seu computador.\\n\\nClique em Avançar para continuar."

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\\Xournal++ Desktop.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar o Xournal++ Desktop agora"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "English"

Section "Principal" SecMain
  DetailPrint "Instalando arquivos do Xournal++ Desktop..."
  SetOutPath "$INSTDIR"

  ; Extrai todos os arquivos da pasta staging
  File /r "staging\\*.*"

  ; Cria o Desinstalador
  WriteUninstaller "$INSTDIR\\Uninstall Xournal++ Desktop.exe"

  ; Cria atalhos no Menu Iniciar e na Área de Trabalho
  CreateDirectory "$SMPROGRAMS\\Xournal++ Desktop"
  CreateShortcut "$SMPROGRAMS\\Xournal++ Desktop\\Xournal++ Desktop.lnk" "$INSTDIR\\Xournal++ Desktop.exe" "" "$INSTDIR\\Xournal++ Desktop.exe" 0
  CreateShortcut "$SMPROGRAMS\\Xournal++ Desktop\\Desinstalar.lnk" "$INSTDIR\\Uninstall Xournal++ Desktop.exe" "" "$INSTDIR\\Uninstall Xournal++ Desktop.exe" 0
  CreateShortcut "$DESKTOP\\Xournal++ Desktop.lnk" "$INSTDIR\\Xournal++ Desktop.exe" "" "$INSTDIR\\Xournal++ Desktop.exe" 0

  ; Registro do Windows (Painel de Controle -> Programas e Recursos)
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "DisplayName" "Xournal++ Desktop"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "Publisher" "Nexus Workspace"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "DisplayIcon" "$INSTDIR\\Xournal++ Desktop.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "UninstallString" '"$INSTDIR\\Uninstall Xournal++ Desktop.exe"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "QuietUninstallString" '"$INSTDIR\\Uninstall Xournal++ Desktop.exe" /S'
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\Xournal++ Desktop.lnk"
  Delete "$SMPROGRAMS\\Xournal++ Desktop\\Xournal++ Desktop.lnk"
  Delete "$SMPROGRAMS\\Xournal++ Desktop\\Desinstalar.lnk"
  RMDir "$SMPROGRAMS\\Xournal++ Desktop"

  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xournal++ Desktop"
  RMDir /r "$INSTDIR"
SectionEnd
`;

// Salva com UTF-8 BOM para garantir interpretação correta de caracteres acentuados
fs.writeFileSync(nsiScriptPath, '\uFEFF' + nsiContent, 'utf8');
console.log('Script NSIS salvo em:', nsiScriptPath);

// 5. Compila o instalador executando makensis a partir do diretório BUILD_DIR
console.log('Compilando instalador com NSIS...');
execFileSync(MAKENSIS, ['installer.nsi'], {
  cwd: BUILD_DIR,
  encoding: 'utf8',
  stdio: 'inherit',
  windowsHide: true,
});

if (fs.existsSync(finalOutputExe)) {
  const stat = fs.statSync(finalOutputExe);
  console.log('\n=============================================');
  console.log('INSTALADOR GERADO COM SUCESSO!');
  console.log('Local:', finalOutputExe);
  console.log('Tamanho:', (stat.size / (1024 * 1024)).toFixed(2), 'MB');
  console.log('=============================================\n');

  // Copia também para a Área de Trabalho do usuário
  try {
    fs.copyFileSync(finalOutputExe, desktopOutputExe);
    console.log('Cópia disponível na Área de Trabalho:', desktopOutputExe);
  } catch (e) {
    console.warn('Aviso: não foi possível copiar para o Desktop:', e.message);
  }
} else {
  console.error('Erro: o instalador não foi encontrado no destino.');
}
