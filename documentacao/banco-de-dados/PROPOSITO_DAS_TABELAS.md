# Propósito das Tabelas (Visão Geral do Sistema Pastaz ERP)

> **Contexto:** Este documento consolida a função didática e prática de cada tabela do banco de dados, para que qualquer pessoa consiga entender o papel de cada engrenagem no sistema Pastaz ERP, unindo o conhecimento de negócio com a estrutura técnica.

Abaixo está o propósito **didático e prático** de cada tabela do banco de dados, divididas por módulo de negócio.

---

## 🍽️ 1. Engenharia de Cardápio e Custos (Ficha Técnica)

Essas tabelas formam o coração financeiro e produtivo do restaurante.

*   `ingredients`: **O que compramos.** Cadastra toda a matéria-prima e embalagens. Guarda o preço atualizado *por unidade de medida*. O campo `yield_coefficient` ajuda a calcular o "preço efetivo" considerando perdas (ex: 1kg de batata suja rende 0.8kg limpa).
*   `ingredients_categories`: **Agrupadores de insumos.** Categorias simples de ingredientes (ex: Hortifruti, Mercearia, Embalagem) usadas para classificar e filtrar dados nas telas de gestão.
*   `recipes`: **O que nós produzimos.** Fichas técnicas de tudo que é feito na cozinha. Pode ser um produto final que vai pra venda (Lasanha) ou um *Pré-preparo* que vira ingrediente de outras receitas (Molho Bechamel). Guarda os dados de rendimento e custo de mão-de-obra.
*   `recipe_ingredients`: **A receita em si.** Tabela de relacionamento que diz: "Para fazer a receita X, usa-se Y gramas do ingrediente Z". Define o custo exato de materiais.
*   `producao_batches`: **O diário da cozinha (Lotes).** Serve para registrar *quando* a cozinha executou uma receita. Ele guarda o total de kg produzido e o tempo gasto naquele lote, permitindo confrontar o *rendimento teórico* da receita com o *rendimento real* que ocorreu na cozinha no dia.
*   `cmv_history`: **A fotografia histórica do custo (Snapshot).** Toda vez que os custos globais oscilam, essa tabela guarda o custo pontual da receita naquela data. Isso evita que o DRE do mês passado mude só porque o tomate ficou caro hoje.

## 🏪 2. Produtos e Precificação (Catálogo Comercial)

Ligam as receitas da cozinha com a vitrine de venda (Bling).

*   `products`: **O que está na prateleira.** Representa o item comercial cadastrado no ERP/Bling (tem SKU, Status, e Preço Base).
*   `product_variations`: **Tamanhos e versões.** Casos onde um mesmo produto base possui variações menores que impactam custo/preço (ainda pouco utilizada/dependente da lógica de negócio final).
*   `product_history`: **Máquina do tempo de produtos.** Guarda o histórico de mudanças no preço base e status no Bling ao longo do tempo.
*   `sales_channels`: **Onde vendemos.** Representa os canais de venda (Site, Ifood, B2B, Feira).
*   `channel_pricing`: **A tabela de preços dinâmicos.** Define que a "Lasanha" (Receita) pode custar R$ 50 no canal "Site" e R$ 40 no canal "PJ - Revenda". Possui gatilhos automáticos para popular preços baseados em regras predefinidas.

## 🛒 3. Vendas e Clientes (Integração de Pedidos)

Onde o dinheiro entra. Totalmente alimentado via integração com o Bling.

*   `customers`: **A clientela.** Pessoas e empresas que compram. Guarda os dados de contato, endereço e documento. A data da última compra (`last_order_date`) é atualizada automaticamente a cada novo pedido importado. *Nota: A coluna antiga `orders` em JSONB foi removida em prol da tabela relacional `orders`.*
*   `orders`: **O cabeçalho do pedido.** Informações gerais de uma venda que desceu do Bling (Para quem foi, de qual canal/loja veio, total financeiro pago, descontos, e datas).
*   `orders_items`: **O detalhe do recibo.** Cada linha de produto dentro do `orders`. Mostra a quantidade e o desconto unitário concedido.

## 🚚 4. Operação e Logística

*   `deliveries`: **O mapa de entregas.** Usado para gerar cotações e rastrear despachos de pedidos via integração de logística (Loggi, Lalamove, etc). Guarda o motorista, status e previsões de horário.

## 🧾 5. Compras e Inteligência Artificial (OCR)

Módulo responsável por ler Notas Fiscais de mercado e atualizar preços automaticamente.

*   `receipts`: **A nota fiscal.** Guarda os dados gerais da foto do cupom fiscal que foi "lido" (Mercado X, Total da compra, status de validação).
*   `receipt_items`: **O que estava escrito na notinha.** Cada produto lido pelo OCR. Inclui `category_suggestion` (palpite da IA sobre de qual categoria de produto se trata) e `verified` (marcador se o humano já validou se a IA acertou o palpite).
*   `product_map`: **O "De-Para" da Inteligência.** É a tabela que ensina a IA com o tempo. Ex: Ensina que toda vez que surgir "FARINHA TRIGO TP1 5KG" em um recibo do Assaí, ela deve vincular ao ingrediente `id` "Farinha" do Pastaz automaticamente.

