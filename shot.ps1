param(
  [string]$Query = 'hour=12',
  [string]$Out = 'shot.png',
  [int]$W = 1400,
  [int]$H = 800,
  [int]$Budget = 12000
)
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$shots = Join-Path $root 'shots'
New-Item -ItemType Directory -Force -Path $shots | Out-Null
$uri = 'file:///' + ((Split-Path -Parent $root) -replace '\\','/') + '/黄沙边镇.html?' + $Query
$png = Join-Path $shots $Out
if (Test-Path $png) { Remove-Item $png }
$udd = Join-Path $env:TEMP ('dshshot_' + [guid]::NewGuid().ToString('N').Substring(0,10))
# 参数用数组传递，避免 PowerShell 逗号展开把窗口尺寸拆成两个参数
$argList = @(
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  "--user-data-dir=$udd", '--no-first-run', '--no-default-browser-check',
  '--force-device-scale-factor=1', "--window-size=$W,$H",
  "--virtual-time-budget=$Budget", "--screenshot=$png", $uri
)
$outText = & $chrome @argList 2>&1 | Out-String
Start-Sleep -Milliseconds 200
Remove-Item -Recurse -Force $udd -ErrorAction SilentlyContinue
if (Test-Path $png) {
  Write-Output ("OK " + $Out + " " + [math]::Round((Get-Item $png).Length/1KB) + "KB  URI=" + $uri.Substring($uri.IndexOf('?')))
} else {
  Write-Output ("FAIL " + $Out + " :: " + $outText.Substring(0, [Math]::Min(400, $outText.Length)))
}
