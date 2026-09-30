# 组装单文件 HTML：three.js + 纯几何层 + 应用层
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'src'

$parts = @('01_core.js','02_voxel.js','03_terrain.js','04_buildings.js','05_props.js','06_world.js','07_app.js')
$app = ($parts | ForEach-Object { (Get-Content (Join-Path $src $_) -Raw -Encoding UTF8) }) -join "`n"

# Node 冒烟用（不含 three.js 应用层）
$gen = ($parts[0..5] | ForEach-Object { (Get-Content (Join-Path $src $_) -Raw -Encoding UTF8) }) -join "`n"
$gen += "`nmodule.exports = { buildWorld, buildTerrain, buildTerrainMesh, heightAt, terrainHeight, trailPoints, PAL, PAL_LIST, Solid, placeText, GLYPHS, VOXM, vx };`n"
Set-Content -Path (Join-Path $root 'gen.js') -Value $gen -Encoding UTF8

$three = Get-Content (Join-Path $root 'three.min.js') -Raw -Encoding UTF8
$html  = Get-Content (Join-Path $root 'shell.html') -Raw -Encoding UTF8

# 防止 </script> 提前终止内联脚本
$three = $three -replace '</script>', '<\/script>'
$app   = $app   -replace '</script>', '<\/script>'

$html = $html.Replace('/*__THREE__*/', $three).Replace('/*__APP__*/', $app)

$out = Join-Path (Split-Path -Parent $root) '黄沙边镇.html'
Set-Content -Path $out -Value $html -Encoding UTF8
Write-Output ("已生成: " + $out + "  (" + [math]::Round((Get-Item $out).Length / 1KB) + " KB)")
