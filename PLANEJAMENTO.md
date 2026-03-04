# Projeto: Radar de Preço - Atualiza CMV
Status: Estabilização e Refinamento de Lógica B2B

## Motivação
Refinar as regras de negócio para produção B2B e simplificar o gerenciamento de categorias removendo lógicas redundantes (`default_net_weight`).

## Contexto e Ideias
- **Remoção de default_net_weight:** Identificado como desnecessário, causava confusão no cálculo automático. Lógica removida em favor de preenchimento manual no formulário.
- **Lógica B2B [b2b]:** Embalagens para produtos B2B devem ser calculadas na proporção de 1 para cada 2,5 unidades de rendimento (frações).
- **Tabela Nutricional ANVISA:** Ajustada para exibir colunas de Porção e 100g simultaneamente.

## Arquitetura e Decisões
- Exclusão da tabela `categories_portions` (substituída pela lógica direta em `recipe_categories`).
- Implementação de detecção automática de B2B via nome da receita (`name.includes('B2B')`).
- Cálculo de multiplicador de embalagem no frontend e backend sincronizado: `yield / 2.5` se B2B.

## Plano de Ação (Concluído)
1. [x] Remover `default_net_weight` do backend e frontend.
2. [x] Excluir tabela `categories_portions` via SQL.
3. [x] Ajustar detector `isB2B` para ser case-insensitive e inclusivo ([B2B]).
4. [x] Implementar multiplicador `2.5` para embalagens B2B no Sidebar e no salvamento.
5. [x] Corrigir alerta de dados nutricionais no frontend (ignorando pré-preparos e embalagens).
6. [x] Garantir salvamento de `category_id` (ANVISA) no backend.
