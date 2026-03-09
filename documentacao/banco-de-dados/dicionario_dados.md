# Dicionário de Dados - Pastaz ERP

Este dicionário de dados descreve a estrutura das tabelas, colunas, tipos de dados e os comentários/regras de negócio atualmente configurados no banco de dados.

> **💡 Dica:** Para entender a **lógica de negócio e o propósito macro** de cada uma dessas tabelas no ecossistema do ERP, consulte o documento [Visão Geral e Propósito das Tabelas](PROPOSITO_DAS_TABELAS.md).

> **Aviso:** Consulte também o arquivo `funcoes_e_triggers.md` para entender as automações, triggers e procedures que rodam por trás destas tabelas.

--- *migration* com o comando `COMMENT ON` e reextraídas.

## Tabela: `channel_pricing`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do preço por canal. |
| `recipe_id` | `uuid` | NO | `-` | [FK -> recipes(id)] Receita para a qual o preço se aplica. [FK -> recipes(id)] |
| `channel_id` | `uuid` | NO | `-` | [FK -> sales_channels(id)] Canal de venda associado. [FK -> sales_channels(id)] |
| `channel_name` | `text` | YES | `-` | Nome do canal (snapshot para consulta rápida). |
| `sale_price` | `numeric` | NO | `-` | Preço de venda do produto neste canal em R$. |
| `price_unit` | `text` | NO | `'per_unit'::text` | Unidade de precificação. Padrão: per_unit. Alternativa: per_kg. |
| `notes` | `text` | YES | `-` | Observações sobre a precificação deste canal. |
| `updated_at` | `timestamp with time zone` | NO | `now()` | Data da última atualização do preço. |

## Tabela: `cmv_history`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | [ATENÇÃO: Tabela com poucos dados e custos em branco — verificar se está funcionando corretamente]. |
| `recipe_id` | `uuid` | YES | `-` | [FK -> recipes(id)] Receita à qual o snapshot de custo pertence. [FK -> recipes(id)] |
| `cost` | `numeric` | NO | `-` | Custo total da receita no momento do registro (ingredientes + embalagem + mão de obra). |
| `recorded_at` | `timestamp with time zone` | YES | `now()` | Data e hora em que o snapshot de custo foi capturado. |
| `ingredients_cost` | `numeric` | YES | `0` | Custo referente apenas aos ingredientes. |
| `packaging_cost` | `numeric` | YES | `0` | Custo referente à embalagem. |
| `labor_cost` | `numeric` | YES | `0` | Custo referente à mão de obra. |
| `labor_rate_applied` | `numeric` | YES | `0` | Custo da mão de obra (R$/hora) aplicada. |

## Tabela: `customers`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `text` | NO | `-` | Chave primária do cliente no Pastaz ERP. Geralmente mapeado para o ID interno do Bling. |
| `code` | `text` | YES | `-` | Campo opcional de cadastro do cliente no Bling. [OBS: Não utilizado atualmente] |
| `name` | `text` | NO | `-` | Nome completo ou Razão Social do cliente. |
| `fantasy_name` | `text` | YES | `-` | Nome Fantasia (usado para clientes PJ). |
| `address` | `text` | YES | `-` | Logradouro do endereço de entrega/faturamento. |
| `number` | `text` | YES | `-` | Número do endereço. |
| `complement` | `text` | YES | `-` | Complemento do endereço. |
| `neighborhood` | `text` | YES | `-` | Bairro do endereço. |
| `cep` | `text` | YES | `-` | CEP do endereço. |
| `city` | `text` | YES | `-` | Cidade do endereço. |
| `state` | `text` | YES | `-` | Estado (UF) do endereço. |
| `phone` | `text` | YES | `-` | Telefone fixo de contato. |
| `mobile` | `text` | YES | `-` | Telefone celular de contato. Campo chave para comunicações via WhatsApp. |
| `email` | `text` | YES | `-` | E-mail principal de contato e faturamento. |
| `website` | `text` | YES | `-` | Endereço do site do cliente. |
| `person_type` | `text` | YES | `-` | Tipo de pessoa: Pessoa Física (F) ou Pessoa Jurídica (J). |
| `cpf_cnpj` | `text` | YES | `-` | Documento de identificação fiscal (CPF ou CNPJ). |
| `state_registration` | `text` | YES | `-` | Inscrição Estadual do cliente. |
| `tax_regime` | `text` | YES | `-` | Regime Tributário do cliente. |
| `situation` | `text` | YES | `-` | Status do cliente no ERP (ex: Ativo, Inativo). |
| `notes` | `text` | YES | `-` | Observações gerais cadastradas para o cliente. |
| `created_at` | `date` | YES | `-` | - |
| `last_order_date` | `timestamp without time zone` | YES | `-` | Data do último pedido realizado pelo cliente. Puxada automaticamente pela trigger sync_order_from_orders_raw_row. |
| `segment` | `text` | YES | `-` | Segmento de mercado atribuído ao cliente. [VERIFICAR UTILIDADE: utilidade desconhecida no momento] |
| `updated_at` | `timestamp without time zone` | YES | `now()` | Data e hora da última alteração dos dados do cliente. |
| `orders` | `jsonb` | YES | `-` | Array com pedidos vinculados ao cliente. [REMOVIDA: migrada para a tabela relacional orders]. |

