# Spec: Chain Links de Processos + Expansão de Layout

**Data:** 2026-03-14
**Status:** Aprovado

---

## Contexto

O módulo de Produção permite cadastrar processos vinculados a receitas e agendá-los no calendário semanal. Atualmente, ao agendar um lote via "Por Receita", todos os slots aparecem na fila "Não Agendado" e precisam ser arrastados um a um para o calendário. Além disso, toda a interface é limitada a `max-w-5xl` (1024px), deixando muito espaço desperdiçado em telas largas.

---

## Feature 1: Expansão de Layout Global

### Problema
O `AppShell` aplica `max-w-5xl mx-auto` ao `<main>`, limitando todo o conteúdo a 1024px. Em monitores desktop isso desperdiça metade da tela.

### Solução

**AppShell.tsx:**
- Trocar `max-w-5xl` por `max-w-[1600px]`
- Manter `mx-auto`, paddings e demais classes

**CatalogoView.tsx — lista de receitas:**
- Trocar a lista de cards de coluna única para grid responsivo de 3 colunas
- Classes: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
- Cada card de receita (expandido ou não) ocupa sua célula no grid

---

## Feature 2: Chain Links de Processos

### Problema
Ao agendar um lote de receita, o usuário precisa arrastar cada slot individualmente para o calendário. Não há forma de definir que certos processos sempre devem se mover juntos em sequência.

### Solução

Processos dentro de uma receita podem ser marcados como "linkados" (chain group). Ao agendar, o grupo propaga para o calendário. No calendário, arrastar qualquer slot do grupo posiciona todos os outros em sequência.

---

## Banco de Dados

### Migração SQL

```sql
-- recipe_processes: identificador de grupo de chain
ALTER TABLE recipe_processes
ADD COLUMN IF NOT EXISTS chain_group_id uuid NULL;

-- production_schedule: propaga o grupo ao agendar
ALTER TABLE production_schedule
ADD COLUMN IF NOT EXISTS chain_group_id uuid NULL;
```

Sem constraints de FK — o UUID é gerado no frontend/backend como identificador de agrupamento lógico.

---

## Backend

### Endpoints existentes (sem alteração de assinatura)

**`PUT /api/recipe-processes/{rp_id}`** — já aceita campos parciais via `RecipeProcessUpdate`. Adicionar `chain_group_id: Optional[str]` ao modelo Pydantic. **Importante:** a linha `payload = {k: v for k, v in data.model_dump().items() if v is not None}` deve ser trocada por `data.model_dump(exclude_unset=True)` — caso contrário `chain_group_id: null` (deslinkar) é filtrado e nunca persiste.

**`POST /api/production/schedule-recipe`** — propagar `chain_group_id` de `recipe_processes` para as entradas criadas em `production_schedule`:

```python
entry = {
    ...
    "chain_group_id": slot.get("chain_group_id"),  # novo
}
```

**`GET /api/recipes/{recipe_id}/processes`** — já retorna `recipe_processes.*`; após a migração, `chain_group_id` vem automaticamente no join.

**`PUT /api/production/schedule/{id}`** — já existe para atualizar entradas. Sem alteração.

### resolve_recipe_slots
Adicionar `chain_group_id` ao dicionário de cada slot retornado, para que `schedule-recipe` possa propagá-lo.

---

## Tipos TypeScript (useProduction.ts)

Adicionar `chain_group_id?: string | null` a:
- Interface `RecipeProcess`
- Interface `ProductionSchedule`

Atualizar `updateRecipeProcess` para aceitar o campo:
```typescript
data: { sort_order?: number; time_per_unit_minutes?: number; chain_group_id?: string | null }
```

---

## Frontend — CatalogoView (Catálogo de Receitas)

### Modo Seleção

- Cada receita expandida tem um botão **"Selecionar"** no header da lista de processos
- Ao clicar: checkboxes aparecem à esquerda de cada `SortableProcessRow`; botões de ação de link surgem no rodapé da lista

### Ações de Link

