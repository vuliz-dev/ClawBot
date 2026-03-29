Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d C:\Users\PC\clawbot && node_modules\.bin\tsx.cmd src/index.ts >> data\clawbot.log 2>&1", 0, False
