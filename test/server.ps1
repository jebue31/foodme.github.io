# Local preview with a fake in-browser backend: swaps the Supabase client and config for test doubles.
param([int]$Port = 8123)
$root = Split-Path -Parent $PSScriptRoot
$swap = @{ '/vendor/supabase.js' = '/test/fake-supabase.js'; '/config.js' = '/test/config.js' }
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.ts'='text/javascript; charset=utf-8'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png' }
$l = [System.Net.HttpListener]::new(); $l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
Write-Host "http://localhost:$Port/"
while ($l.IsListening) {
  $c = $l.GetContext()
  $path = $c.Request.Url.AbsolutePath
  if ($path -eq '/') { $path = '/index.html' }
  if ($swap.ContainsKey($path)) { $path = $swap[$path] }
  $file = [IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
  if ($file.StartsWith($root) -and [IO.File]::Exists($file)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $c.Response.ContentType = $types[[IO.Path]::GetExtension($file)]
    $c.Response.Headers.Add('Cache-Control', 'no-store')
    $c.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
