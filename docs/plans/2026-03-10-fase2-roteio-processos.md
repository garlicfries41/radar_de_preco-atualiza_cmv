# Fase 2: Roteio de Processos por Receita — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir vincular processos de produção a receitas e agendar receitas inteiras (com cascata automática de pré-preparos) ao invés de processos individuais.

**Architecture:** Nova tabela `recipe_processes` vincula processos a receitas com ordem e tempo por unidade. Backend expõe endpoints CRUD para essa tabela + endpoint de "resolução" que calcula slots (incluindo pré-preparos em cascata). Frontend expande o Catálogo para gerenciar vínculos e o modal de agendamento para agendar por receita.

**Tech Stack:** Python/FastAPI backend, Supabase/PostgreSQL, React/TypeScript frontend, API REST existente.

---

### Task 1: Criar tabela `recipe_processes` no banco

**Files:**
- Create: `migrations/recipe_processes.sql`

**Step 1: Escrever a migration**

```sql
CREATE TABLE IF NOT EXISTS recipe_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES production_processes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    time_per_unit_minutes DECIMAL(8,2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recipe_processes_recipe ON recipe_processes(recipe_id);
```

**Step 2: Executar no Supabase**

Rodar via Supabase dashboard SQL editor ou via CLI.

**Step 3: Commit**

```bash
git add migrations/recipe_processes.sql
git commit -m "feat: add recipe_processes table migration"
```

---

### Task 2: Backend — Model e Schema para `recipe_processes`

**Files:**
- Modify: `backend/models.py` (adicionar model)
- Modify: `backend/main.py` (adicionar schema Pydantic)

**Step 1: Adicionar SQLModel em `backend/models.py`**

Após o model `RecipeIngredient`, adicionar:

```python
class RecipeProcess(SQLModel, table=True):
    __tablename__ = "recipe_processes"

    id: Optional[str] = Field(default=None, primary_key=True)
    recipe_id: str = Field(foreign_key="recipes.id")
    process_id: str = Field(foreign_key="production_processes.id")
    sort_order: int = Field(default=0)
    time_per_unit_minutes: Decimal = Field(default=Decimal("1.0"))
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
```

**Step 2: Adicionar Pydantic schema em `backend/main.py`**

Após `ProductionProcessInput`, adicionar:

```python
class RecipeProcessInput(BaseModel):
    recipe_id: str
    process_id: str
    sort_order: int = 0
    time_per_unit_minutes: float = 1.0

class RecipeProcessUpdate(BaseModel):
    sort_order: Optional[int] = None
    time_per_unit_minutes: Optional[float] = None
```

**Step 3: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add RecipeProcess model and schemas"
```

---

### Task 3: Backend — Endpoints CRUD para `recipe_processes`

**Files:**
- Modify: `backend/main.py`

**Step 1: Adicionar endpoints**

```python
# --- Recipe Processes CRUD ---

@app.get("/api/recipes/{recipe_id}/processes")
async def get_recipe_processes(recipe_id: str):
    """Lista processos vinculados a uma receita, ordenados por sort_order."""
    result = supabase.table("recipe_processes") \
        .select("*, production_processes(id, name, expected_duration_minutes)") \
        .eq("recipe_id", recipe_id) \
        .order("sort_order") \
        .execute()
    return result.data

@app.post("/api/recipes/{recipe_id}/processes")
async def add_recipe_process(recipe_id: str, data: RecipeProcessInput):
    """Vincula um processo a uma receita."""
    payload = data.model_dump()
    payload["recipe_id"] = recipe_id
    result = supabase.table("recipe_processes").insert(payload).execute()
    return result.data[0] if result.data else {}

@app.put("/api/recipe-processes/{rp_id}")
async def update_recipe_process(rp_id: str, data: RecipeProcessUpdate):
    """Atualiza sort_order ou time_per_unit_minutes."""
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    result = supabase.table("recipe_processes").update(payload).eq("id", rp_id).execute()
    return result.data[0] if result.data else {}

@app.delete("/api/recipe-processes/{rp_id}")
async def delete_recipe_process(rp_id: str):
    """Remove vínculo processo-receita."""
    supabase.table("recipe_processes").delete().eq("id", rp_id).execute()
    return {"ok": True}
