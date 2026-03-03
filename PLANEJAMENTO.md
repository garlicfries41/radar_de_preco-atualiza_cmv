# Projeto: Radar de Preço - Atualiza CMV
Status: Em Planejamento (Adição de Peso Líquido)

## Motivação
O usuário identificou a necessidade de rastrear o **Peso Líquido** do produto final (receita), que pode diferir da soma dos pesos brutos dos ingredientes devido ao processo de produção. Esta informação é vital para cálculos precisos de CMV e engenharia de cardápio.

## Contexto e Ideias
- Atualmente existe apenas o campo `total_weight_kg` na tabela `recipes`, calculado automaticamente como a soma dos ingredientes.
- O usuário deseja inserir o Peso Líquido manualmente durante o cadastro da receita.
- Precisamos decidir se o CMV por kg deve usar o Peso Líquido (se disponível) ou manter o peso bruto.

## Arquitetura e Decisões
- Adicionar coluna `net_weight` na tabela `recipes` (Supabase).
- Refletir este campo nos modelos SQLModel (`backend/models.py`).
- Atualizar o endpoint de criação/atualização de receitas (`backend/main.py`) para aceitar e salvar este valor.
- Atualizar a interface de formulário de receita (`frontend/src/components/features/RecipeForm.tsx`) para incluir o campo.

## Plano de Ação
1. [ ] Executar script SQL para adicionar `net_weight` à tabela `recipes`.
2. [ ] Atualizar `backend/models.py`.
3. [ ] Atualizar `backend/main.py` (Pydantic models e lógica de persistência).
4. [ ] Atualizar `frontend/src/types/index.ts`.
5. [ ] Adicionar campo no `RecipeForm.tsx`.
6. [ ] Validar salvamento e exibição.