## Tabela: `customers_raw`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `customer_id` | `text` | NO | `-` | - |
| `payload_raw` | `jsonb` | NO | `-` | - |
| `payload_std` | `jsonb` | YES | `-` | - |
| `synced_at` | `timestamp with time zone` | YES | `-` | - |

## Tabela: `deliveries`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da entrega no Pastaz ERP. |
| `order_id` | `bigint` | NO | `-` | [FK -> orders(order_id)] Vinculo com o pedido que está sendo entregue. [FK -> orders(order_id)] |
| `provider` | `text` | NO | `-` | Provedor logístico ou modalidade de entrega (ex: Loggi, Lalamove, Frota Própria). |
| `price` | `numeric` | YES | `-` | Custo real do frete pago ao provedor em R$. |
| `status` | `text` | NO | `'QUOTING'::text` | Status atual da logística. Valores: QUOTING, ACCEPTED, ON_ROUTE, DELIVERED, CANCELLED. |
| `driver_name` | `text` | YES | `-` | Nome do entregador responsável. |
| `driver_phone` | `text` | YES | `-` | Telefone de contato do entregador responsável. |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data e hora em que a entrega foi registrada no sistema. |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Data e hora da última atualização dos dados da entrega. |
| `estimated_pickup_at` | `timestamp with time zone` | YES | `-` | Data e hora estimadas para a coleta (retirada) do pedido. |
| `estimated_dropoff_at` | `timestamp with time zone` | YES | `-` | Data e hora estimadas para a entrega final ao cliente. |

## Tabela: `expenses_records`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do registro de despesa. |
| `description` | `text` | NO | `-` | Descrição ou justificativa da despesa (ex: Compra de material de escritório). |
| `amount` | `numeric` | NO | `-` | Valor da despesa em R$. |
| `category_id` | `uuid` | NO | `-` | [FK -> financial_categories(id)] Categoria à qual a despesa pertence. |
| `record_date` | `date` | NO | `now()` | Data em que a despesa ocorreu/foi registrada. |
| `created_at` | `timestamp with time zone` | NO | `now()` | Data de criação do registro. |

## Tabela: `financial_categories`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da categoria financeira. |
| `name` | `text` | NO | `-` | Nome da categoria (ex: Alimentação, Marketing, Aluguel). |
| `parent_category` | `uuid` | YES | `-` | [FK -> financial_categories(id)] Referência à categoria pai para estrutura hierárquica (DRE). |
| `created_at` | `timestamp with time zone` | NO | `now()` | Data de criação da categoria. |

## Tabela: `ingredients`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Chave primária do ingrediente no Pastaz ERP. |
| `name` | `text` | NO | `-` | Nome único do ingrediente (ex: Farinha de Trigo, Ovo Caipira). |
| `category` | `text` | YES | `-` | Classificação do ingrediente. Valores interface: mercado, embalagem, produto de limpeza. O valor "pré-preparo" é uma informação lógica herdada quando o ingrediente é derivado de uma receita (ver recipes.derived_ingredient_id). |
| `current_price` | `numeric` | YES | `0.00` | Último preço de compra registrado em R$. |
| `unit` | `text` | NO | `'UN'::text` | Unidade de medida do ingrediente. Valores comuns: KG, UN, L. |
| `last_updated` | `timestamp with time zone` | YES | `now()` | Data e hora da última atualização de preço ou dados cadastrais. |
| `created_at` | `timestamp with time zone` | YES | `now()` | - |
| `yield_coefficient` | `numeric` | YES | `1.0000` | Fator de rendimento, fundamental para o custo real da receita. Ex: Preço final = Preço Compra / Coeficiente. (Ex1: Bacon com 79% de rendimento -> Preço/0.79. Ex2: Requeijão 1.5kg por R$20,99 -> Coeficiente 1.5 -> Preço/1.5 = R$/kg). |
| `nutritional_ref_id` | `uuid` | YES | `-` | [FK -> nutritional_ref(id)] Vincula o ingrediente aos dados nutricionais da tabela nutritional_ref para geração de rótulos ANVISA. |

