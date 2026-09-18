#define AppName "RRHH-Simple"
#define AppVersion "1.0.0"
#define AppPublisher "Psinza"
#define AppExeName "start-rrhh.cmd"

[Setup]
AppId={{B4B9C77A-1D3D-4F4C-9E08-9A0A8F5E6C91}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\RRHH-Simple
DefaultGroupName={#AppName}
OutputDir=output
OutputBaseFilename=RRHH-Simple-Setup
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git\*;node_modules\*;dist\*;server\.env"

[Icons]
Name: "{group}\RRHH-Simple"; Filename: "{app}\windows\start-rrhh.cmd"; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\windows\install.ps1"" -InstallDir ""{app}"""; Flags: postinstall waituntilterminated
