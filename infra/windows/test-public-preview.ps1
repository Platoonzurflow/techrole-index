[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

function Invoke-Utf8Text {
    param([Parameter(Mandatory)][string]$Uri)

    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 30
    return [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
}

function Invoke-Utf8Json {
    param([Parameter(Mandatory)][string]$Uri)

    return (Invoke-Utf8Text -Uri $Uri) | ConvertFrom-Json
}

function Get-ConditionalStatus {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][hashtable]$Headers
    )

    try {
        return [int](Invoke-WebRequest -Uri $Uri -UseBasicParsing -Headers $Headers -TimeoutSec 30).StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

$page = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 30
$canonical = [regex]::Match($page.Content, '<link rel="canonical" href="([^"]+)"').Groups[1].Value
if ($page.StatusCode -ne 200 -or $canonical -ne $BaseUrl) {
    throw "Homepage verification failed: status=$($page.StatusCode), canonical=$canonical"
}
if (-not $page.Headers['Content-Security-Policy'] -or $page.Headers['X-Frame-Options'] -ne 'DENY') {
    throw 'Required browser security headers are missing.'
}

$staticAssetPaths = @([regex]::Matches($page.Content, '(?:src|href)="(/_next/static/[^"]+\.(?:css|js)[^"]*)"') |
    ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
if ($staticAssetPaths.Count -eq 0) {
    throw 'Homepage does not reference any Next static assets.'
}
foreach ($assetPath in $staticAssetPaths) {
    $asset = Invoke-WebRequest -Uri "$BaseUrl$assetPath" -UseBasicParsing -TimeoutSec 30
    if ($asset.StatusCode -ne 200 -or $asset.RawContentLength -lt 100) {
        throw "Static asset verification failed: path=$assetPath, status=$($asset.StatusCode), bytes=$($asset.RawContentLength)"
    }
}

$aiIndex = Invoke-Utf8Json -Uri "$BaseUrl/ai-index.json"
if ($aiIndex.canonical_url -ne $BaseUrl -or $aiIndex.entities.Count -ne 50) {
    throw "AI index verification failed: canonical=$($aiIndex.canonical_url), entities=$($aiIndex.entities.Count)"
}
if ($aiIndex.observed_publication_linkset_url -ne "$BaseUrl/.well-known/linkset.json") {
    throw "AI index Linkset URL is missing or non-canonical: $($aiIndex.observed_publication_linkset_url)"
}

$openData = Invoke-Utf8Json -Uri "$BaseUrl/open-data.json"
if ($openData.url -ne "$BaseUrl/open-data.json" -or $openData.dataset.Count -ne 50) {
    throw "Open-data verification failed: url=$($openData.url), datasets=$($openData.dataset.Count)"
}

$openDataCsv = Invoke-WebRequest -Uri "$BaseUrl/open-data.csv" -UseBasicParsing -TimeoutSec 30
$csvRows = @($openDataCsv.Content -split "`r?`n" | Where-Object { $_ }).Count
if ($openDataCsv.StatusCode -ne 200 -or $openDataCsv.Headers['Content-Type'] -notlike 'text/csv*' -or $csvRows -ne 151) {
    throw "Open-data CSV verification failed: status=$($openDataCsv.StatusCode), rows=$csvRows"
}

$provenance = Invoke-Utf8Json -Uri "$BaseUrl/data-status.json"
$layerIds = @($provenance.layers | ForEach-Object { $_.id })
if (
    $provenance.layers.Count -ne 3 -or
    @($provenance.layers | Where-Object { $_.current_market_claim -ne $false }).Count -ne 0 -or
    @('prepared_analytics', 'official_publications', 'salary_benchmarks' | Where-Object { $layerIds -notcontains $_ }).Count -ne 0
) {
    throw 'Data provenance verification failed.'
}
$officialLayer = $provenance.layers | Where-Object { $_.id -eq 'official_publications' }
$salaryLayer = $provenance.layers | Where-Object { $_.id -eq 'salary_benchmarks' }
if (
    $provenance.schema_version -ne '1.3' -or
    $officialLayer.window_time_basis -ne 'UTC_calendar_days' -or
    $officialLayer.window_start_at -notmatch 'T00:00:00(?:Z|\+00:00)$' -or
    $officialLayer.window_end_at_exclusive -notmatch 'T00:00:00(?:Z|\+00:00)$'
) {
    throw 'UTC calendar-window provenance verification failed.'
}
if (
    $salaryLayer.status -ne 'public_reference' -or
    $salaryLayer.profession_count -ne 50 -or
    $salaryLayer.direct_professions -ne 37 -or
    $salaryLayer.related_professions -ne 13 -or
    $salaryLayer.category_only_professions -ne 0 -or
    ($salaryLayer.direct_professions + $salaryLayer.related_professions + $salaryLayer.category_only_professions) -ne 50 -or
    $salaryLayer.latest_total_sample_size -ne 45226 -or
    @($salaryLayer.source_urls).Count -lt 3
) {
    throw 'Salary benchmark provenance verification failed.'
}
$salaryDatasetResponse = Invoke-WebRequest -Uri "$BaseUrl/salary-benchmarks.json" -UseBasicParsing -TimeoutSec 30
$salaryDataset = ([Text.Encoding]::UTF8.GetString($salaryDatasetResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$salaryCsv = Invoke-WebRequest -Uri "$BaseUrl/salary-benchmarks.csv" -UseBasicParsing -TimeoutSec 30
$salaryPage = Invoke-WebRequest -Uri "$BaseUrl/salary-benchmarks" -UseBasicParsing -TimeoutSec 30
$salaryCsvRows = @($salaryCsv.Content -split "`r?`n" | Where-Object { $_ }).Count
$salaryConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/salary-benchmarks.json" -Headers @{
    'If-None-Match' = $salaryDatasetResponse.Headers['ETag']
}
if (
    $salaryDataset.status -ne 'public_reference' -or
    $salaryDataset.current_market_claim -ne $false -or
    $salaryDataset.profession_count -ne 50 -or
    $salaryDataset.dataset.Count -ne 50 -or
    $salaryDataset.coverage.direct -ne 37 -or
    $salaryDataset.coverage.related -ne 13 -or
    $salaryDataset.coverage.category -ne 0 -or
    $salaryDatasetResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    $salaryConditionalStatus -ne 304 -or
    $salaryCsvRows -le 200 -or
    $salaryPage.StatusCode -ne 200 -or
    $salaryPage.Content -notmatch '/salary-benchmarks\.csv'
) {
    throw 'Salary benchmark dataset verification failed.'
}
if ($officialLayer.classified_publications -gt 0 -and (
    $officialLayer.materialized_slice_count -le 0 -or
    $officialLayer.materialized_publications -le 0 -or
    $officialLayer.materialized_transform_version -ne 'observed-publications-v1'
)) {
    throw 'Observed publication materialization verification failed.'
}
$dailyDataResponse = Invoke-WebRequest -Uri "$BaseUrl/open-data-daily.json" -UseBasicParsing -TimeoutSec 30
$dailyData = ([Text.Encoding]::UTF8.GetString($dailyDataResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$dailyCsv = Invoke-WebRequest -Uri "$BaseUrl/open-data-daily.csv" -UseBasicParsing -TimeoutSec 30
$dailyCsvwResponse = Invoke-WebRequest -Uri "$BaseUrl/open-data-daily.csv-metadata.json" -UseBasicParsing -TimeoutSec 30
$dailyCsvw = ([Text.Encoding]::UTF8.GetString($dailyCsvwResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$dailyPage = Invoke-WebRequest -Uri "$BaseUrl/open-data-daily" -UseBasicParsing -TimeoutSec 30
$dailySchemaResponse = Invoke-WebRequest -Uri "$BaseUrl/open-data-daily.schema.json" -UseBasicParsing -TimeoutSec 30
$dailySchema = ([Text.Encoding]::UTF8.GetString($dailySchemaResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$dailyCroissantResponse = Invoke-WebRequest -Uri "$BaseUrl/open-data-daily.croissant.json" -UseBasicParsing -TimeoutSec 30
$dailyCroissant = ([Text.Encoding]::UTF8.GetString($dailyCroissantResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$dcatResponse = Invoke-WebRequest -Uri "$BaseUrl/catalog.jsonld" -UseBasicParsing -TimeoutSec 30
$dcat = ([Text.Encoding]::UTF8.GetString($dcatResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$linksetResponse = Invoke-WebRequest -Uri "$BaseUrl/.well-known/linkset.json" -UseBasicParsing -TimeoutSec 30
$linkset = ([Text.Encoding]::UTF8.GetString($linksetResponse.RawContentStream.ToArray())) | ConvertFrom-Json
$dailySchemaFields = @($dailySchema.'$defs'.observedPublicationMetric.required)
$dailySchemaFieldKey = (@($dailySchemaFields | Sort-Object) -join '|')
$invalidSchemaRows = @($dailyData.records | Where-Object {
    (@($_.PSObject.Properties.Name | Sort-Object) -join '|') -ne $dailySchemaFieldKey
})
$missingTopLevelFields = @($dailySchema.required | Where-Object {
    $dailyData.PSObject.Properties.Name -notcontains $_
})
$dailyJsonConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/open-data-daily.json" -Headers @{
    'If-None-Match' = $dailyDataResponse.Headers['ETag']
}
$dailyCsvConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/open-data-daily.csv" -Headers @{
    'If-Modified-Since' = $dailyCsv.Headers['Last-Modified']
}
$dailyCsvwConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/open-data-daily.csv-metadata.json" -Headers @{
    'If-None-Match' = $dailyCsvwResponse.Headers['ETag']
}
$dailySchemaConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/open-data-daily.schema.json" -Headers @{
    'If-None-Match' = "W/$($dailySchemaResponse.Headers['ETag'])"
}
$dailyCroissantConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/open-data-daily.croissant.json" -Headers @{
    'If-None-Match' = $dailyCroissantResponse.Headers['ETag']
}
$dcatConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/catalog.jsonld" -Headers @{
    'If-None-Match' = $dcatResponse.Headers['ETag']
}
$linksetConditionalStatus = Get-ConditionalStatus -Uri "$BaseUrl/.well-known/linkset.json" -Headers @{
    'If-None-Match' = $linksetResponse.Headers['ETag']
}
$dailyCsvRows = @($dailyCsv.Content -split "`r?`n" | Where-Object { $_ }).Count
$dailyPageCanonical = [regex]::Match($dailyPage.Content, '<link rel="canonical" href="([^"]+)"').Groups[1].Value
if (
    $dailyData.row_count -ne $officialLayer.materialized_slice_count -or
    $dailyData.publication_count -ne $officialLayer.materialized_publications -or
    $dailyData.records.Count -ne $dailyData.row_count -or
    @($dailyData.records | Where-Object { $_.current_market_claim -ne $false }).Count -ne 0 -or
    $dailyData.schema_url -ne "$BaseUrl/open-data-daily.schema.json" -or
    $dailyDataResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    -not $dailyDataResponse.Headers['Last-Modified'] -or
    $dailyDataResponse.Headers['Access-Control-Expose-Headers'] -notmatch 'ETag' -or
    $dailyJsonConditionalStatus -ne 304 -or
    $dailyCsvConditionalStatus -ne 304 -or
    $dailyCsvRows -ne ($dailyData.row_count + 1)
) {
    throw 'Observed publication daily export verification failed.'
}
$csvwColumns = @($dailyCsvw.tableSchema.columns)
$csvwColumnNames = @($csvwColumns | ForEach-Object { $_.name }) -join '|'
$dailyCsvHeader = (($dailyCsv.Content -split "`r?`n")[0]).TrimStart([char]0xFEFF)
$dailyCsvHeaderKey = @($dailyCsvHeader -split ',') -join '|'
if (
    $dailyCsvwResponse.Headers['Content-Type'] -notlike 'application/csvm+json*' -or
    $dailyCsvw.'@context'[0] -ne 'http://www.w3.org/ns/csvw' -or
    $dailyCsvw.url -ne "$BaseUrl/open-data-daily.csv" -or
    $csvwColumns.Count -ne 30 -or
    $csvwColumnNames -ne $dailyCsvHeaderKey -or
    @($dailyCsvw.tableSchema.primaryKey).Count -ne 7 -or
    $dailyCsvwResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    $dailyCsvwConditionalStatus -ne 304 -or
    $dailyCsv.Headers['Link'] -notmatch 'application/csvm\+json'
) {
    throw "Observed publication CSVW verification failed: columns=$($csvwColumns.Count), conditional=$dailyCsvwConditionalStatus"
}
if (
    $dailySchemaResponse.Headers['Content-Type'] -notlike 'application/schema+json*' -or
    $dailySchema.'$schema' -ne 'https://json-schema.org/draft/2020-12/schema' -or
    $dailySchema.'$id' -ne "$BaseUrl/open-data-daily.schema.json" -or
    $dailySchemaFields.Count -ne 27 -or
    $dailySchema.'$defs'.observedPublicationMetric.additionalProperties -ne $false -or
    $dailySchemaResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    $dailySchemaConditionalStatus -ne 304 -or
    $invalidSchemaRows.Count -ne 0 -or
    $missingTopLevelFields.Count -ne 0
) {
    throw "Observed publication JSON Schema verification failed: fields=$($dailySchemaFields.Count), invalid_rows=$($invalidSchemaRows.Count), missing_top_level=$($missingTopLevelFields.Count)"
}
$croissantFields = @($dailyCroissant.recordSet[0].field)
$croissantFieldNames = @($croissantFields | ForEach-Object { $_.name }) -join '|'
if (
    $dailyCroissantResponse.Headers['Content-Type'] -notmatch 'application/ld\+json.*profile="?http://mlcommons.org/croissant/1.1' -or
    $dailyCroissant.'dct:conformsTo' -ne 'http://mlcommons.org/croissant/1.1' -or
    $dailyCroissant.isLiveDataset -ne $true -or
    $dailyCroissant.license -notmatch '/opendata/uslovia-od$' -or
    $dailyCroissant.distribution[0].contentSize -notmatch '^\d+ B$' -or
    $croissantFields.Count -ne 30 -or
    $croissantFieldNames -ne $dailyCsvHeaderKey -or
    $dailyCroissantResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    $dailyCroissantConditionalStatus -ne 304
) {
    throw "Observed publication Croissant verification failed: fields=$($croissantFields.Count), conditional=$dailyCroissantConditionalStatus"
}
$dcatDistributions = @($dcat.'dcat:dataset'.'dcat:distribution')
if (
    $dcatResponse.Headers['Content-Type'] -notlike 'application/ld+json*' -or
    $dcat.'@type' -ne 'dcat:Catalog' -or
    $dcat.'dcat:dataset'.'@type' -ne 'dcat:Dataset' -or
    $dcat.'dcat:service'.'@type' -ne 'dcat:DataService' -or
    $dcat.'dcat:dataset'.'dct:source'.'@id' -ne 'https://trudvsem.ru/opendata/api' -or
    $dcatDistributions.Count -ne 2 -or
    @($dcatDistributions | Where-Object { $_.'dcat:downloadURL'.'@id' -eq "$BaseUrl/open-data-daily.csv" }).Count -ne 1 -or
    $dcatResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    $dcatConditionalStatus -ne 304
) {
    throw "DCAT 3 catalog verification failed: distributions=$($dcatDistributions.Count), conditional=$dcatConditionalStatus"
}
if (
    $dailyPage.StatusCode -ne 200 -or
    $dailyPageCanonical -ne "$BaseUrl/open-data-daily" -or
    $dailyPage.Headers['Link'] -notmatch 'rel="linkset"; type="application/linkset\+json"' -or
    $dailyPage.Content -notmatch '"@type":"Dataset"' -or
    $dailyPage.Content -notmatch '/open-data-daily\.json' -or
    $dailyPage.Content -notmatch '/open-data-daily\.csv' -or
    $dailyPage.Content -notmatch '/open-data-daily\.schema\.json' -or
    $dailyPage.Content -notmatch '/open-data-daily\.croissant\.json' -or
    $dailyPage.Content -notmatch '"@type":"sc:Dataset"'
) {
    throw "Observed publication dataset landing verification failed: status=$($dailyPage.StatusCode), canonical=$dailyPageCanonical"
}

$linkContexts = @($linkset.linkset)
$landingLinkContext = $linkContexts | Where-Object { $_.anchor -eq "$BaseUrl/open-data-daily" }
$salaryLinkContext = $linkContexts | Where-Object { $_.anchor -eq "$BaseUrl/salary-benchmarks" }
if (
    $linksetResponse.Headers['Content-Type'] -notlike 'application/linkset+json*' -or
    $linksetResponse.Headers['ETag'] -notmatch '^"sha256-[a-f0-9]{64}"$' -or
    $linksetConditionalStatus -ne 304 -or
    $linkContexts.Count -ne 7 -or
    @($landingLinkContext.'cite-as' | Where-Object { $_.href -eq "$BaseUrl/open-data-daily" }).Count -ne 1 -or
    @($landingLinkContext.item | Where-Object { $_.href -in @("$BaseUrl/open-data-daily.json", "$BaseUrl/open-data-daily.csv") }).Count -ne 2 -or
    @($landingLinkContext.describedby | Where-Object { $_.href -eq "$BaseUrl/open-data-daily.croissant.json" }).Count -ne 1 -or
    @($salaryLinkContext.item | Where-Object { $_.href -in @("$BaseUrl/salary-benchmarks.json", "$BaseUrl/salary-benchmarks.csv") }).Count -ne 2
) {
    throw "RFC 9264 Linkset verification failed: contexts=$($linkContexts.Count), conditional=$linksetConditionalStatus"
}

$citation = Invoke-Utf8Json -Uri "$BaseUrl/citation.json"
if ($citation.type -ne 'dataset' -or $citation.URL -ne "$BaseUrl/open-data.json") {
    throw "Citation metadata verification failed: type=$($citation.type), URL=$($citation.URL)"
}

$research = Invoke-Utf8Json -Uri "$BaseUrl/research.json"
if ($research.type -ne 'Report' -or $research.canonical_url -ne "$BaseUrl/research" -or $research.summary.total_publications -le 0) {
    throw 'Research report verification failed.'
}
if ($research.summary.total_publications -ne $officialLayer.classified_publications) {
    throw "Rolling-window mismatch: research=$($research.summary.total_publications), provenance=$($officialLayer.classified_publications)"
}

$insights = Invoke-Utf8Json -Uri "$BaseUrl/insights.json"
if ($insights.articles.Count -ne 12 -or @($insights.articles | Where-Object { $_.canonical_url -notlike "$BaseUrl/insights/*" }).Count -ne 0) {
    throw 'Editorial insights verification failed.'
}
$articlePages = 0
$articleCitations = 0
foreach ($article in $insights.articles) {
    $articlePage = Invoke-WebRequest -Uri $article.canonical_url -UseBasicParsing -TimeoutSec 30
    $articleCanonical = [regex]::Match($articlePage.Content, '<link rel="canonical" href="([^"]+)"').Groups[1].Value
    if ($articlePage.StatusCode -ne 200 -or $articleCanonical -ne $article.canonical_url -or $articlePage.Content -notmatch 'TechArticle') {
        throw "Editorial article verification failed: url=$($article.canonical_url), status=$($articlePage.StatusCode), canonical=$articleCanonical"
    }
    $articlePages += 1
    $articleCitation = Invoke-Utf8Json -Uri "$($article.canonical_url)/cite/csl-json"
    if ($articleCitation.type -ne 'webpage' -or $articleCitation.title -ne $article.title -or $articleCitation.URL -ne $article.canonical_url) {
        throw "Editorial citation verification failed: url=$($article.canonical_url)"
    }
    $articleCitations += 1
}
$sampleArticle = $insights.articles[0]
$sampleBib = Invoke-Utf8Text -Uri "$($sampleArticle.canonical_url)/cite/bibtex"
$sampleRis = Invoke-Utf8Text -Uri "$($sampleArticle.canonical_url)/cite/ris"
if ($sampleBib -notmatch '@online\{techrole_index_' -or $sampleRis -notmatch '(?m)^TY  - ELEC\r?$') {
    throw 'Editorial BibTeX/RIS verification failed.'
}

$socialImage = Invoke-WebRequest -Uri "$BaseUrl/opengraph-image" -UseBasicParsing -TimeoutSec 30
if ($socialImage.StatusCode -ne 200 -or $socialImage.Headers['Content-Type'] -notlike 'image/png*' -or $socialImage.RawContentLength -lt 10000) {
    throw 'Open Graph image verification failed.'
}

$llms = Invoke-WebRequest -Uri "$BaseUrl/llms-full.txt" -UseBasicParsing -TimeoutSec 30
$professionHeadings = [regex]::Matches($llms.Content, '(?m)^### ').Count
if ($professionHeadings -ne 50) {
    throw "LLM context verification failed: profession headings=$professionHeadings"
}

$sitemap = Invoke-WebRequest -Uri "$BaseUrl/sitemap.xml" -UseBasicParsing -TimeoutSec 30
$sitemapUrls = [regex]::Matches($sitemap.Content, '<url>').Count
$hostReferences = [regex]::Matches($sitemap.Content, [regex]::Escape($BaseUrl)).Count
if ($sitemapUrls -lt 60 -or $hostReferences -ne $sitemapUrls) {
    throw "Sitemap verification failed: urls=$sitemapUrls, canonical host references=$hostReferences"
}

$ready = Invoke-WebRequest -Uri "$BaseUrl/api/v1/health/ready" -UseBasicParsing -TimeoutSec 30
if ($ready.StatusCode -ne 200) {
    throw "Backend readiness failed: status=$($ready.StatusCode)"
}

[pscustomobject]@{
    url = $BaseUrl
    homepage_status = $page.StatusCode
    static_assets = $staticAssetPaths.Count
    ai_entities = $aiIndex.entities.Count
    open_datasets = $openData.dataset.Count
    open_csv_rows = $csvRows
    provenance_layers = $provenance.layers.Count
    salary_dataset_professions = $salaryDataset.profession_count
    salary_csv_rows = $salaryCsvRows
    salary_json_conditional_status = $salaryConditionalStatus
    materialized_slices = $officialLayer.materialized_slice_count
    materialized_publications = $officialLayer.materialized_publications
    daily_json_rows = $dailyData.row_count
    daily_csv_rows = $dailyCsvRows
    daily_schema_fields = $dailySchemaFields.Count
    daily_json_conditional_status = $dailyJsonConditionalStatus
    daily_csv_conditional_status = $dailyCsvConditionalStatus
    daily_csvw_columns = $csvwColumns.Count
    daily_csvw_conditional_status = $dailyCsvwConditionalStatus
    daily_schema_conditional_status = $dailySchemaConditionalStatus
    daily_croissant_fields = $croissantFields.Count
    daily_croissant_conditional_status = $dailyCroissantConditionalStatus
    dcat_distributions = $dcatDistributions.Count
    dcat_conditional_status = $dcatConditionalStatus
    daily_landing_status = $dailyPage.StatusCode
    linkset_contexts = $linkContexts.Count
    linkset_conditional_status = $linksetConditionalStatus
    citation_type = $citation.type
    research_publications = $research.summary.total_publications
    rolling_provenance_publications = $officialLayer.classified_publications
    editorial_insights = $insights.articles.Count
    editorial_article_pages = $articlePages
    editorial_citations = $articleCitations
    llms_professions = $professionHeadings
    sitemap_urls = $sitemapUrls
    social_image_bytes = $socialImage.RawContentLength
    api_ready = $ready.StatusCode
}