## Tabela: `ingredients_categories`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da categoria de ingredientes no Pastaz ERP. |
| `name` | `text` | NO | `-` | Nome da categoria. Alimenta a lógica de adição de itens na interface do ERP (ex: mercado, embalagem, produto de limpeza). |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data e hora em que a categoria foi criada no sistema. |

## Tabela: `integration_alerts`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do alerta. Alimentada por funções de auditoria interna (ex: fn_check_missing_channel_prices). |
| `service_name` | `text` | NO | `-` | Nome do serviço que gerou o alerta (ex: Bling, Loggi). |
| `alert_type` | `text` | NO | `-` | Tipo do alerta (ex: sync_error, auth_expired, rate_limit). |
| `message` | `text` | NO | `-` | Mensagem descritiva do erro ou aviso ocorrido. |
| `is_resolved` | `boolean` | NO | `false` | Indica se o alerta já foi resolvido ou tratado. |
| `created_at` | `timestamp with time zone` | NO | `now()` | Data e hora em que o alerta foi registrado. |
| `resolved_at` | `timestamp with time zone` | YES | `-` | Data e hora em que o alerta foi marcado como resolvido. |

## Tabela: `integration_settings`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da configuração de integração. |
| `service_name` | `text` | NO | `-` | Nome inventado para a configuração. |
| `settings` | `jsonb` | NO | `'{}'::jsonb` | Objeto JSON que define os valores da configuração. |
| `updated_at` | `timestamp with time zone` | NO | `now()` | Data da última atualização das configurações. |

## Tabela: `monthly_closing`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do fechamento mensal. |
| `month` | `text` | NO | `-` | Mês de referência do fechamento (ex: 2026-03). |
| `status` | `text` | NO | `'draft'::text` | Status do fechamento. Padrão: draft. Outros: closed, reviewed. |
| `channel_summary` | `jsonb` | NO | `'[]'::jsonb` | Resumo JSON consolidado de receita por canal de venda no mês. |
| `time_allocation` | `jsonb` | NO | `'[]'::jsonb` | Alocação JSON de tempo de produção por receita/canal no mês. |
| `total_revenue` | `numeric` | YES | `0` | Receita total bruta do mês em R$. |
| `total_cmv` | `numeric` | YES | `0` | Custo de Mercadoria Vendida total do mês em R$. |
| `total_promotions` | `numeric` | YES | `0` | Total de descontos e promoções aplicados no mês em R$. |
| `overhead_items` | `jsonb` | NO | `'[]'::jsonb` | Detalhamento JSON dos itens de overhead aplicados no mês. [VERIFICAR LÓGICA: Investigar o que preenche esta coluna — vem de overhead_config automaticamente ou é input manual?] |
| `total_overhead` | `numeric` | YES | `0` | Soma total dos custos de overhead do mês em R$. |
| `net_profit` | `numeric` | YES | `0` | Lucro líquido do mês (Receita - CMV - Promoções - Overhead). |
| `created_at` | `timestamp with time zone` | NO | `now()` | Data de criação do fechamento. |
| `updated_at` | `timestamp with time zone` | NO | `now()` | Data da última atualização do fechamento. |

## Tabela: `nutritional_ref`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da referência nutricional no Pastaz ERP. |
| `tbca_code` | `text` | NO | `-` | Código original do ingrediente na base da TBCA ou fonte externa aprovada. |
| `category` | `text` | YES | `-` | Marca do produto, se houver (ex: Nestlé, Renata). |
| `description` | `text` | NO | `-` | Nome/Descrição do alimento conforme a fonte oficial. |
| `base_qty_g` | `numeric` | YES | `100` | Quantidade base (em gramas) à qual os nutrientes se referem (Padrão: 100g). |
| `energy_kcal` | `numeric` | YES | `-` | Valor energético em kcal. |
| `energy_kj` | `numeric` | YES | `-` | Valor energético em kJ. [REGRA: Pode ser calculado a partir de kcal (1 kcal ≈ 4.184 kJ)] |
| `protein_g` | `numeric` | YES | `-` | Proteínas (g). |
| `carbs_g` | `numeric` | YES | `-` | Carboidratos totais (g). |
| `lipid_g` | `numeric` | YES | `-` | Gorduras Totais / Lipídios (g). |
| `saturated_fat_g` | `numeric` | YES | `-` | Gorduras Saturadas (g). |
| `trans_fat_g` | `numeric` | YES | `-` | Gorduras Trans (g). |
| `fiber_g` | `numeric` | YES | `-` | Fibra Alimentar (g). |
| `sodium_mg` | `numeric` | YES | `-` | Sódio (mg). |
| `raw_nutrients` | `jsonb` | YES | `-` | JSON com todos os nutrientes brutos da fonte original. |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data de criação/importação do registro. |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Data da última atualização do registro. |
| `sugars_total_g` | `numeric` | YES | `0` | Açúcares totais (g). |
| `sugars_added_g` | `numeric` | YES | `0` | Açúcares adicionados (g). |