## 📊 6. Saúde Financeira (DRE)

Faz o cálculo final de sobrevivência do negócio e automação de conciliação.

*   `overhead_config`: **Os custos ocultos.** Cadastro de despesas fixas (Aluguel, Luz, Marketing, Pró-labore). Usado para que o sistema consiga embutir esses gastos passivos no custo da comida e dar o lucro real.
*   `financial_categories`: **Hierarquia Contábil.** Agrupador das despesas (fixas, variáveis, marketing) em estrutura pai/filho. Permite gerar a DRE com subcategorias expansíveis.
*   `expenses_records`: **O livro caixa manual.** Onde são registradas as despesas que não vêm de notas fiscais (ex: condomínio, luz). Todas vinculadas a uma `financial_category`.
*   `payment_gateways_history`: **Automação de Taxas.** Guarda os dados reais de vendas e taxas cobradas pelo Mercado Pago e Stripe. Permite que o fechamento mensal puxe os custos de venda automaticamente via API, sem input manual.
*   `monthly_closing`: **O balancete mensal (O DRE).** É a tabela final onde a mágica acontece. No fim do mês, ela cruza a receita total da `orders` com o CMV da `cmv_history`, as despesas da `expenses_records` e as taxas da `payment_gateways_history`, entregando um formato JSON com o Lucro Líquido e EBITDA exatos.

## ⚙️ 7. Infraestrutura de Integrações (Motores de Fundo)

Tabelas que organizam o fluxo invisível do sistema.

*   `integration_settings`: **As chaves do castelo.** Guarda os Tokens e chaves de API (Bling, Loggi, etc) permitindo que o n8n ou o Backend conectem com outras plataformas de forma segura e configurável.
*   `sync_state`: **O marcador de página.** Ajuda os fluxos do n8n (Bling) a não puxarem tudo do zero de novo. Guarda a `cutoff_date` (data do último pedido processado com sucesso) para baixar só a diferença da próxima vez.
*   `integration_alerts`: **O alarme de incêndio.** Recebe avisos quando algo dá errado nos bastidores. Armazena falhas de sincronicidade ou lógicas, como pedidos que entraram mas os produtos não tinham preços definidos para o canal de venda específico (`channel_pricing`). Alimentada pela rotina de auditoria `fn_check_missing_channel_prices`.
*   `segments`: **Agrupador de retenção.** [Ainda não utilizado]. Tabela pré-planejada para categorizar clientes baseado em comportamento (ex: VIP, Ausente, Recente), cruzando com a recência de pedidos na `orders`.

## 🏭 9. Gestão de Produção (Em Desenvolvimento)

- **`producao_batches`**: Registrará os lotes de produção física, conectando as receitas (`recipes`) à quantidade produzida real (`kg_produzido`), tempo cronometrado e rendimento final, sendo a base para o fechamento de eficiência (OEE) e custos reais. A alimentação não será manual: ela receberá registros automatizados (*auto-backflush*) sempre que houver uma entrada de produto acabado no estoque (Bling).

## 🍎 8. Tabela Nutricional Automática (Anvisa)

Essas tabelas garantem conformidade com a Anvisa calculando macros automaticamente.

*   `nutritional_ref`: **A biblioteca de macros.** Tabela mestre (ex: base da TACO) que dita que 100g de Ovo possui X gramas de proteína e Y kcal. Os ingredientes da cozinha apontam para cá.
*   `recipe_categories`: **Tamanhos obrigatórios da Anvisa.** Guarda qual o tamanho padrão exigido por lei para descrever uma porção de determinada categoria de alimento (ex: Massas Recheadas = 130g).
*   `recipe_nutrition`: **A tabela do rótulo.** O resultado consolidado da soma dos ingredientes pela função matemática do banco. Guarda os totais prontos para impressão por 100g e por Porção (inclusive as colunas para o alerta de açúcar adicionado pela Nova Rotulagem).

> ### 🛑 Acoplamento com Sistema Legado (Bling)
> O banco original foi projetado com dependência do Bling. O dia que a nova *Interface de Vendas (PDV/Site Próprio)* for ligada ao invés do Bling, as seguintes colunas e fluxos precisarão ser substituídos/adaptados:
> 
> 1. **`orders_raw`**: Hoje é a porta de entrada única para pedidos. A trigger desta tabela extrai IDs de Unidades do Bling (Trigger: `trg_map_store_number`). O novo sistema deverá enviar pedidos direto para `orders` ou simular esse payload num padrão agnóstico.
> 2. **Chaves Externas `bling_id`**:
>    - `products.bling_id` / `recipes.bling_id`: Usadas na linha dos itens dos pedidos para puxar custo e referência (Trigger `sync_order_from_orders_raw_row`).
>    - `orders_items.bling_id`
> 3. **Tributação e Formatos de Pedido**: Componentes do fluxo N8N "DRE" buscam a raiz fiscal pelo `d.tributacao` e afins.
> 4. **Tradução Lógica**: Statuses como `id: 9`, `id: 12`, ou unidades de negócio tipo `id: 593810` (que significam Feiras ou Revenda no Bling e são traduzidas para texto no BD). O novo sistema deverá enviar o UUID ou string exata do Canal.
