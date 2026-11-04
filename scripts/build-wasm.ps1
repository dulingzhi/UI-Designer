# WASM 前端内核（浏览器路径 A）构建脚本
#
# 背景：正式构建链是 `wasm-pack build --target web`，但本机 wasm-pack 0.14
# 在 "Installing wasm-bindgen..." 步骤会卡住（该版本会重新 cargo install
# wasm-bindgen CLI，联网/编译挂起）。因此改为「cargo build + 直接调 wasm-bindgen +
# wasm-opt」三步，产物与 wasm-pack 完全等价，且可复现。
#
# 用法（在仓库根目录）：
#   pwsh -File scripts/build-wasm.ps1
#
# 前置：rustup target add wasm32-unknown-unknown；MSVC 工具链（vcvars64.bat）。
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$wasmDir = Join-Path $root 'wasm'
$outDir = Join-Path $root 'public/wasm-pkg'

# 1) 定位工具链（wasm-bindgen / wasm-opt 由 wasm-pack 预置在本地目录）
$wasmBindgen = Get-ChildItem "$env:LOCALAPPDATA\.wasm-pack" -Recurse -Filter wasm-bindgen.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match 'wasm-bindgen-cargo-install' } |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $wasmBindgen) {
    $wasmBindgen = Get-ChildItem "$env:LOCALAPPDATA\.wasm-pack" -Recurse -Filter wasm-bindgen.exe -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}
$wasmOpt = Get-ChildItem "$env:LOCALAPPDATA\.wasm-pack" -Recurse -Filter wasm-opt.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $wasmBindgen) { throw 'wasm-bindgen CLI 未找到；请先运行一次 wasm-pack build 让它安装 CLI' }

# 2) MSVC 环境（cargo 链接原生测试/示例时需要；wasm32 目标本身不依赖）
$vcvars = Get-ChildItem 'C:\Program Files\Microsoft Visual Studio' -Recurse -Filter vcvars64.bat -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName

Write-Host "[build-wasm] cargo build --release --target wasm32-unknown-unknown"
Push-Location $wasmDir
try {
    if ($vcvars) {
        & cmd /c "call `"$vcvars`" >nul 2>&1 && cargo build --release --target wasm32-unknown-unknown 2>&1"
    } else {
        & cargo build --release --target wasm32-unknown-unknown 2>&1
    }
    if ($LASTEXITCODE -ne 0) { throw "cargo build 失败（exit $LASTEXITCODE）" }

    Write-Host "[build-wasm] wasm-bindgen --target web"
    & $wasmBindgen --target web --out-dir $outDir --out-name wc3ui_wasm --no-typescript `
        'target/wasm32-unknown-unknown/release/wc3ui_wasm.wasm'
    if ($LASTEXITCODE -ne 0) { throw "wasm-bindgen 失败（exit $LASTEXITCODE）" }

    if ($wasmOpt) {
        Write-Host "[build-wasm] wasm-opt -Os"
        $bin = Join-Path $outDir 'wc3ui_wasm_bg.wasm'
        & $wasmOpt -Os $bin -o "$bin.opt"
        if ($LASTEXITCODE -eq 0 -and (Test-Path "$bin.opt")) { Move-Item -Force "$bin.opt" $bin }
    }
} finally {
    Pop-Location
}

$size = (Get-Item (Join-Path $outDir 'wc3ui_wasm_bg.wasm')).Length
Write-Host ("[build-wasm] 完成 → public/wasm-pkg（{0:N0} 字节）" -f $size)