## Tabela: `orders`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `order_id` | `bigint` | NO | `-` | ID interno do pedido no ERP Bling. Chave primária nesta tabela. |
| `customer_id` | `bigint` | YES | `-` | ID numérico do cliente vindo da integração com o Bling. [ATENÇÃO: Não eliminar sem atualizar o fluxo n8n primeiro] |
| `order_date` | `date` | YES | `-` | Data de emissão/criação do pedido no Bling. |
| `status_id` | `integer` | YES | `-` | Código numérico de status para filtros rápidos de integração. |
| `status_value` | `integer` | YES | `-` | Valor numérico de status. [VERIFICAR UTILIDADE: parece ser desnecessário] |
| `order_number` | `bigint` | YES | `-` | Número sequencial do pedido como aparece na interface do Bling e para o cliente. |
| `store_number` | `text` | YES | `-` | Identificador da loja ou canal de venda de origem (ex: Site, Feira). [PONTO DE ATENÇÃO: Necessário validar a lógica de atribuição] |
| `status_text` | `text` | YES | `-` | Status descritivo do pedido vindo do Bling (ex: Em Aberto, Atendido, Cancelado). [ALERTA: Verificar por que pedidos recentes não estão populando esta coluna] |
| `shipping` | `numeric` | YES | `-` | Valor cobrado do cliente pelo frete/entrega em R$. |
| `items_total` | `numeric` | YES | `-` | Soma total apenas dos preços dos produtos no pedido, sem frete ou taxas. |
| `order_total` | `numeric` | YES | `-` | Valor total bruto do pedido em R$ (Soma de itens + frete - desconto). [OBS: Não contabiliza desconto adicionado na linha do produto no Bling] |
| `order_discount` | `numeric` | YES | `-` | Desconto aplicado ao pedido. [OBS: Não contabiliza desconto adicionado na linha do produto no Bling] |
| `other_expenses` | `numeric` | YES | `-` | Taxas extras ou custos adicionais lançados no pedido. |
| `synced_at` | `timestamp with time zone` | YES | `-` | Data/hora em que o pedido foi sincronizado pela primeira vez no Pastaz ERP. |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Data/hora da última atualização dos dados do pedido. |
| `delivery_date` | `date` | YES | `-` | Data agendada para a entrega do pedido ao cliente. |
| `delivery_period` | `text` | YES | `-` | Período de entrega selecionado (ex: Manhã, Tarde, Noite, Feira). |
| `customer_id_text` | `text` | YES | `-` | [FK -> customers(id)] Identificador textual do cliente. [FK -> customers(id)] |
| `delivery_time` | `time without time zone` | YES | `-` | Horário previsto para a entrega. Preenchimento manual, atende rotinas logísticas e o futuro módulo de entregas. |

## Tabela: `orders_items`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `order_id` | `bigint` | NO | `-` | [FK -> orders(order_id)] Identificador do pedido pai. [FK -> orders(order_id)] |
| `item_index` | `integer` | NO | `-` | Índice da linha do item no pedido (ex: 1, 2, 3). |
| `bling_id` | `bigint` | YES | `-` | ID único da linha do item no Bling usado para evitar duplicidade. |
| `product_code` | `text` | YES | `-` | SKU ou código do produto conforme consta no Bling. |
| `description` | `text` | YES | `-` | Nome ou descrição do item como consta no pedido. |
| `quantity` | `numeric` | YES | `-` | Quantidade vendida deste item. |
| `unit_price` | `numeric` | YES | `-` | Preço unitário de venda (Já com item_discount aplicado). |
| `total_price` | `numeric` | YES | `-` | Preço total bruto da linha (Quantidade x Preço Unitário). |
| `item_discount` | `numeric` | YES | `-` | Desconto em % aplicado especificamente nesta linha do item. |
| `cost_price` | `numeric` | YES | `-` | Custo unitário do produto no momento da venda. [ATENÇÃO: Este campo vem do Bling e não é utilizado para o cálculo de CMV do Pastaz ERP]. |
| `product_id` | `uuid` | YES | `-` | [FK -> products(id)] Vinculo interno com o produto no Pastaz ERP. [FK -> products(id)] |

## Tabela: `orders_raw`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `order_id` | `text` | NO | `-` | - |
| `customer_id` | `text` | YES | `-` | - |
| `order_date` | `text` | YES | `-` | - |
| `payload_raw` | `jsonb` | NO | `-` | - |
| `synced_at` | `timestamp with time zone` | YES | `now()` | - |
| `payload_std` | `jsonb` | YES | `-` | - |
| `status_id` | `integer` | YES | `-` | - |
| `status_value` | `integer` | YES | `-` | - |