```

**Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: add CRUD endpoints for recipe_processes"
```

---

### Task 4: Backend — Endpoint de resolução de slots (com cascata de pré-preparos)

**Files:**
- Modify: `backend/main.py`

**Step 1: Adicionar endpoint de resolução**

```python
@app.get("/api/recipes/{recipe_id}/resolve-slots")
async def resolve_recipe_slots(recipe_id: str, quantity: float):
    """
    Dado uma receita e quantidade, retorna a lista completa de slots
    incluindo pré-preparos em cascata. Não salva nada — apenas calcula.
    """
    slots = []
    visited = set()  # evita loops circulares

    async def resolve(rid: str, qty: float, parent_name: str = ""):
        if rid in visited:
            return
        visited.add(rid)

        # Buscar receita
        recipe_res = supabase.table("recipes").select("*").eq("id", rid).single().execute()
        recipe = recipe_res.data
        recipe_name = recipe["name"]
        yield_units = float(recipe["yield_units"]) if recipe["yield_units"] else 1.0

        # Buscar processos da receita
        rp_res = supabase.table("recipe_processes") \
            .select("*, production_processes(id, name, expected_duration_minutes)") \
            .eq("recipe_id", rid) \
            .order("sort_order") \
            .execute()

        for rp in (rp_res.data or []):
            proc = rp["production_processes"]
            duration = round(qty * float(rp["time_per_unit_minutes"]), 1)
            label = f"{recipe_name} — {proc['name']}"
            if parent_name:
                label = f"[{parent_name}] {label}"
            slots.append({
                "recipe_id": rid,
                "recipe_name": recipe_name,
                "process_id": proc["id"],
                "process_name": proc["name"],
                "label": label,
                "duration_minutes": duration,
                "quantity": qty,
                "is_sub_preparo": bool(parent_name),
                "sort_order": rp["sort_order"],
            })

        # Buscar ingredientes que são pré-preparos (cascata)
        ing_res = supabase.table("recipe_ingredients") \
            .select("*, ingredients(id, name, current_price, category)") \
            .eq("recipe_id", rid) \
            .execute()

        for ing in (ing_res.data or []):
            ingredient = ing.get("ingredients", {})
            if ingredient.get("category") != "Pré-preparo":
                continue
            # Encontrar a receita do pré-preparo via derived_ingredient_id
            pp_res = supabase.table("recipes") \
                .select("id, name, yield_units, is_pre_preparo") \
                .eq("derived_ingredient_id", ingredient["id"]) \
                .eq("is_pre_preparo", True) \
                .execute()
            if not pp_res.data:
                continue
            pp_recipe = pp_res.data[0]
            pp_yield = float(pp_recipe["yield_units"]) if pp_recipe["yield_units"] else 1.0
            # Quantidade necessária do pré-preparo (lote fracionário)
            needed_amount = qty * float(ing["quantity"]) / yield_units
            pp_qty = needed_amount / pp_yield * pp_yield  # manter em unidades do pré-preparo
            # Simplificando: pp_qty = qty * ing_quantity / yield_units
            pp_qty_units = needed_amount  # quantidade em unidades de medida do ingrediente
            # Converter para "unidades de lote" do pré-preparo
            lots = needed_amount / pp_yield
            pp_final_qty = lots * pp_yield  # = needed_amount (mantém fracionário)

            await resolve(pp_recipe["id"], pp_final_qty, parent_name=recipe_name)

    await resolve(recipe_id, quantity)
    return {"slots": slots, "total_minutes": sum(s["duration_minutes"] for s in slots)}
```

**Step 2: Testar manualmente**

```
GET /api/recipes/{id}/resolve-slots?quantity=40
```

Deve retornar lista de slots com processos diretos + pré-preparos em cascata.

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add resolve-slots endpoint with cascading pre-preparo support"
```

---

### Task 5: Backend — Endpoint de agendamento em lote por receita

**Files:**
- Modify: `backend/main.py`

**Step 1: Adicionar endpoint de bulk schedule**

```python
class BulkScheduleInput(BaseModel):
    recipe_id: str
    quantity: float
    planned_date: str  # yyyy-MM-dd

