$url = "https://xsolxbroqqjkoseksmny.supabase.co/functions/v1/whatsapp-webhook"

Write-Host "Enviando mensaje de prueba a: $url"

$body = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            changes = @(
                @{
                    value = @{
                        messages = @(
                            @{
                                from = "5215555555555"
                                type = "text"
                                text = @{ body = "Hola Test Local" }
                            }
                        )
                    }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -Verbose
    Write-Host "RESPUESTA (200 OK):" -ForegroundColor Green
    Write-Host $response
} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Detalle: $($_.Exception.Message)"
}