## Tabela: `overhead_config`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da configuração de overhead. |
| `name` | `text` | NO | `-` | Nome da métrica de custo (ex: Aluguel, Energia, Impostos). |
| `default_value` | `numeric` | NO | `0` | Valor percentual (%) ou absoluto (R$) padrão usado nos rateios de custos. |
| `source` | `text` | NO | `'dre_anual'::text` | Indica de qual parte da planilha DRE vem o dado. |
| `category` | `text` | NO | `'fixo'::text` | Classificação do custo. Fixo indica que o rateio é padrão entre os canais de venda. |
| `notes` | `text` | YES | `-` | Detalhamento do que compõe este custo. |
| `updated_at` | `timestamp with time zone` | NO | `now()` | Data da última atualização/revisão deste valor. |

## Tabela: `payment_gateways_history`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `date` | `date` | NO | `-` | Data do resumo das transações (Snapshot diário). |
| `gateway` | `text` | NO | `-` | Identificador do gateway (Valores: `mercado_pago`, `stripe`). |
| `gross_amount` | `numeric` | NO | `0` | Valor bruto total das vendas processadas no dia. |
| `fee_amount` | `numeric` | NO | `0` | Total de taxas e comissões deduzidas pelo gateway. |
| `net_amount` | `numeric` | NO | `0` | Valor líquido recebido (Gross - Fee). |
| `status` | `text` | YES | `-` | Status da sincronização (ex: `synced`). |
| `transaction_count` | `integer` | YES | `0` | Quantidade de transações processadas no período. |
| `metadata` | `jsonb` | YES | `'{}'::jsonb` | Dados técnicos adicionais da resposta da API do gateway. |

## Tabela: `producao_batches`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do lote. |
| `data_producao` | `date` | NO | `CURRENT_DATE` | Data em que o lote foi finalizado (auto-backflush via Bling). |
| `recipe_id` | `uuid` | NO | `-` | [FK -> recipes(id)] Receita produzida no lote. [FK -> recipes(id)] |
| `recipe_name` | `text` | YES | `-` | Nome da receita (snapshot). |
| `kg_produzido` | `numeric` | NO | `-` | Quantidade real produzida em KG (baseada na entrada de estoque). |
| `tempo_minutos` | `integer` | YES | `-` | Tempo de produção rateado (usado para cálculo de overhead/hora). |
| `created_at` | `timestamp with time zone` | NO | `now()` | Data e hora do registro. |

## Tabela: `product_history`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `history_id` | `bigint` | NO | `-` | Chave primária sequencial do registro histórico. |
| `product_id` | `uuid` | YES | `-` | [FK -> products(id)] Produto no Pastaz ERP. [FK -> products(id)] |
| `bling_id` | `bigint` | YES | `-` | ID do produto no Bling no momento do snapshot. |
| `sku` | `text` | YES | `-` | SKU do produto no momento do snapshot. |
| `product` | `text` | YES | `-` | Nome do produto no momento do snapshot. |
| `type` | `text` | YES | `-` | Unidade de medida do produto. Valores: UN (unidade) ou KG (quilograma). |
| `product_price` | `numeric` | YES | `-` | Preço de venda no momento do snapshot. |
| `status` | `text` | YES | `-` | Status do produto no momento do snapshot (Ativo, Inativo). |
| `last_updated` | `timestamp with time zone` | YES | `-` | Última atualização no Bling antes do snapshot. |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data em que o snapshot foi registrado. |

## Tabela: `product_map`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Chave primária do mapeamento De-Para. |
| `raw_name` | `text` | NO | `-` | Nome bruto do item conforme consta na nota/recibo de compra. |
| `ingredient_id` | `uuid` | YES | `-` | [FK -> ingredients(id)] Ingrediente do ERP ao qual este nome bruto foi vinculado. [FK -> ingredients(id)] |
| `confidence` | `numeric` | YES | `1.0` | Grau de confiança do match (0 a 1). Padrão: 1.0 (match manual/confirmado). |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data de criação do mapeamento. |

## Tabela: `product_variations`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Chave primária da variação do produto no Pastaz ERP. |
| `product_id` | `uuid` | YES | `-` | [FK -> products(id)] Produto base ao qual esta variação pertence. [FK -> products(id)] |
| `name` | `text` | NO | `-` | Nome descritivo da variação (ex: Bandeja 500g, Bandeja 1kg, Granel). |
| `weight_kg` | `numeric` | NO | `-` | Peso líquido em KG correspondente a esta variação. Usado para rateio correto de custos de mão de obra e ingredientes. |
| `packaging_cost` | `numeric` | YES | `0` | Custo específico da embalagem para esta variação em R$. |
| `is_standard` | `boolean` | YES | `false` | Indica se esta é a variação padrão assumida quando o pedido não especifica um tamanho/formato. |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data de criação da variação. |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Data da última atualização da variação. |