@app.post("/api/production/schedule-recipe")
async def schedule_recipe(data: BulkScheduleInput):
    """
    Agenda uma receita inteira: resolve slots (com cascata) e cria
    todas as entradas em production_schedule de uma vez.
    """
    # Resolver slots
    import httpx
    # Reusar a lógica diretamente
    slots_response = await resolve_recipe_slots(data.recipe_id, data.quantity)
    slots = slots_response["slots"]

    created = []
    for slot in slots:
        entry = {
            "planned_date": data.planned_date,
            "process_id": slot["process_id"],
            "custom_item_name": slot["label"],
            "duration_minutes": max(1, round(slot["duration_minutes"])),
            "status": "pending",
            # start_time fica null → aparece na fila "Não agendado"
        }
        result = supabase.table("production_schedule").insert(entry).execute()
        if result.data:
            created.append(result.data[0])

    return {"created": len(created), "entries": created}
```

**Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: add bulk schedule-recipe endpoint"
```

---

### Task 6: Frontend — Tipos e hook para recipe_processes

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/hooks/useProduction.ts`

**Step 1: Adicionar interfaces**

Após `ProductionSchedule`, adicionar:

```typescript
export interface RecipeProcess {
    id: string;
    recipe_id: string;
    process_id: string;
    sort_order: number;
    time_per_unit_minutes: number;
    production_processes?: { id: string; name: string; expected_duration_minutes: number };
}

export interface RecipeSummary {
    id: string;
    name: string;
    yield_units: number;
    is_pre_preparo: boolean;
}

export interface ResolvedSlot {
    recipe_id: string;
    recipe_name: string;
    process_id: string;
    process_name: string;
    label: string;
    duration_minutes: number;
    quantity: number;
    is_sub_preparo: boolean;
    sort_order: number;
}
```

**Step 2: Adicionar funções no hook**

```typescript
const fetchRecipes = useCallback(async (): Promise<RecipeSummary[]> => {
    try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/recipes`);
        if (!res.ok) throw new Error('Erro ao buscar receitas');
        const data = await res.json();
        return data;
    } catch (err: any) {
        setError(err.message);
        console.error(err);
        return [];
    } finally {
        setLoading(false);
    }
}, []);

const fetchRecipeProcesses = useCallback(async (recipeId: string): Promise<RecipeProcess[]> => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/processes`);
        if (!res.ok) throw new Error('Erro ao buscar processos da receita');
        return await res.json();
    } catch (err: any) {
        setError(err.message);
        return [];
    } finally {
        setLoading(false);
    }
}, []);

const addRecipeProcess = useCallback(async (recipeId: string, data: { process_id: string; sort_order: number; time_per_unit_minutes: number }) => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/processes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, recipe_id: recipeId }),
        });
        if (!res.ok) throw new Error('Erro ao vincular processo');
        return await res.json();
    } catch (err: any) {
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}, []);

const deleteRecipeProcess = useCallback(async (rpId: string) => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/recipe-processes/${rpId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao remover vínculo');
        return true;
    } catch (err: any) {
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}, []);

const updateRecipeProcess = useCallback(async (rpId: string, data: { sort_order?: number; time_per_unit_minutes?: number }) => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/recipe-processes/${rpId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Erro ao atualizar vínculo');
        return await res.json();
    } catch (err: any) {
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}, []);

