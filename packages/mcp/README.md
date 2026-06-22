# @churnify/mcp

Churnify'ın **MCP (Model Context Protocol) server'ı** — Claude / ChatGPT gibi AI
istemcilerinin organizasyonun net kâr verisine **salt-okunur** erişmesini sağlar.

- **Transport:** Streamable HTTP (stateless), uç: `POST {API_URL}/api/mcp`
- **Yetki:** per-org **API key** (`Authorization: Bearer chk_…`) — JWT değil.
- Bu paket çerçeveden bağımsızdır: tool kataloğu + `McpDataProvider` sözleşmesi +
  server kurulumu (`buildMcpServer` / `handleMcpRequest`). Somut veri sağlayıcı
  `apps/api` içinde analytics servisleriyle bağlanır → tool sonuçları REST ile birebir.

## API key oluşturma

Web uygulamasında **Ayarlar → API Anahtarları** (owner/admin). Bir ad ver, kapsamları
seç; ham anahtar (`chk_…`) **yalnız bir kez** gösterilir. İptal de aynı ekrandan.

## Kapsamlar (scopes)

Her tool bir kapsam gerektirir; anahtarda olmayan kapsamın tool'ları listelenmez.

| Kapsam | Açtığı tool'lar |
|---|---|
| `stores:read` | `list_stores` |
| `profit:read` | `get_profit_summary`, `get_pnl`, `compare_periods` |
| `products:read` | `top_products_by_profit` |
| `ads:read` | `get_ad_performance` |

## Tool seti (read-only)

| Tool | Argümanlar | Döner |
|---|---|---|
| `list_stores` | — | Org'un mağazaları (id, ad, para birimi, kanal) |
| `get_profit_summary` | `from, to, storeIds?, compare?` | Ciro/net kâr/marj/ROAS/POAS toplamları |
| `get_pnl` | `from, to, storeIds?` | Gelir tablosu satırları (ciroya oran %) |
| `top_products_by_profit` | `from, to, storeIds?, limit?` | Net kâra göre ürün sıralaması |
| `get_ad_performance` | `from, to, storeIds?, level?` | Reklam harcaması, ROAS/POAS, kırılım |
| `compare_periods` | `aFrom, aTo, bFrom, bTo, storeIds?` | İki dönemin toplamları + % değişim |

Tarihler `YYYY-MM-DD`. `storeIds` boş bırakılırsa org'un tüm mağazaları kullanılır.

## Bağlanma — MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

- **Transport Type:** Streamable HTTP
- **URL:** `http://localhost:3000/api/mcp`
- **Authentication:** Header `Authorization` = `Bearer chk_…`

Bağlandıktan sonra *List Tools* → bir tool seç → argümanları gir → *Run*.
`get_profit_summary`, REST `GET /api/analytics/profit-summary` ile **aynı** sonucu döner.

## Bağlanma — Claude Desktop

`claude_desktop_config.json` içine:

```json
{
  "mcpServers": {
    "churnify": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer chk_API_ANAHTARINIZ" }
    }
  }
}
```

HTTP MCP'yi yerel olarak desteklemeyen istemciler için `mcp-remote` köprüsü:

```json
{
  "mcpServers": {
    "churnify": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "http://localhost:3000/api/mcp",
        "--header", "Authorization: Bearer chk_API_ANAHTARINIZ"
      ]
    }
  }
}
```

## hızlı doğrulama (curl)

```bash
KEY=chk_...   # API key
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"get_profit_summary",
                 "arguments":{"from":"2024-01-01","to":"2026-12-31"}}}'
```