## Tabela: `products`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do produto no Pastaz ERP. |
| `bling_id` | `bigint` | YES | `-` | ID único do produto no ERP Bling. Usado para sincronização de estoque e pedidos externos. |
| `sku` | `text` | YES | `-` | Código SKU (Stock Keeping Unit) do produto. Identificador comercial chave. Deve coincidir com o SKU cadastrado no Bling. |
| `product` | `text` | YES | `-` | Nome comercial do produto exibido ao cliente e listado nos pedidos. |
| `type` | `text` | YES | `-` | Indica a unidade de comercialização do produto. Valores possíveis: UN (por unidade) ou KG (por quilograma). |
| `product_price` | `numeric` | YES | `-` | Preço de venda unitário padrão (B2C) em Reais (BRL), praticado para o consumidor final. |
| `status` | `text` | YES | `-` | Status de disponibilidade do produto no catálogo. Valores possíveis: Ativo, Inativo, Excluído. Padrões sincronizados diretamente do Bling. |
| `last_updated` | `timestamp with time zone` | YES | `-` | Timestamp da última sincronização ou alteração manual dos dados deste produto. |
| `preco_revenda` | `numeric` | YES | `NULL::numeric` | Preço de venda para revenda (tabela especial Bling) |
| `unit_ingredients_cost` | `numeric` | YES | `0` | Custo em R$ dos ingredientes de 1 unidade. Atualizado via triggers sempre que a receita ou ingredientes mudam. |
| `unit_packaging_cost` | `numeric` | YES | `0` | Custo em R$ de embalagem de 1 unidade, rateado do lote da receita. |
| `unit_labor_cost` | `numeric` | YES | `0` | Custo em R$ de mão-de-obra rateado por 1 unidade, vindo do lote da receita. |

## Tabela: `receipt_items`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Identificador único da linha de item dentro da nota. |
| `receipt_id` | `uuid` | YES | `-` | [FK -> receipts(id)] Nota fiscal à qual este item pertence. [FK -> receipts(id)] |
| `raw_name` | `text` | NO | `-` | Nome do item exatamente como consta na nota fiscal (ex: FARINHA RECO 1KG). |
| `parsed_price` | `numeric` | YES | `-` | Preço unitário extraído da nota antes da validação. |
| `quantity` | `numeric` | YES | `1.0` | Quantidade comprada do item conforme consta na nota. |
| `matched_ingredient_id` | `uuid` | YES | `-` | [FK -> ingredients(id)] Vínculo do item da nota ao ingrediente oficial do ERP. [FK -> ingredients(id)] |
| `category_suggestion` | `text` | YES | `-` | [VERIFICAR UTILIDADE: Campo atualmente em branco, possivelmente destinado a sugestões de IA para categorização]. |
| `verified` | `boolean` | YES | `false` | [PENDENTE: Utilidade desconhecida. Possível flag de conferência manual para atualização de preços]. |

## Tabela: `receipts`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Identificador único da compra no Pastaz ERP. |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data e hora em que a compra foi registrada no sistema. |
| `market_name` | `text` | YES | `-` | Nome do local de compra (ex: Atacadão, Assaí). |
| `total_amount` | `numeric` | YES | `-` | Valor total bruto da nota fiscal/recibo em R$. |
| `image_url` | `text` | YES | `-` | URL da imagem do comprovante armazenada no storage. |
| `status` | `text` | YES | `'pending_validation'::text` | Ciclo de vida da nota. Padrao: pending_validation. Outros: processed, error. |

## Tabela: `recipe_categories`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária da categoria de receitas no Pastaz ERP. |
| `name` | `text` | NO | `-` | Nome da categoria de produto (ex: Molhos, Massa Fresca, Biscoito). |
| `anvisa_portion_g` | `numeric` | NO | `-` | Peso padrão da porção em gramas (Legislação ANVISA). Regras: Massa seca (80g), Massa desidratada c/ recheio (70g), Massa fresca c/ ou s/ recheio (100g), Biscoito (30g), Molho (60g), Manteiga (10g). |
| `created_at` | `timestamp with time zone` | YES | `now()` | Data de criação da categoria. |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Data da última atualização da categoria. |

## Tabela: `recipe_ingredients`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Identificador único da linha de ingrediente dentro da receita. |
| `recipe_id` | `uuid` | YES | `-` | [FK -> recipes(id)] Referência à receita pai. [FK -> recipes(id)] |
| `ingredient_id` | `uuid` | YES | `-` | [FK -> ingredients(id)] Referência ao insumo utilizado. [FK -> ingredients(id)] |
| `quantity` | `numeric` | NO | `-` | Peso ou quantidade do ingrediente utilizado nesta receita. REGRA: A quantidade deve estar sempre em KG. |

