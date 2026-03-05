# Funções, Triggers e Políticas do Banco de Dados — Pastaz ERP

> Documento gerado automaticamente em 2026-03-04.
> Contém **TODO o código que roda em segundo plano** no Supabase.

---

## 1. Funções e Procedures

### 1.1 `recalculate_recipe_nutrition(p_recipe_id uuid)`
**Tipo:** Function → `void`  
**O que faz:** Recalcula a tabela nutricional de uma receita com base nos ingredientes cadastrados em `recipe_ingredients` e nas referências nutricionais em `nutritional_ref`.

**Lógica Principal:**
1. Percorre cada ingrediente da receita.
2. Converte a quantidade para gramas (KG×1000, G direto, L×1000).
3. Calcula a proporção `qty_g / base_qty_g` para cada nutriente (kcal, kJ, proteína, carbs, lipídios, gordura saturada, gordura trans, fibra, sódio, açúcares totais, açúcares adicionados).
4. Determina o peso final do produto usando `yield_units` e `net_weight` da receita.
5. Calcula valores por 100g e por porção (usando `anvisa_portion_g` da `recipe_categories`).
6. Faz UPSERT em `recipe_nutrition`.

**Tabelas afetadas:** `recipe_ingredients`, `ingredients`, `nutritional_ref`, `recipes`, `recipe_categories`, `recipe_nutrition`.

---

### 1.2 `sync_order_from_orders_raw_row()`
**Tipo:** Trigger Function  
**O que faz:** Quando um registro bruto vindo do Bling entra em `orders_raw`, esta função extrai os dados do payload JSON e popula as tabelas `orders`, `customers` e `orders_items`.

**Lógica Principal:**
1. Verifica se `payload_std` existe.
2. **UPSERT em `customers`**: garante que o cliente exista antes do pedido (evita FK error).
3. **UPSERT em `orders`**: insere ou atualiza o pedido com data, status, totais financeiros, data de entrega e período.
4. **Recria `orders_items`**: deleta os itens existentes e insere novamente a partir do JSON (garante consistência).
5. Faz o match de `product_id` via `bling_id` na tabela `products`.

**Tabelas afetadas:** `orders_raw` → `customers`, `orders`, `orders_items`, `products`.

---

### 1.3 `fn_map_store_number()`
**Tipo:** Trigger Function  
**O que faz:** Quando um pedido entra em `orders_raw`, extrai o ID da "Unidade de Negócio" do Bling e traduz para o nome do canal de venda correspondente na tabela `sales_channels`.

**Lógica:** Lê `payload_raw -> loja -> unidadeNegocio -> id`, busca o `name` em `sales_channels` onde `bling_unidade_negocio_id` bate, e atualiza `orders.store_number`.

**Tabelas afetadas:** `orders_raw` → `sales_channels` → `orders`.

---

### 1.4 `fn_auto_populate_channel_pricing()`
**Tipo:** Trigger Function  
**O que faz:** Quando um `product` é inserido ou atualizado, auto-popula a tabela `channel_pricing` com preços por canal.

**Lógica:**
1. Para cada receita vinculada ao produto (exceto pré-preparo):
   - **Site, Chat, Feira** → usa `product_price`.
   - **PJ - Revenda** → usa `preco_revenda`.
2. Faz UPSERT em `channel_pricing` (não sobrescreve preços editados manualmente se já existirem).

**Tabelas afetadas:** `products` → `recipes`, `sales_channels` → `channel_pricing`.

---

### 1.5 `fn_check_missing_channel_prices(p_month text)`
**Tipo:** Function → `TABLE(order_id, product_name, store_number, channel_matched)`  
**O que faz:** Audita um mês específico e identifica produtos vendidos que **não possuem preço** cadastrado em `channel_pricing`.

**Lógica:**
1. Cruza `orders` + `orders_items` + `products` + `recipes` + `sales_channels` + `channel_pricing`.
2. Filtra pedidos do mês com `status_value >= 6` (faturados).
3. Quando encontra um item sem preço cadastrado, insere um alerta em `integration_alerts`.
4. Retorna a lista dos itens problemáticos.

**Tabelas afetadas:** Leitura de várias tabelas → escrita em `integration_alerts`.

---

### 1.6 `get_monthly_time_allocation(p_month text)`
**Tipo:** Function → `jsonb`  
**O que faz:** Calcula a alocação percentual de tempo de produção por canal de venda em um mês.

**Lógica:** Soma `quantity × labor_minutes` (da receita) por canal. Retorna JSON com `channel`, `minutes`, `pct`.

---

### 1.7 `get_monthly_closing_data(p_month text)`
**Tipo:** Function → `jsonb`  
**O que faz:** Consolida os dados financeiros mensais (receita, CMV, overhead alocado, lucro líquido) por canal de venda.