const resolveRecipeSlots = useCallback(async (recipeId: string, quantity: number): Promise<{ slots: ResolvedSlot[]; total_minutes: number }> => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/resolve-slots?quantity=${quantity}`);
        if (!res.ok) throw new Error('Erro ao resolver slots');
        return await res.json();
    } catch (err: any) {
        setError(err.message);
        return { slots: [], total_minutes: 0 };
    } finally {
        setLoading(false);
    }
}, []);

const scheduleRecipe = useCallback(async (data: { recipe_id: string; quantity: number; planned_date: string }) => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/production/schedule-recipe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Erro ao agendar receita');
        return await res.json();
    } catch (err: any) {
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}, []);
```

**Step 3: Adicionar ao return do hook**

```typescript
return {
    // ... existentes ...
    fetchRecipes,
    fetchRecipeProcesses,
    addRecipeProcess,
    updateRecipeProcess,
    deleteRecipeProcess,
    resolveRecipeSlots,
    scheduleRecipe,
};
```

**Step 4: Commit**

```bash
git add frontend/src/modules/ProducaoModule/hooks/useProduction.ts
git commit -m "feat: add recipe-process types and hook functions"
```

---

### Task 7: Frontend — Expandir CatalogoView com seção de Receitas

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

**Step 1: Adicionar seção de receitas com cards expansíveis**

Abaixo da lista de processos existente, adicionar uma segunda seção "Receitas e seus Processos". Cada receita é um card que expande para mostrar os processos vinculados em ordem, com:
- Nome do processo + tempo por unidade
- Total estimado (yield_units × time_per_unit)
- Botões para adicionar/remover processos
- Indicação visual de pré-preparos em cascata

O card da receita mostra:
```
┌─ Lasanha de Costela (40 un) ──────── [▼ Expandir] ─┐
│  1. Montagem    1.2 min/un  [48 min]    [✏️] [🗑️]  │
│  2. Forneamento 0.8 min/un  [32 min]    [✏️] [🗑️]  │
│  3. Rotulagem   0.3 min/un  [12 min]    [✏️] [🗑️]  │
│  Total: 1h 32min           [+ Adicionar processo]   │
└──────────────────────────────────────────────────────┘
```

Usar `fetchRecipes()` para listar receitas (filtrar `is_pre_preparo === false`).
Usar `fetchRecipeProcesses(recipeId)` ao expandir um card.
Usar `addRecipeProcess()` / `deleteRecipeProcess()` para gerenciar vínculos.

**Step 2: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: expand CatalogoView with recipe-process management"
```

---

### Task 8: Frontend — Modal "Agendar por Receita" na AgendaView

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/agenda/AgendaView.tsx`

**Step 1: Adicionar modo "Por Receita" ao modal**

O modal "Agendar Lote" ganha duas abas internas ou um toggle:
- **Tarefa Avulsa** (fluxo atual, mantido)
- **Por Receita** (novo fluxo)

Fluxo "Por Receita":
1. Dropdown de receitas (filtro `is_pre_preparo === false`)
2. Campo quantidade pré-preenchido com `yield_units` da receita selecionada
3. Ao mudar receita ou quantidade: chama `resolveRecipeSlots(recipeId, quantity)`
4. Mostra preview dos slots (incluindo pré-preparos) com duração calculada
5. Botão "Agendar" chama `scheduleRecipe({ recipe_id, quantity, planned_date })`
6. Recarrega a semana

Preview dentro do modal:
```
Processos diretos:
  ☐ Lasanha Funghi — Montagem        48 min
  ☐ Lasanha Funghi — Forneamento     32 min
  ☐ Lasanha Funghi — Rotulagem       12 min

Pré-preparos:
  ☐ [Lasanha Funghi] Molho Funghi — Cocção    108 min
  ☐ [Lasanha Funghi] Molho Funghi — Resfriamento 72 min
  ☐ [Lasanha Funghi] Base Funghi — Hidratação   216 min

Total: 8h 8min · 6 slots serão criados
```

**Step 2: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/agenda/AgendaView.tsx
git commit -m "feat: add schedule-by-recipe flow to AgendaView modal"
```

---

### Task 9: Verificação visual e deploy

**Step 1: Testar localmente**

```bash
cd frontend && npm run dev
```

Verificar:
- [ ] Catálogo mostra lista de processos + seção de receitas
- [ ] Cards de receitas expandem mostrando processos vinculados
- [ ] Pode adicionar/remover processos de uma receita
- [ ] Modal "Agendar Lote" tem opção "Por Receita"
- [ ] Dropdown filtra pré-preparos
- [ ] Preview mostra slots com cascata de pré-preparos
- [ ] Ao confirmar: slots aparecem na fila "Não agendado" com nome da receita
- [ ] Slots são arrastáveis normalmente na grade

**Step 2: Commit final e push**

```bash
git add -A
git commit -m "feat: fase 2 - roteio de processos por receita com cascata de pre-preparos"
git push origin feat/agenda-visual
```
