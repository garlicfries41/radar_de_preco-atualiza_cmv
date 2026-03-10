# Fase 2: Roteio de Processos por Receita — Design

## Modelo de Dados

Nova tabela `recipe_processes`:
- `id` UUID PK
- `recipe_id` UUID FK → recipes
- `process_id` UUID FK → production_processes
- `sort_order` INTEGER (ordem na sequência)
- `time_per_unit_minutes` DECIMAL(8,2) (tempo por unidade da receita)

Cálculo: `slot.duration = quantity × time_per_unit_minutes`
Nome do slot: `"{Recipe.name} — {Process.name}"`

## Cascata de Pré-Preparos

Ao agendar uma receita, o sistema varre seus ingredientes buscando pré-preparos (`is_pre_preparo = true`). Para cada pré-preparo encontrado:

1. Calcula quantidade necessária: `(quantity_receita × ingredient_quantity) / prepreparo_yield`
2. Resultado é fracionário (ex: 2.4 lotes) — NÃO arredonda
3. Gera slots dos processos do pré-preparo com duração proporcional ao lote fracionário
4. Repete recursivamente para sub-pré-preparos (cascata)

Exemplo: Lasanha Funghi × 40un
- Processos diretos da lasanha (40 × time_per_unit)
- Molho Funghi: 2.4 lotes → slots com 2.4 × duração por lote
- Base Funghi: 1.8 lotes → slots com 1.8 × duração por lote

Dados já existentes usados: `recipe_ingredients.quantity`, `recipes.yield_units`, `recipes.is_pre_preparo`.

## Catálogo de Processos (expandido)

Seção "Receitas e seus Processos" abaixo da lista de processos existente.
Cards expansíveis por receita mostrando processos em sequência com totais estimados.
Permite adicionar/remover/reordenar processos por receita.
Pré-preparos aparecem como sub-árvore indentada no card da receita.

## Agendamento por Receita

Modal "Agendar Lote":
1. Dropdown de receitas (excluindo `is_pre_preparo = true`)
2. Campo quantidade pré-preenchido com `yield_units` da receita
3. Preview dos slots incluindo pré-preparos em cascata com quantidades fracionárias
4. Ao confirmar: cria todas as entradas no `production_schedule`, na fila "Não agendado"

Cada slot gerado leva o nome da receita de origem para identificação visual.

Fluxo avulso (sem receita) continua disponível.
