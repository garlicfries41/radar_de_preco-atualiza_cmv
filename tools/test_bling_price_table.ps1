# ============================================================
# Radar de Preço - Teste de Endpoints Bling API v3
# Objetivo: Verificar se a API do Bling retorna preços da
#           Tabela "Revenda" (ID 232241)
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BlingToken,
    
    # ID de um produto qualquer que exista na tabela Revenda
    [string]$ProdutoIdTeste = ""
)

$BaseUrl = "https://api.bling.com.br/Api/v3"
$TabelaRevendaId = 232241

$Headers = @{
    "Authorization" = "Bearer $BlingToken"
    "Accept"        = "application/json"
}

function Invoke-BlingApi {
    param([string]$Endpoint, [string]$Descricao)
    
    $Url = "$BaseUrl/$Endpoint"
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "TESTANDO: $Descricao" -ForegroundColor Cyan
    Write-Host "URL: $Url" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Cyan
    
    try {
        $Response = Invoke-RestMethod -Uri $Url -Headers $Headers -Method GET
        Write-Host "✅ SUCESSO!" -ForegroundColor Green
        $Response | ConvertTo-Json -Depth 5
        return $Response
    }
    catch {
        $StatusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ ERRO $StatusCode`: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "Detalhes: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
        return $null
    }
}

# ============================================================
# TESTE 1: Listar todas as Listas de Preço
# Verifica se o endpoint existe e se retorna nossa tabela
# ============================================================
Write-Host "`n🔎 FASE 1: Explorando Listas de Preço" -ForegroundColor Magenta

$r1 = Invoke-BlingApi -Endpoint "listasDePrecos" -Descricao "GET /listasDePrecos"

# Tentativas alternativas de nomenclatura do endpoint
if (-not $r1) {
    Invoke-BlingApi -Endpoint "listas-de-precos" -Descricao "GET /listas-de-precos"
    Invoke-BlingApi -Endpoint "tabelasDePrecos" -Descricao "GET /tabelasDePrecos (alternativo)"
}

# ============================================================
# TESTE 2: Detalhes da Lista de Preço Revenda (ID 232241)
# ============================================================
Write-Host "`n🔎 FASE 2: Detalhes da Tabela Revenda (ID $TabelaRevendaId)" -ForegroundColor Magenta

Invoke-BlingApi `
    -Endpoint "listasDePrecos/$TabelaRevendaId" `
    -Descricao "GET /listasDePrecos/232241"

# ============================================================
# TESTE 3: Produtos dentro da Lista de Preço Revenda
# ============================================================
Write-Host "`n🔎 FASE 3: Produtos na Tabela Revenda" -ForegroundColor Magenta

Invoke-BlingApi `
    -Endpoint "listasDePrecos/$TabelaRevendaId/produtos" `
    -Descricao "GET /listasDePrecos/232241/produtos"

Invoke-BlingApi `
    -Endpoint "listasDePrecos/$TabelaRevendaId/produtos?pagina=1&limite=10" `
    -Descricao "GET /listasDePrecos/232241/produtos (paginado)"

# ============================================================
# TESTE 4: Buscar produto específico com seus preços
# (se o usuário forneceu um ID de produto)
# ============================================================
if ($ProdutoIdTeste -ne "") {
    Write-Host "`n🔎 FASE 4: Produto Específico (ID $ProdutoIdTeste)" -ForegroundColor Magenta
    
    $prod = Invoke-BlingApi `
        -Endpoint "produtos/$ProdutoIdTeste" `
        -Descricao "GET /produtos/$ProdutoIdTeste (preco padrao)"
    
    # Ver campos de preco no retorno
    if ($prod -and $prod.data) {
        Write-Host "`n--- Campos de PREÇO encontrados no produto ---" -ForegroundColor Yellow
        $prod.data | Get-Member -MemberType NoteProperty | 
            Where-Object { $_.Name -like "*prec*" -or $_.Name -like "*valor*" -or $_.Name -like "*price*" } |
            ForEach-Object {
                Write-Host "$($_.Name): $($prod.data.$($_.Name))" -ForegroundColor White
            }
    }
    
    # Tentar buscar produto dentro de uma lista de preços
    Invoke-BlingApi `
        -Endpoint "listasDePrecos/$TabelaRevendaId/produtos/$ProdutoIdTeste" `
        -Descricao "GET /listasDePrecos/232241/produtos/$ProdutoIdTeste"
}

# ============================================================
# TESTE 5: Verificar lojas/canais
# ============================================================
Write-Host "`n🔎 FASE 5: Canais de Venda / Lojas" -ForegroundColor Magenta

Invoke-BlingApi -Endpoint "canaisDeVenda" -Descricao "GET /canaisDeVenda"
Invoke-BlingApi -Endpoint "lojas" -Descricao "GET /lojas"

# ============================================================
# TESTE 6: Busca de produto com filtro de loja
# ============================================================
Write-Host "`n🔎 FASE 6: Produto filtrado por loja" -ForegroundColor Magenta

Invoke-BlingApi `
    -Endpoint "produtos/lojas?pagina=1&limite=5" `
    -Descricao "GET /produtos/lojas"

Write-Host "`n`n✅ TESTES CONCLUÍDOS!" -ForegroundColor Green
Write-Host "Analise os resultados acima para ver quais endpoints funcionam e quais campos retornam preços de revenda." -ForegroundColor White
