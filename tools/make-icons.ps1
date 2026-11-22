# Génère les icônes de l'appli (logo : 3 barres montantes = progression, sur fond graphite).
# Usage : powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($r -le 0) { $p.AddRectangle((New-Object System.Drawing.RectangleF $x, $y, $w, $h)); return $p }
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# $size : taille finale ; $corner : arrondi du fond (0 = carré, pour iOS / maskable) ; $scale : taille du logo dans le fond
function New-Icon([int]$size, [string]$file, [float]$corner, [float]$scale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 512.0

  # Fond : dégradé graphite
  $bg = New-RoundRect 0 0 $size $size ($corner * $s)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, 0), (New-Object System.Drawing.PointF $size, $size), ([System.Drawing.Color]::FromArgb(255, 44, 44, 50)), ([System.Drawing.Color]::FromArgb(255, 10, 10, 12))
  $g.FillPath($grad, $bg)
  # Léger reflet en haut
  $hl = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, -1), (New-Object System.Drawing.PointF 0, ($size + 1)), ([System.Drawing.Color]::FromArgb(34, 255, 255, 255)), ([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
  $blend = New-Object System.Drawing.Drawing2D.Blend 3
  $blend.Factors = [single[]]@(0, 1, 1); $blend.Positions = [single[]]@(0, 0.55, 1)
  $hl.Blend = $blend
  $g.FillPath($hl, $bg)

  # Logo : 3 barres arrondies montantes, centrées
  $c = $size / 2.0
  $bw = 62 * $s * $scale; $gap = 26 * $s * $scale
  $hs = @(118, 188, 262) | ForEach-Object { $_ * $s * $scale }
  $alpha = @(140, 200, 255)
  $total = 3 * $bw + 2 * $gap
  $x0 = $c - $total / 2; $base = $c + ($hs[2] / 2)
  for ($i = 0; $i -lt 3; $i++) {
    $x = $x0 + $i * ($bw + $gap); $h = $hs[$i]
    $p = New-RoundRect $x ($base - $h) $bw $h ($bw / 2)
    $b = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha[$i], 255, 255, 255))
    $g.FillPath($b, $p)
  }
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 512 'icon-512.png' 112 1.0           # icône standard (coins arrondis)
New-Icon 192 'icon-192.png' 112 1.0
New-Icon 512 'icon-maskable-512.png' 0 0.82   # Android adaptatif : fond plein, logo dans la zone sûre
New-Icon 180 'apple-touch-icon.png' 0 0.9     # iPhone : iOS arrondit lui-même
New-Icon 32 'favicon-32.png' 96 1.1
Get-ChildItem $out | Select-Object Name, Length