## Tabela: `recipe_nutrition`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do registro nutricional no Pastaz ERP. |
| `recipe_id` | `uuid` | NO | `-` | [FK -> recipes(id)] Vinculo único (1:1) com a receita. [FK -> recipes(id)] Cada receita tem apenas um quadro nutricional consolidado ativo. |
| `energy_kcal_100g` | `numeric` | YES | `-` | Valor energético em kcal proporcional a 100g da receita pronta (base oficial ANVISA). |
| `energy_kj_100g` | `numeric` | YES | `-` | Valor energético em kJ proporcional a 100g da receita pronta. |
| `protein_g_100g` | `numeric` | YES | `-` | Proteínas (g) proporcional a 100g da receita pronta. |
| `carbs_g_100g` | `numeric` | YES | `-` | Carboidratos (g) proporcional a 100g da receita pronta. |
| `lipid_g_100g` | `numeric` | YES | `-` | Gorduras Totais / Lipídios (g) proporcional a 100g da receita pronta. |
| `saturated_fat_g_100g` | `numeric` | YES | `-` | Gorduras Saturadas (g) proporcional a 100g da receita pronta. |
| `trans_fat_g_100g` | `numeric` | YES | `-` | Gorduras Trans (g) proporcional a 100g da receita pronta. |
| `fiber_g_100g` | `numeric` | YES | `-` | Fibra Alimentar (g) proporcional a 100g da receita pronta. |
| `sodium_mg_100g` | `numeric` | YES | `-` | Sódio (mg) proporcional a 100g da receita pronta. |
| `portion_g` | `numeric` | YES | `-` | Tamanho da porção padrão recomendada (em gramas). [VERIFICAR LÓGICA: investigar se é populada por anvisa_portion_g da tabela recipe_categories] |
| `household_measure` | `text` | YES | `-` | Medida caseira correspondente à porção. [PONTO DE ATENÇÃO: origem do input deste campo é atualmente desconhecida] |
| `energy_kcal_portion` | `numeric` | YES | `-` | Valor energético (kcal) na porção estipulada. |
| `energy_kj_portion` | `numeric` | YES | `-` | Valor energético (kJ) na porção estipulada. |
| `protein_g_portion` | `numeric` | YES | `-` | Proteínas (g) na porção estipulada. |
| `carbs_g_portion` | `numeric` | YES | `-` | Carboidratos (g) na porção estipulada. |
| `lipid_g_portion` | `numeric` | YES | `-` | Gorduras Totais / Lipídios (g) na porção estipulada. |
| `saturated_fat_g_portion` | `numeric` | YES | `-` | Gorduras Saturadas (g) na porção estipulada. |
| `trans_fat_g_portion` | `numeric` | YES | `-` | Gorduras Trans (g) na porção estipulada. |
| `fiber_g_portion` | `numeric` | YES | `-` | Fibra Alimentar (g) na porção estipulada. |
| `sodium_mg_portion` | `numeric` | YES | `-` | Sódio (mg) na porção estipulada. |
| `calculated_at` | `timestamp with time zone` | YES | `now()` | Data e hora do último cálculo de consolidação nutricional. |
| `sugars_total_g_100g` | `numeric` | YES | `0` | Açúcares totais (g) proporcional a 100g da receita pronta. |
| `sugars_added_g_100g` | `numeric` | YES | `0` | Açúcares adicionados (g) proporcional a 100g da receita pronta. |
| `sugars_total_g_portion` | `numeric` | YES | `0` | Açúcares totais (g) na porção estipulada. |
| `sugars_added_g_portion` | `numeric` | YES | `0` | Açúcares adicionados (g) na porção estipulada. |

