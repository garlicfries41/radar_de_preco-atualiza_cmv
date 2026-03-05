# Relatório de Pendências Técnicas e de Lógica (Pastaz ERP)

Este documento consolida todas as dúvidas, inconsistências e pontos de atenção levantados durante a revisão do esquema do banco de dados iniciada em 04/03/2026.

---

## 🛑 Bloqueios e Inconsistências de Lógica

### 1. Custos em `products` e `recipes`
- **Problema:** Colunas de custo (`current_cost`, `unit_ingredients_cost`, `unit_packaging_cost`, `unit_labor_cost`) existem nas tabelas, mas a vinculação/cálculo automático não parece estar sendo executada no banco.
- **Dúvida:** Devemos consertar a triggers/functions imediatamente ou são campos populados via interface/n8n?
- **Tabelas Afetadas:** `products`, `recipes`.
- ✅ **Solução Encontrada:** Confirmado via análise de funções que **NÃO existe trigger de cálculo de custo financeiro** no banco. Existem triggers nutricionais, mas a parte de custo (ingredientes + embalagem + mão de obra) **é um gap real** que precisa ser implementado.

### 2. Origem dos Dados Nutricionais em `recipe_nutrition`
- **Problema:** A coluna `portion_g` (gramas da porção) deveria vir de `recipe_categories.anvisa_portion_g`, mas o vínculo não está explícito no banco.
- **Problema:** A coluna `household_measure` (medida caseira) está populada mas a origem do input é desconhecida.
- **Ajuste Realizado:** Renomeado typo de `fiber_g_portion_portion` para `fiber_g_portion`.
- ✅ **Solução Encontrada:** A função `recalculate_recipe_nutrition()` confirma que `portion_g` vem de `recipe_categories.anvisa_portion_g` e `household_measure` é hardcoded como `'1 Porção'`. O vínculo **está implementado na função**, não via FK.

---

## ⚠️ Pontos de Atenção (Integração e Utilidade)

### 3. Integração com Bling (Tabela `orders` e `customers`)
- **Atenção:** A coluna `customer_id` (bigint) na tabela `orders` vem do Bling. Não pode ser removida sem atualizar o fluxo n8n.
- **Inconsistência:** Pedidos recentes não estão populando o campo `status_text`.
- **Regra de Cálculo:** `order_total` e `order_discount` não contabilizam descontos aplicados individualmente na linha do produto no Bling.

### 4. Campos sem uso ou com utilidade desconhecida
- **`customers.code`**: Campo opcional no Bling, não utilizado no Pastaz.
- **`customers.last_order_date`**: Coluna sem dados. Requer implementação de rotina para popular.
- **`customers.segment`**: Utilidade desconhecida.
- **`customers.orders`**: Array JSON atualmente vazio.
- **`recipes.total_weight_kg`, `cmv_per_kg`, `net_weight`**: Sinalizados como possivelmente desnecessários se não houver vínculos operacionais.
  - ✅ **Solução Encontrada:** `total_weight_kg` é usado como **fallback** na função `recalculate_recipe_nutrition()` para calcular o peso total quando `yield_units` não está definido. `net_weight` também é usado no cálculo. **NÃO podem ser removidas.**
- **`orders.status_value`**: Provavelmente desnecessário.
  - ✅ **Solução Encontrada:** A função `fn_check_missing_channel_prices()` filtra por `status_value >= 6` (pedidos faturados). **NÃO pode ser removida.**
- **`orders.delivery_time`**: Avaliar se há dependências antes de excluir.
- **`receipt_items.category_suggestion` & `receipt_items.verified`**: Utilidade desconhecida, campos em branco ou sem regra de negócio clara.
- **`monthly_closing.overhead_items`**: Investigar o que preenche esta coluna — vem de `overhead_config` automaticamente ou é input manual?

### 5. Categorização e Rendimento (`ingredients`)
- **Regra:** O `yield_coefficient` agora documentado como divisor do preço (`Preço/Coef`).
- **Lógica:** O valor "pré-preparo" na interface de ingredientes é uma informação herdada de `recipes.derived_ingredient_id`.

---

## 🛠️ Melhorias de Esquema Pendentes
- Adicionar colunas de açúcares (`sugars_total_g`, `sugars_added_g`) em outras visões onde o cálculo nutricional for necessário.
- Validar a lógica de atribuição da `store_number` na tabela `orders`.
  - ✅ **Solução Encontrada:** A trigger `trg_map_store_number` (via `fn_map_store_number()`) extrai `payload_raw -> loja -> unidadeNegocio -> id`, cruza com `sales_channels.bling_unidade_negocio_id` e popula `orders.store_number` automaticamente.

---

## 🔍 Tabelas que Precisam de Investigação Completa

### 6. `producao_batches`
- **Problema:** O usuário não conhece a lógica de funcionamento desta tabela.
- **Ação Necessária:** Investigar o front-end e fluxos n8n para entender como os lotes de produção são registrados (manual vs automático) e como `kg_produzido` e `tempo_minutos` alimentam os cálculos de custo.

### 7. `integration_alerts`
- **Problema:** Origem dos dados desconhecida. O usuário não sabe o que alimenta esta tabela.
- **Ação Necessária:** Investigar fluxos n8n e código front-end para identificar quais processos inserem alertas nesta tabela.
- ✅ **Solução Encontrada:** A função `fn_check_missing_channel_prices(p_month)` é quem alimenta esta tabela. Ela audita itens vendidos sem preço cadastrado no `channel_pricing` e insere alertas do tipo `missing_price`.

### 8. `cmv_history`
- **Problema:** Tabela com poucos dados e colunas de custos em branco. Não está funcionando corretamente.
- **Ação Necessária:** Investigar a trigger ou processo que deveria popular esta tabela com snapshots de custo ao longo do tempo.

### 9. `sync_state`
- **Problema:** Necessário confirmar se esta tabela ainda é utilizada nos fluxos atuais de sincronização.
