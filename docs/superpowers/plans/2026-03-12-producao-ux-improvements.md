# Producao UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 UX improvements to the production module: drag & drop reorder, labor/wait type, calendar overlap, time measurement tracking, and global process panel.

**Architecture:** Database-first approach. Add columns to `production_processes` via SQL migration, update FastAPI endpoints, then update React frontend. Each feature is independent and can be committed separately.

**Tech Stack:** PostgreSQL (Supabase), FastAPI (Python), React + TypeScript + @dnd-kit + Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-12-producao-ux-improvements-design.md`

---

## Chunk 1: Database Migration + Backend

### Task 1: Database Migration

**Files:**
- Create: `migrations/production_processes_enhancements.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/production_processes_enhancements.sql
-- Add process_type, time_source, and measured_at to production_processes

ALTER TABLE production_processes
ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'labor';

ALTER TABLE production_processes
ADD CONSTRAINT chk_process_type CHECK (process_type IN ('labor', 'wait'));

ALTER TABLE production_processes
ADD COLUMN IF NOT EXISTS time_source text NOT NULL DEFAULT 'estimated';

ALTER TABLE production_processes
ADD CONSTRAINT chk_time_source CHECK (time_source IN ('measured', 'estimated'));

ALTER TABLE production_processes
ADD COLUMN IF NOT EXISTS measured_at timestamptz NULL;
```

- [ ] **Step 2: Apply migration**

Run the migration against Supabase. The project uses direct SQL execution:

```bash
# Execute via Supabase MCP or directly in Supabase SQL editor
```

- [ ] **Step 3: Commit**

```bash
git add migrations/production_processes_enhancements.sql
git commit -m "feat: add process_type, time_source, measured_at columns to production_processes"
```

### Task 2: Update Backend Pydantic Model

**Files:**
- Modify: `backend/main.py:101-104` (ProductionProcessInput)

- [ ] **Step 1: Update ProductionProcessInput**

At `backend/main.py:101`, update the model:

```python
class ProductionProcessInput(BaseModel):
    name: str
    expected_duration_minutes: int
    yield_notes: Optional[str] = None
    process_type: Optional[str] = "labor"
    time_source: Optional[str] = "estimated"
    measured_at: Optional[str] = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: add process_type, time_source, measured_at to ProductionProcessInput"
```

### Task 3: Update Backend Endpoints for New Fields

**Files:**
- Modify: `backend/main.py:1293-1307` (list_production_processes)
- Modify: `backend/main.py:1446+` (update_process_cascade)

- [ ] **Step 1: Update list endpoint to return new fields**

The `list_production_processes` at line 1293 already does `select("*")`, so new columns are automatically returned. No change needed.

- [ ] **Step 2: Update update_process_cascade to accept new fields**

At `backend/main.py:1446`, the `update_process_cascade` function currently accepts `name` and `time_per_unit_minutes`. Update to also handle `process_type`, `time_source`, `measured_at`:

```python
@app.put("/api/production/processes/{process_id}/update-cascade")
def update_process_cascade(process_id: str, data: dict):
    new_name = data.get("name")
    new_time_per_unit = data.get("time_per_unit_minutes")
    new_process_type = data.get("process_type")
    new_time_source = data.get("time_source")
    new_measured_at = data.get("measured_at")

    update_payload = {}
    if new_name:
        update_payload["name"] = new_name
    if new_time_per_unit is not None:
        update_payload["expected_duration_minutes"] = round(new_time_per_unit)
    if new_process_type is not None:
        update_payload["process_type"] = new_process_type
    if new_time_source is not None:
        update_payload["time_source"] = new_time_source
        if new_time_source == "measured" and not new_measured_at:
            update_payload["measured_at"] = datetime.now(timezone.utc).isoformat()
        elif new_time_source == "estimated":
            update_payload["measured_at"] = None
    if new_measured_at:
        update_payload["measured_at"] = new_measured_at

    if update_payload:
        update_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("production_processes").update(update_payload).eq("id", process_id).execute()

    if new_time_per_unit is not None:
        supabase.table("recipe_processes") \
            .update({"time_per_unit_minutes": new_time_per_unit}) \
            .eq("process_id", process_id) \
            .execute()

    return {"ok": True}
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: backend supports process_type, time_source, measured_at in cascade update"
```

### Task 4: Add Bulk Reorder Endpoint

**Files:**
- Modify: `backend/main.py` (add new endpoint before the generic recipe route)

- [ ] **Step 1: Add reorder endpoint**

Add BEFORE the `@app.get("/api/recipes/{recipe_id}")` route (which is at line ~814 area — must be before the generic catch-all). Place it near the other recipe-processes endpoints:

```python
@app.put("/api/recipes/{recipe_id}/reorder-processes")
def reorder_recipe_processes(recipe_id: str, data: dict):
    """Bulk update sort_order for processes in a recipe."""
    try:
        process_ids = data.get("process_ids", [])
        for idx, rp_id in enumerate(process_ids):
            supabase.table("recipe_processes") \
                .update({"sort_order": idx}) \
                .eq("id", rp_id) \
                .eq("recipe_id", recipe_id) \
                .execute()
        return {"ok": True}
    except Exception as e:
        logger.error(f"Error reordering processes: {e}")
        raise HTTPException(500, f"Erro ao reordenar processos: {str(e)}")
