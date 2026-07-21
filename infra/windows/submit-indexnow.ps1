[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$BaseUrl,
    [string]$Key = $env:INDEXNOW_KEY
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$site = [Uri]$BaseUrl
if ($site.Host -in @('localhost', '127.0.0.1') -or $site.Host -match '[.](lhr[.]life|trycloudflare[.]com)$') {
    throw 'IndexNow requires a stable canonical public host; temporary preview hosts are rejected.'
}
if ($Key -notmatch '^[A-Za-z0-9-]{8,128}$') {
    throw 'INDEXNOW_KEY must contain 8-128 letters, numbers, or dashes.'
}

$keyLocation = "$BaseUrl/indexnow-key.txt"
$publishedKey = (Invoke-WebRequest -Uri $keyLocation -UseBasicParsing -TimeoutSec 30).Content.Trim()
if ($publishedKey -ne $Key) {
    throw 'The public IndexNow key file does not match INDEXNOW_KEY.'
}

[xml]$sitemap = (Invoke-WebRequest -Uri "$BaseUrl/sitemap.xml" -UseBasicParsing -TimeoutSec 30).Content
$urls = @($sitemap.urlset.url.loc | ForEach-Object { [string]$_ } | Where-Object {
    ([Uri]$_).Host -eq $site.Host
} | Select-Object -Unique)
if (-not $urls -or $urls.Count -gt 10000) {
    throw "Unexpected sitemap URL count: $($urls.Count)"
}

$payload = @{
    host = $site.Host
    key = $Key
    keyLocation = $keyLocation
    urlList = $urls
} | ConvertTo-Json -Depth 4

$response = Invoke-WebRequest -Uri 'https://api.indexnow.org/indexnow' -Method Post `
    -ContentType 'application/json; charset=utf-8' -Body $payload -UseBasicParsing -TimeoutSec 60
if ($response.StatusCode -notin @(200, 202)) {
    throw "IndexNow returned HTTP $($response.StatusCode)"
}

[pscustomobject]@{
    host = $site.Host
    submitted_urls = $urls.Count
    status = $response.StatusCode
    key_location = $keyLocation
}
