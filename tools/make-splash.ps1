# Images de démarrage iOS (apple-touch-startup-image) : fond uni #0c0c0f, identique à l'écran de chargement
# animé, pour éviter l'écran blanc d'iOS au lancement depuis l'icône.
# Usage : powershell -ExecutionPolicy Bypass -File tools\make-splash.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'icons\splash'
New-Item -ItemType Directory -Force $out | Out-Null
# largeur x hauteur en pixels réels (portrait)
$sizes = @('1320x2868', '1290x2796', '1284x2778', '1242x2688', '1242x2208', '1206x2622', '1179x2556', '1170x2532', '1125x2436', '1080x2340', '828x1792', '750x1334', '640x1136')
foreach ($s in $sizes) {
  $w, $h = $s -split 'x' | ForEach-Object { [int]$_ }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 12, 12, 15))
  $bmp.Save((Join-Path $out "splash-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Get-ChildItem $out | Measure-Object Length -Sum | Select-Object Count, Sum