```

**IMPORTANT:** This route MUST be registered before `@app.get("/api/recipes/{recipe_id}")` to avoid FastAPI route shadowing.

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: add PUT /api/recipes/{recipe_id}/reorder-processes endpoint"
```

---

## Chunk 2: Frontend Hook + Interfaces

### Task 5: Update useProduction Hook

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/hooks/useProduction.ts`

- [ ] **Step 1: Update ProductionProcess interface**

At line 4, update the interface:

```typescript
export interface ProductionProcess {
    id: string;
    name: string;
    expected_duration_minutes: number;
    yield_notes?: string;
    default_time_per_unit?: number | null;
    process_type: 'labor' | 'wait';
    time_source: 'measured' | 'estimated';
    measured_at?: string | null;
}
```

- [ ] **Step 2: Update RecipeProcess interface to include new fields from join**

At line 12, update:

```typescript
export interface RecipeProcess {
    id: string;
    recipe_id: string;
    process_id: string;
    sort_order: number;
    time_per_unit_minutes: number;
    production_processes?: {
        id: string;
        name: string;
        expected_duration_minutes: number;
        process_type: 'labor' | 'wait';
        time_source: 'measured' | 'estimated';
        measured_at?: string | null;
    };
}
```

- [ ] **Step 3: Add reorderRecipeProcesses function**

Add after `updateRecipeProcess` (line ~288):

```typescript
const reorderRecipeProcesses = useCallback(async (recipeId: string, processIds: string[]) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/reorder-processes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ process_ids: processIds }),
        });
        if (!res.ok) throw new Error('Erro ao reordenar processos');
        return await res.json();
    } catch (err: any) {
        setError(err.message);
        throw err;
    }
}, []);
```

- [ ] **Step 4: Update updateProcessCascade parameter type**

At line ~347, update the `data` parameter type:

```typescript
const updateProcessCascade = useCallback(async (processId: string, data: {
    name?: string;
    time_per_unit_minutes?: number;
    process_type?: 'labor' | 'wait';
    time_source?: 'measured' | 'estimated';
    measured_at?: string | null;
}) => {
```

- [ ] **Step 5: Add reorderRecipeProcesses to return object**

In the return statement (~line 365), add `reorderRecipeProcesses`:

```typescript
return {
    // ... existing
    reorderRecipeProcesses,
};
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/ProducaoModule/hooks/useProduction.ts
git commit -m "feat: update useProduction hook with new fields and reorder function"
```

---

## Chunk 3: CatalogoView - Drag & Drop Reorder

### Task 6: Install @dnd-kit/sortable

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install package**

```bash
cd frontend && npm install @dnd-kit/sortable
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add @dnd-kit/sortable dependency"
```

### Task 7: Add Drag & Drop to Process List

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Add imports**

At line 1, add to imports:

```typescript
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, Clock, X, ChevronDown, ChevronRight, BookOpen, Pencil, GripVertical } from 'lucide-react';
```

(Replace the existing lucide import to add `GripVertical`)

- [ ] **Step 2: Add `reorderRecipeProcesses` to hook destructuring**

At line ~27, add `reorderRecipeProcesses` to the destructured hook:

```typescript
const {
    fetchProcesses,
    createProcess,
    deleteProcess,
    fetchRecipes,
    fetchRecipeProcesses,
    addRecipeProcess,
    deleteRecipeProcess,
    getProcessUsageCount,
    updateProcessCascade,
    reorderRecipeProcesses,
    loading
} = useProduction();
```

- [ ] **Step 3: Create SortableProcessRow component**

Add above the `CatalogoView` component (before `export const CatalogoView`):

```typescript
function SortableProcessRow({
    rp, idx, recipe, onEdit, onRemove, formatDuration
}: {
    rp: RecipeProcess;
    idx: number;
    recipe: RecipeSummary;
    onEdit: (rp: RecipeProcess, recipe: RecipeSummary) => void;
    onRemove: (recipeId: string, rpId: string) => void;
    formatDuration: (m: number) => string;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rp.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2">
                <button {...attributes} {...listeners} className="cursor-grab p-1 text-gray-300 hover:text-gray-500 touch-none">
                    <GripVertical size={14} />
                </button>
                <span className="text-xs font-mono text-gray-400 w-5 text-right">{idx + 1}.</span>
                <span className="text-sm font-medium text-gray-800">
                    {rp.production_processes?.name || 'Processo'}
                </span>
                <span className="text-xs text-gray-500">
                    {rp.time_per_unit_minutes} min/un
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {formatDuration(recipe.yield_units * rp.time_per_unit_minutes)}
                </span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onEdit(rp, recipe)}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                    title="Editar processo"
                >
                    <Pencil size={14} />
                </button>
                <button
                    onClick={() => onRemove(recipe.id, rp.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover da receita"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Add handleDragEnd function**

Inside `CatalogoView`, add after `handleRemoveRecipeProcess`:

```typescript
const handleDragEnd = async (recipeId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const rps = recipeProcesses[recipeId] || [];
    const oldIndex = rps.findIndex(rp => rp.id === active.id);
    const newIndex = rps.findIndex(rp => rp.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(rps, oldIndex, newIndex);
    setRecipeProcesses(prev => ({ ...prev, [recipeId]: reordered }));

    try {
        await reorderRecipeProcesses(recipeId, reordered.map(rp => rp.id));
    } catch {
        // Revert on failure
        setRecipeProcesses(prev => ({ ...prev, [recipeId]: rps }));
    }
};
```

- [ ] **Step 5: Replace process list rendering with sortable version**

Replace the existing `{rps.map((rp, idx) => (` block (lines ~280-311) with:

```tsx
<DndContext collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(recipe.id, e)}>
    <SortableContext items={rps.map(rp => rp.id)} strategy={verticalListSortingStrategy}>
        {rps.map((rp, idx) => (
            <SortableProcessRow
                key={rp.id}
                rp={rp}
                idx={idx}
                recipe={recipe}
                onEdit={openEditProcess}
                onRemove={handleRemoveRecipeProcess}
                formatDuration={formatDuration}
            />
        ))}
    </SortableContext>
</DndContext>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: drag & drop reorder for processes within recipes"
```

---

## Chunk 4: CatalogoView - Labor/Wait + Time Source Badges & Edit Modal

### Task 8: Add Badges to Process Rows

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Add icon imports**

Update lucide imports to include:

```typescript
import { Plus, Trash2, Clock, X, ChevronDown, ChevronRight, BookOpen, Pencil, GripVertical, User, Hourglass, CheckCircle, List } from 'lucide-react';
```

- [ ] **Step 2: Add badges to SortableProcessRow**

In `SortableProcessRow`, after the process name `<span>`, add:

```tsx
{/* process_type badge */}
{rp.production_processes?.process_type === 'wait' ? (
    <span title="Espera" className="text-gray-400"><Hourglass size={12} /></span>
) : (
    <span title="Mão de obra" className="text-blue-500"><User size={12} /></span>
)}

{/* time_source badge */}
{rp.production_processes?.time_source === 'measured' ? (
    <span title={`Aferido em ${rp.production_processes.measured_at ? new Date(rp.production_processes.measured_at).toLocaleDateString('pt-BR') : ''}`} className="text-green-500">
        <CheckCircle size={12} />
    </span>
) : (
    <span title="Tempo estimado" className="text-xs text-gray-400">~</span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: add labor/wait and measured/estimated badges to process rows"
```

### Task 9: Update Edit Modal with New Fields

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Update EditProcessState interface**

```typescript
interface EditProcessState {
    processId: string;
    name: string;
    totalMinutes: number;
    time_per_unit_minutes: number;
    yieldUnits: number;
    recipeName: string;
    process_type: 'labor' | 'wait';
    time_source: 'measured' | 'estimated';
    measured_at: string | null;
    isGlobalEdit: boolean;  // true when editing from global panel (no recipe context)
}
```

- [ ] **Step 2: Update openEditProcess to populate new fields**

```typescript
const openEditProcess = async (rp: RecipeProcess, recipe: RecipeSummary) => {
    const proc = rp.production_processes;
    if (!proc) return;
    const yieldUnits = recipe.yield_units || 1;
    const totalMinutes = Math.round(rp.time_per_unit_minutes * yieldUnits * 100) / 100;
    setEditForm({
        processId: proc.id,
        name: proc.name,
        totalMinutes,
        time_per_unit_minutes: rp.time_per_unit_minutes,
        yieldUnits,
        recipeName: recipe.name,
        process_type: proc.process_type || 'labor',
        time_source: proc.time_source || 'estimated',
        measured_at: proc.measured_at || null,
        isGlobalEdit: false,
    });
    const usage = await getProcessUsageCount(proc.id);
    setUsageInfo(usage);
    setEditModal(true);
};
```

- [ ] **Step 3: Update handleEditSave to send new fields**

```typescript
const handleEditSave = async () => {
    if (!editForm) return;
    try {
        await updateProcessCascade(editForm.processId, {
            name: editForm.name,
            time_per_unit_minutes: editForm.isGlobalEdit ? undefined : editForm.time_per_unit_minutes,
            process_type: editForm.process_type,
            time_source: editForm.time_source,
            measured_at: editForm.measured_at,
        });
        await loadProcesses();
        if (expandedRecipe) {
            const rps = await fetchRecipeProcesses(expandedRecipe);
            setRecipeProcesses(prev => ({ ...prev, [expandedRecipe]: rps }));
        }
        setEditModal(false);
        setEditForm(null);
        setUsageInfo(null);
    } catch { /* hook trata */ }
};
```

- [ ] **Step 4: Add process_type and time_source fields to edit modal JSX**

After the time input `<div>` and before the footer buttons `<div className="pt-4">`, add:

```tsx
{/* process_type toggle */}
<div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
    <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5 w-fit">
        <button
            type="button"
            onClick={() => setEditForm({ ...editForm, process_type: 'labor' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${editForm.process_type === 'labor' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
        >
            <User size={12} className="inline mr-1" /> Mão de obra
        </button>
        <button
            type="button"
            onClick={() => setEditForm({ ...editForm, process_type: 'wait' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${editForm.process_type === 'wait' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-600'}`}
        >
            <Hourglass size={12} className="inline mr-1" /> Espera
        </button>
    </div>
</div>

{/* time_source toggle + measured_at */}
<div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Precisão do tempo</label>
    <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5 w-fit mb-2">
        <button
            type="button"
            onClick={() => setEditForm({ ...editForm, time_source: 'estimated', measured_at: null })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${editForm.time_source === 'estimated' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-600'}`}
        >
            ~ Estimado
        </button>
        <button
            type="button"
            onClick={() => setEditForm({ ...editForm, time_source: 'measured', measured_at: editForm.measured_at || new Date().toISOString().split('T')[0] })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${editForm.time_source === 'measured' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600'}`}
        >
            <CheckCircle size={12} className="inline mr-1" /> Aferido
        </button>
    </div>
    {editForm.time_source === 'measured' && (
        <input
            type="date"
            value={editForm.measured_at?.split('T')[0] || ''}
            onChange={e => setEditForm({ ...editForm, measured_at: e.target.value })}
            className="border-gray-300 rounded-md shadow-sm text-sm px-3 py-1.5"
        />
    )}
</div>
```

- [ ] **Step 5: Update Add Process form (new mode) to include process_type**

In `AddProcessFormState`, add `process_type`:

```typescript
interface AddProcessFormState {
    recipeId: string;
    mode: AddMode;
    process_id: string;
    newName: string;
    totalMinutes: number;
    time_per_unit_minutes: number;
    process_type: 'labor' | 'wait';
}
```

Update `openAddForm` to default `process_type: 'labor'`, `time_source: 'estimated'`, `measured_at: null`.
Update `handleModeChange` to preserve/default those fields.
Update `handleSaveProcess` in new mode to pass all new fields:

```typescript
const created = await createProcess({
    name: addForm.newName.trim(),
    expected_duration_minutes: addForm.totalMinutes,
    process_type: addForm.process_type,
    time_source: addForm.time_source,
    measured_at: addForm.measured_at,
} as Omit<ProductionProcess, 'id'>);
```

Also update `AddProcessFormState` to include `time_source` and `measured_at`:

```typescript
interface AddProcessFormState {
    recipeId: string;
    mode: AddMode;
    process_id: string;
    newName: string;
    totalMinutes: number;
    time_per_unit_minutes: number;
    process_type: 'labor' | 'wait';
    time_source: 'measured' | 'estimated';
    measured_at: string | null;
}
```

Add the process_type toggle AND time_source toggle (same pattern as edit modal) to the "new" mode form, after the time input. Default time_source to 'estimated'. When 'measured' is selected, show a date picker defaulting to today.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: add process_type and time_source editing to modal and add form"
```

---

## Chunk 5: Global Process Management Panel

### Task 10: Add Global Process Panel

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Add state for global panel**

```typescript
const [globalPanelOpen, setGlobalPanelOpen] = useState(false);
const [globalSearch, setGlobalSearch] = useState('');
```

- [ ] **Step 2: Add "Todos os Processos" button in header**

Replace the header `<div className="flex items-center justify-between mb-6">` content to add the button on the right:

```tsx
<div className="flex items-center justify-between mb-6">
    <div>
        <h1 className="text-2xl font-bold font-heading text-primary flex items-center">
            <BookOpen className="mr-3 text-primary/80" />
            Processos por Receita
        </h1>
        <p className="text-sm text-gray-500 font-body mt-1">
            Gerencie os processos de produção de cada receita.
        </p>
    </div>
    <button
        onClick={() => setGlobalPanelOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
        <List size={16} />
        Todos os Processos
    </button>
</div>
```

- [ ] **Step 3: Add openGlobalEditProcess function**

```typescript
const openGlobalEditProcess = async (proc: ProductionProcess) => {
    setEditForm({
        processId: proc.id,
        name: proc.name,
        totalMinutes: proc.expected_duration_minutes,
        time_per_unit_minutes: 0,
        yieldUnits: 0,
        recipeName: '',
        process_type: proc.process_type || 'labor',
        time_source: proc.time_source || 'estimated',
        measured_at: proc.measured_at || null,
        isGlobalEdit: true,
    });
    const usage = await getProcessUsageCount(proc.id);
    setUsageInfo(usage);
    setEditModal(true);
};
```

- [ ] **Step 4: Update edit modal time section for global vs recipe context**

In the edit modal, the time input section should conditionally show different labels:

```tsx
{editForm.isGlobalEdit ? (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            Duração esperada (min)
        </label>
        <input
            type="number"
            step="1"
            min="1"
            value={editForm.totalMinutes}
            onChange={e => setEditForm({ ...editForm, totalMinutes: Number(e.target.value) })}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
        />
    </div>
) : (
    <div className="flex items-center gap-4">
        {/* existing totalMinutes input with yield context */}
    </div>
)}
```

Also update `handleEditSave` to handle global edit: when `isGlobalEdit`, update `expected_duration_minutes` directly instead of `time_per_unit_minutes`:

```typescript
const handleEditSave = async () => {
    if (!editForm) return;
    try {
        const payload: any = {
            name: editForm.name,
            process_type: editForm.process_type,
            time_source: editForm.time_source,
            measured_at: editForm.measured_at,
        };
        if (editForm.isGlobalEdit) {
            // Global edit: send totalMinutes as time_per_unit_minutes so backend
            // maps it to expected_duration_minutes. Don't cascade to recipe_processes.
            payload.time_per_unit_minutes = editForm.totalMinutes;
        } else {
            payload.time_per_unit_minutes = editForm.time_per_unit_minutes;
        }
        await updateProcessCascade(editForm.processId, payload);
        await loadProcesses();
        if (expandedRecipe) {
            const rps = await fetchRecipeProcesses(expandedRecipe);
            setRecipeProcesses(prev => ({ ...prev, [expandedRecipe]: rps }));
        }
        setEditModal(false);
        setEditForm(null);
        setUsageInfo(null);
    } catch { /* hook trata */ }
};
```

- [ ] **Step 5: Pre-fetch usage counts when opening the panel**

Add state and loader:

```typescript
const [processUsageCounts, setProcessUsageCounts] = useState<Record<string, number>>({});

const openGlobalPanel = async () => {
    setGlobalPanelOpen(true);
    // Pre-fetch usage counts for all processes
    const counts: Record<string, number> = {};
    await Promise.all(processes.map(async (p) => {
        const usage = await getProcessUsageCount(p.id);
        counts[p.id] = usage.count;
    }));
    setProcessUsageCounts(counts);
};
```

Update the button's `onClick` to call `openGlobalPanel` instead of `() => setGlobalPanelOpen(true)`.

- [ ] **Step 6: Add global panel modal JSX**

Add before the closing `</div>` of the component, after the edit modal:

```tsx
{/* Modal: Todos os Processos */}
{globalPanelOpen && (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg text-gray-900 font-heading">Todos os Processos</h3>
                <button onClick={() => setGlobalPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100">
                <input
                    type="text"
                    placeholder="Buscar processo..."
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-2">
                {processes
                    .filter(p => !globalSearch || p.name.toLowerCase().includes(globalSearch.toLowerCase()))
                    .map(proc => (
                        <div key={proc.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-gray-800 truncate">{proc.name}</span>
                                {proc.process_type === 'wait' ? (
                                    <span title="Espera" className="text-gray-400 shrink-0"><Hourglass size={12} /></span>
                                ) : (
                                    <span title="Mão de obra" className="text-blue-500 shrink-0"><User size={12} /></span>
                                )}
                                {proc.time_source === 'measured' ? (
                                    <span title="Aferido" className="text-green-500 shrink-0"><CheckCircle size={12} /></span>
                                ) : (
                                    <span title="Estimado" className="text-xs text-gray-400 shrink-0">~</span>
                                )}
                                <span className="text-xs text-gray-500">{proc.expected_duration_minutes} min</span>
                                <span className="text-xs text-gray-400">{processUsageCounts[proc.id] || 0} receita(s)</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => { setGlobalPanelOpen(false); openGlobalEditProcess(proc); }}
                                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={async () => {
                                        const usage = await getProcessUsageCount(proc.id);
                                        const msg = usage.count > 0
                                            ? `Deletar "${proc.name}"? Será removido de ${usage.count} receita(s): ${usage.recipes.join(', ')}`
                                            : `Deletar "${proc.name}"?`;
                                        if (!confirm(msg)) return;
                                        await deleteProcess(proc.id);
                                        await loadProcesses();
                                        if (expandedRecipe) {
                                            const rps = await fetchRecipeProcesses(expandedRecipe);
                                            setRecipeProcesses(prev => ({ ...prev, [expandedRecipe]: rps }));
                                        }
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Excluir definitivamente"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                {processes.filter(p => !globalSearch || p.name.toLowerCase().includes(globalSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum processo encontrado.</p>
                )}
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: add global process management panel with search, edit, delete"
```

---

## Chunk 6: Calendar Overlap Layout

### Task 11: Implement Overlap Algorithm

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/agenda/DayColumn.tsx`

- [ ] **Step 1: Add computeOverlapLayout function**

Add after the `timeToMinutes` function (line 23):

```typescript
interface OverlapInfo {
    entryId: string;
    colIndex: number;
    totalCols: number;
}

function computeOverlapLayout(entries: ProductionSchedule[]): Map<string, OverlapInfo> {
    const scheduled = entries
        .filter(e => e.start_time)
        .map(e => ({
            id: e.id,
            start: timeToMinutes(e.start_time!),
            end: timeToMinutes(e.start_time!) + e.duration_minutes,
        }))
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const result = new Map<string, OverlapInfo>();
    if (scheduled.length === 0) return result;

    // Group overlapping entries
    const groups: typeof scheduled[] = [];
    let currentGroup = [scheduled[0]];

    for (let i = 1; i < scheduled.length; i++) {
        const groupEnd = Math.max(...currentGroup.map(e => e.end));
        if (scheduled[i].start < groupEnd) {
            currentGroup.push(scheduled[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = [scheduled[i]];
        }
    }
    groups.push(currentGroup);

    // Assign columns within each group
    for (const group of groups) {
        const totalCols = group.length;
        group.forEach((entry, colIndex) => {
            result.set(entry.id, { entryId: entry.id, colIndex, totalCols });
        });
    }

    return result;
}
```

- [ ] **Step 2: Use overlap layout in rendering**

Replace the entries rendering block (lines 57-69):

```tsx
{/* Blocos de tarefas agendadas */}
{(() => {
    const overlapMap = computeOverlapLayout(entries);
    return entries.filter(e => e.start_time).map(entry => {
        const topPx = timeToMinutes(entry.start_time!) * PIXELS_PER_MINUTE;
        const overlap = overlapMap.get(entry.id);
        const left = overlap ? `${(overlap.colIndex / overlap.totalCols) * 100}%` : '0';
        const width = overlap ? `${(1 / overlap.totalCols) * 100}%` : '100%';
        return (
            <div key={entry.id} style={{
                position: 'absolute',
                top: `${topPx}px`,
                left,
                width,
                paddingRight: overlap && overlap.totalCols > 1 ? '2px' : '0',
            }}>
                <TimeSlot
                    entry={entry}
                    pixelsPerMinute={PIXELS_PER_MINUTE}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            </div>
        );
    });
})()}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/agenda/DayColumn.tsx
git commit -m "feat: side-by-side layout for overlapping calendar entries"
```

### Task 12: Final Integration Commit

- [ ] **Step 1: Push all changes**

```bash
git push
```

- [ ] **Step 2: Remind user to update remote server**

The user needs to `git pull` on the remote server (195.35.40.211) and run the SQL migration.