## Tabela: `recipes`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | Chave primária da receita no Pastaz ERP. |
| `name` | `text` | NO | `-` | Nome identificador da receita (ex: Massa de Lasanha, Molho Sugo). |
| `current_cost` | `numeric` | YES | `0.00` | Custo total atual do lote da receita (Soma de Ingredientes + Embalagem + Mão de Obra). Calculado via triggers baseadas nos ingredientes. |
| `last_calculated` | `timestamp with time zone` | YES | `now()` | Data e hora do último processamento de cálculo de custos e valores nutricionais. |
| `yield_units` | `numeric` | YES | `-` | Quantidade de unidades finais que o lote da receita produz (Rendimento da receita). |
| `total_weight_kg` | `numeric` | YES | `-` | Peso total bruto do lote produzido em quilogramas (KG). [VERIFICAR UTILIDADE: coluna desnecessária se não houver vínculos operacionais] |
| `cmv_per_kg` | `numeric` | YES | `-` | Custo de Mercadoria Vendida (CMV) rateado por quilograma da receita produzida. [VERIFICAR UTILIDADE: coluna desnecessária se não houver vínculos operacionais] |
| `labor_cost` | `numeric` | YES | `0.00` | Custo total da mão de obra direta para a execução da receita. [VERIFICAR UTILIDADE: coluna desnecessária se não houver vínculos operacionais] |
| `sku` | `text` | YES | `-` | SKU comercial vinculado a esta receita (opcional, para cruzamento com dados do Bling). |
| `product_id` | `uuid` | YES | `-` | [FK -> products(id)] Vinculo entre a receita e o produto final vendido no ERP. |
| `is_pre_preparo` | `boolean` | YES | `false` | Indica se a receita é um item intermediário (pré-preparo) usado como base para outras receitas. |
| `derived_ingredient_id` | `uuid` | YES | `-` | [FK -> ingredients(id)] Vincula esta receita a um ingrediente derivado, permitindo que o resultado desta receita seja usado como insumo em outras. |
| `production_unit` | `character varying` | YES | `'KG'::character varying` | Unidade principal de medida da produção. Exemplos esperados: KG, UN. |
| `cmv_per_unit` | `numeric` | YES | `-` | Custo de Mercadoria Vendida (CMV) rateado por unidade produzida. |
| `labor_minutes` | `numeric` | YES | `0` | Tempo total estimado (em minutos) despendido para a produção do lote completo. |
| `ingredients_cost` | `numeric` | YES | `0` | Custo total bruto dos ingredientes (insumos) que compõem o lote. |
| `packaging_cost` | `numeric` | YES | `0` | Custo total das embalagens e materiais de acondicionamento vinculados à receita. |
| `category_id` | `uuid` | YES | `-` | [FK -> recipe_categories(id)] Define a categoria da receita para fins de organização e cálculo de porções ANVISA. |
| `net_weight` | `numeric` | YES | `-` | Peso líquido final de uma unidade produzida, em quilogramas (KG). [VERIFICAR UTILIDADE: coluna desnecessária se não houver vínculos operacionais] |
| `status` | `text` | YES | `'ativo'::text` | Status de disponibilidade da receita. Valores possíveis: ativo, inativo, rascunho. Controla se a receita aparece na aba Receitas, na aba ReceitaLab ou não aparece na interface |

## Tabela: `sales_channels`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Chave primária do canal de venda. |
| `name` | `text` | NO | `-` | Nome do canal de venda (ex: Site, iFood, Feira, WhatsApp). |
| `dre_names` | `ARRAY` | NO | `'{}'::text[]` | Termos procurados nas vendas do mês para agrupamento no canal nos relatórios de faturamento. |
| `variable_costs` | `jsonb` | NO | `'[]'::jsonb` | Armazena as taxas variáveis do canal (ex: comissão do marketplace, impostos específicos por canal) para cálculo do Overhead. |
| `payment_rules` | `jsonb` | NO | `'{}'::jsonb` | Regras de distribuição das taxas de pagamento para cálculo do Overhead. |
| `notes` | `text` | YES | `-` | Observações gerais sobre o canal. |
| `created_at` | `timestamp with time zone` | NO | `now()` | Data de criação do canal no sistema. |
| `bling_unidade_negocio_id` | `bigint` | YES | `-` | ID da "Unidade de Negócio" no Bling para sincronizar pedidos deste canal automaticamente. |

## Tabela: `segments`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `integer` | NO | `nextval('segments_id_seq'::regclass)` | Chave primária do segmento de clientes. [ATENÇÃO: Tabela ainda não utilizada em produção]. |
| `name` | `text` | YES | `-` | Nome do segmento (ex: VIP, Frequente, Inativo). |
| `min_days` | `integer` | YES | `-` | Mínimo de dias desde o último pedido para pertencer a este segmento. |
| `max_days` | `integer` | YES | `-` | Máximo de dias desde o último pedido para pertencer a este segmento. |
| `description` | `text` | YES | `-` | Descrição textual do critério de segmentação. |

## Tabela: `sync_state`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `text` | NO | `-` | Chave primária do tipo de sincronização (ex: bling_orders, bling_products). [VERIFICAR UTILIDADE: Confirmar se esta tabela ainda é utilizada nos fluxos atuais]. |
| `cutoff_date` | `text` | NO | `-` | Data de corte da última sincronização bem-sucedida. Próxima sync busca a partir desta data. |
| `updated_at` | `timestamp with time zone` | YES | `-` | Data e hora da última atualização do estado de sincronização. |

## Tabela: `temp_orders_backfill`

| Coluna | Tipo | Nullable | Default | Descrição / Regra de Negócio |
| :--- | :--- | :--- | :--- | :--- |
| `order_id` | `bigint` | NO | `-` | - |
| `store_name` | `text` | YES | `-` | - |

