$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'qwen-identity.ps1') -ParserOnly
$cases = @(
  @{ command='llama-server.exe --alias "x --model C:\models\fake.gguf y"'; expected=$null },
  @{ command='llama-server.exe --alias "x -m C:\models\fake.gguf y" --model "C:\real model\main.gguf"'; expected='C:\real model\main.gguf' },
  @{ command='"C:\Program Files\llama-server.exe" -m "C:\my models\real.gguf"'; expected='C:\my models\real.gguf' },
  @{ command='llama-server.exe --model=C:\models\real.gguf'; expected='C:\models\real.gguf' },
  @{ command='llama-server.exe "--model=C:\my models\real.gguf"'; expected='C:\my models\real.gguf' },
  @{ command='llama-server.exe --model "C:\models\real.gguf" --model=C:\other.gguf'; expected=$null },
  @{ command='llama-server.exe -m C:\one.gguf -m C:\two.gguf'; expected=$null },
  @{ command='llama-server.exe --model'; expected=$null },
  @{ command='llama-server.exe --model='; expected=$null },
  @{ command='llama-server.exe --model ""'; expected=$null },
  @{ command='llama-server.exe --model --alias x'; expected=$null },
  @{ command='llama-server.exe --model-path C:\fake.gguf'; expected=$null },
  @{ command='llama-server.exe --alias "quoted \" --model C:\fake.gguf"'; expected=$null },
  @{ command='llama-server.exe --alias "embedded --model=C:\fake.gguf"'; expected=$null },
  @{ command='llama-server.exe --alias "tail \\" -m C:\real.gguf'; expected='C:\real.gguf' }
)
$number=0
foreach($case in $cases) {
  $number++
  $actual=Get-ConfiguredModelPath $case.command
  if($actual -cne $case.expected) { throw "parser regression case $number" }
}
Write-Output "PASS $number Windows argv model parser cases"