Com 2 ou mais processos selecionados:
- **"Linkar" (ícone corrente fechada):** gera `crypto.randomUUID()`, chama `updateRecipeProcess` para cada processo selecionado com o novo `chain_group_id`
- **"Deslinkar" (ícone corrente aberta):** chama `updateRecipeProcess` com `chain_group_id: null` para cada selecionado

### Visualização de Grupos

Processos do mesmo `chain_group_id` dentro de uma receita:
- Mostram ícone de corrente fechada (🔗) ao lado do nome
- Processos consecutivos do mesmo grupo têm uma linha conectora vertical entre eles (borda esquerda colorida contínua, cor baseada no group ID para distinguir múltiplos grupos)

### Estado Local

```typescript
interface ChainSelection {
  recipeId: string;
  selectedRpIds: Set<string>;
  active: boolean;
}
```

Armazenado em `useState` dentro de `CatalogoView`. Limpo ao fechar a receita ou confirmar a ação.

---

## Frontend — AgendaView / TimeSlot (Calendário)

### Visualização

Slots de `production_schedule` com mesmo `chain_group_id` e mesmo `planned_date` (o escopo do chain é sempre dentro do mesmo dia — slots do mesmo grupo em datas diferentes movem-se independentemente):
- Mostram ícone de corrente fechada no canto do card
- Uma linha conectora sutil entre cards consecutivos do grupo na coluna do dia

### Comportamento de Drag

Quando o usuário arrasta um slot linkado da fila "Não Agendado" para o calendário:
1. O slot arrastado recebe o `start_time` do ponto de drop
2. Os demais slots do mesmo chain (mesmo `planned_date`) são ordenados por `sort_order` (herdado de `recipe_processes`) e posicionados em sequência: cada um começa no horário de término do anterior
3. Todos os `start_time` são salvos via `updateScheduleEntry` em paralelo

Quando o usuário move um slot **já agendado** (que está em um chain):
- O mesmo comportamento: reposiciona o grupo inteiro em sequência a partir do novo horário

### Quebrar Link

No menu de contexto (hover) de um slot linkado, botão **"Quebrar link"**:
- Chama `updateScheduleEntry(id, { chain_group_id: null })`
- O slot passa a se mover independentemente
- Os demais slots do grupo não são afetados

---

## Fluxo Completo (end-to-end)

```
1. Usuário abre receita no Catálogo → entra em modo seleção
2. Seleciona processos A, B, C → clica "Linkar"
   → recipe_processes A, B, C recebem chain_group_id = "uuid-1"
3. Usuário agenda lote via "Por Receita"
   → schedule-recipe cria 3 entradas em production_schedule com chain_group_id = "uuid-1"
   → entradas aparecem na fila "Não Agendado" com ícone de corrente
4. Usuário arrasta slot A para 07:00 de segunda-feira
   → A: start_time = 07:00
   → B: start_time = 07:00 + duração(A)
   → C: start_time = start_time(B) + duração(B)
5. Usuário decide mover apenas o slot C
   → clica "Quebrar link" em C
   → C.chain_group_id = null
   → arrasta C para 10:00 independentemente
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `migrations/chain_links.sql` | Nova migração com ALTER TABLE |
| `backend/main.py` | `RecipeProcessUpdate` + `resolve_recipe_slots` + `schedule-recipe` |
| `frontend/src/components/features/AppShell.tsx` | `max-w-5xl` → `max-w-[1600px]` |
| `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx` | Grid 3 colunas + modo seleção + UI de chain |
| `frontend/src/modules/ProducaoModule/hooks/useProduction.ts` | `RecipeProcess`, `ProductionSchedule` e `updateRecipeProcess` com `chain_group_id` |
| `frontend/src/modules/ProducaoModule/components/agenda/AgendaView.tsx` | Drag com propagação de chain |
| `frontend/src/modules/ProducaoModule/components/agenda/TimeSlot.tsx` | Ícone de corrente + botão quebrar link |

---

## Fora de Escopo

- Chains entre receitas diferentes
- Reordenar a sequência do chain no calendário (ordem vem de `sort_order` da receita)
- Nomear grupos de chain