**Lógica:**
1. Busca alocação de tempo via `get_monthly_time_allocation`.
2. Calcula receita e CMV por canal.
3. Distribui o overhead proporcionalmente ao tempo.
4. Retorna JSON com `channel`, `revenue`, `cmv`, `overhead_allocated`, `net_profit`.

---

### 1.8 `persist_monthly_closing(p_month text)`
**Tipo:** Procedure  
**O que faz:** Persiste o fechamento mensal na tabela `monthly_closing`.

**Lógica:** Chama `get_monthly_time_allocation` e `get_monthly_closing_data`, calcula totais e faz UPSERT em `monthly_closing`.

---

### 1.9 `sync_customer_id_text()`
**Tipo:** Trigger Function  
**O que faz:** Converte `customer_id` (numérico) para `customer_id_text` (texto) automaticamente.

---

### 1.10 `trigger_recipe_ingredients_calc()`
**Tipo:** Trigger Function  
**O que faz:** Dispara `recalculate_recipe_nutrition` sempre que um ingrediente é adicionado, removido ou alterado em `recipe_ingredients`.

---

### 1.11 `trigger_ingredients_nutritional_ref_calc()`
**Tipo:** Trigger Function  
**O que faz:** Quando o `nutritional_ref_id` de um ingrediente muda, recalcula TODAS as receitas que usam aquele ingrediente.

---

### 1.12 `trigger_recipes_weight_product_calc()`
**Tipo:** Trigger Function  
**O que faz:** Quando `total_weight_kg` ou `product_id` de uma receita muda, recalcula a tabela nutricional da receita.

---

### 1.13 `update_modified_column()`
**Tipo:** Trigger Function  
**O que faz:** Atualiza `updated_at = now()` automaticamente em qualquer UPDATE.

---

## 2. Triggers (Gatilhos)

| Trigger | Tabela | Evento | Timing | Executa |
|---|---|---|---|---|
| `calc_nutrition_on_ingredients` | `ingredients` | UPDATE | AFTER | `trigger_ingredients_nutritional_ref_calc()` |
| `trg_sync_customer_id_text` | `orders` | INSERT/UPDATE | BEFORE | `sync_customer_id_text()` |
| `trg_sync_order_from_orders_raw` | `orders_raw` | INSERT/UPDATE | AFTER | `sync_order_from_orders_raw_row()` |
| `trg_map_store_number` | `orders_raw` | INSERT/UPDATE | AFTER | `fn_map_store_number()` |
| `update_product_variations_modtime` | `product_variations` | UPDATE | BEFORE | `update_modified_column()` |
| `trg_auto_channel_pricing` | `products` | INSERT/UPDATE | AFTER | `fn_auto_populate_channel_pricing()` |
| `calc_nutrition_on_recipe_ingredients` | `recipe_ingredients` | INSERT/UPDATE/DELETE | AFTER | `trigger_recipe_ingredients_calc()` |
| `calc_nutrition_on_recipes` | `recipes` | UPDATE | AFTER | `trigger_recipes_weight_product_calc()` |

---

## 3. Políticas RLS (Row Level Security)

| Tabela | Política | Acesso | Comando | Roles |
|---|---|---|---|---|
| `cmv_history` | Enable all access for authenticated users | Autenticado | ALL | authenticated |
| `customers` | Enable read access for all users | Público | SELECT | public |
| `deliveries` | Enable all access for all users | Público | ALL | public |
| `ingredients` | Enable all access for authenticated users | Autenticado | ALL | authenticated |
| `orders` | Enable read access for all users | Público | SELECT | public |
| `orders_items` | Enable read access for all users | Público | SELECT | public |
| `product_history` | Enable read access for authenticated users | Autenticado | SELECT | authenticated |
| `product_map` | Enable all access for authenticated users | Autenticado | ALL | authenticated |
| `products` | Enable read access for authenticated users | Autenticado | SELECT | authenticated |
| `receipt_items` | Enable all access for authenticated users | Autenticado | ALL | authenticated |
| `receipts` | Enable all access for authenticated users | Autenticado | ALL | authenticated |
| `recipe_ingredients` | Enable all access for authenticated users | Autenticado | ALL | authenticated |
| `recipes` | Enable all access for authenticated users | Autenticado | ALL | authenticated |

> ⚠️ **Nota:** Muitas tabelas como `channel_pricing`, `overhead_config`, `monthly_closing`, `integration_settings`, `segments`, `sync_state`, `producao_batches`, `recipe_categories`, `nutritional_ref`, `product_variations`, `sales_channels`, `recipe_nutrition`, `integration_alerts` **NÃO possuem RLS habilitado ou políticas definidas**.
