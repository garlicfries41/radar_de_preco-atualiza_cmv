# Planejamento: Radar de Preço & CMV

## Motivação e Objetivo Central
O projeto "Radar de Preço_Atualiza CMV" lida com gestão de custos e análise de recibos. A expansão atual envolve a **Engenharia de Cardápio e Tabelas Nutricionais**. O objetivo é que **Pré-preparos** (que são receitas intermediárias usadas como ingredientes de outras receitas) tenham suas tabelas nutricionais calculadas e salvas automaticamente. 

## Contexto e Ideias Discutidas
- O usuário pontuou que os pré-preparos estavam sendo ignorados na tela de receita em relação ao aviso de falta de informações nutricionais, pois um pré-preparo é feito de outros ingredientes.
- Decidimos abordar o problema via **Materialização** no Backend: quando um pré-preparo é salvo, o backend soma a nutrição de toda a panela, converte para uma amostra de 100g baseada no rendimento (Peso Total), e então cria/atualiza um registro correspondente na tabela `nutritional_ref`. O ingrediente derivado desse pré-preparo recebe o `nutritional_ref_id`.
- Dessa forma, qualquer receita que use o pré-preparo como ingrediente poderá ler a base de 100g sem precisar re-calcular a árvore de ingredientes de forma pesada e recursiva.

## Direções Arquiteturais
- **FastAPI Backend (`main.py`)**: 
  - Ao executar `create_recipe` ou `update_recipe` com `is_pre_preparo=True`, buscar no banco (`nutritional_ref`) os dados vitais de todos os itens em `payload.ingredients`.
  - Computar totais (Kcal, Carbo, Proteínas, Lipídios, etc.).
  - Dividir pelo `total_weight_kg` para chegar nos valores exatos de uma fração de 100g.
  - Fazer `upsert` na tabela `nutritional_ref` com nome = "Pré-preparo: NOME_DA_RECEITA".
  - Obter o ID gerado (ou reciclar caso já tenha ref linkado).
  - Atualizar o `derived_ingredient` recém-criado com esse `nutritional_ref_id`.

## Plano de Ação Atual
1. [ ] Analisar os campos exatos da tabela `nutritional_ref` no Supabase.
2. [ ] Criar no backend uma lógica em Python para converter a soma de N ingredientes para 100g da quantidade do rendimento total da receita.
3. [ ] Integrar essa conta à criação / edição de Receitas (`main.py`).
4. [ ] Inserir os dados na tabela e atrelar `nutritional_ref_id` ao `derived_ingredient`.
5. [ ] Garantir que erros simples de CLI não impeçam o dev. Alertar o usuário sobre o modo correto de fazer o restart no VPS (usando docker-compose ou ativando venv).
