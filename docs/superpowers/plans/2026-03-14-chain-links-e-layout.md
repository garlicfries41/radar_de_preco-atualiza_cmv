# Chain Links de Processos + Expansão de Layout — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que processos dentro de uma receita sejam "linkados" em cadeia, movendo-se como bloco sequencial no calendário, e expandir o layout global de 1024px para 1600px com grid de 3 colunas no catálogo.

**Architecture:** Adiciona `chain_group_id` (UUID nullable) a `recipe_processes` e `production_schedule`. O link é definido no catálogo e propagado automaticamente pelo endpoint `schedule-recipe`. No calendário, slots com mesmo `chain_group_id` e `planned_date` movem-se em sequência.

**Tech Stack:** Supabase (PostgreSQL), FastAPI (Python), React + TypeScript, @dnd-kit, Tailwind CSS

---

## File Structure

| File | Responsibility |
|---|---|
| `migrations/chain_links.sql` | **Create.** Migração SQL para add `chain_group_id` nas duas tabelas |
| `backend/main.py` | **Modify.** `RecipeProcessUpdate` model + `resolve_recipe_slots` + `schedule_recipe` + `update_recipe_process` filter fix |
| `frontend/src/components/features/AppShell.tsx` | **Modify.** Layout `max-w-5xl` → `max-w-[1600px]` |
| `frontend/src/modules/ProducaoModule/hooks/useProduction.ts` | **Modify.** Tipos + `updateRecipeProcess` signature |
| `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx` | **Modify.** Grid 3 colunas + modo seleção + UI de chain link |
| `frontend/src/modules/ProducaoModule/components/agenda/AgendaView.tsx` | **Modify.** Chain-aware drag handler |
| `frontend/src/modules/ProducaoModule/components/agenda/TimeSlot.tsx` | **Modify.** Ícone de corrente + botão quebrar link |

---

## Chunk 1: DB Migration + Backend + Types

### Task 1: SQL Migration

**Files:**
- Create: `migrations/chain_links.sql`

- [ ] **Step 1: Write migration file**

```sql
-- migrations/chain_links.sql
-- Add chain_group_id to recipe_processes and production_schedule

ALTER TABLE recipe_processes
ADD COLUMN IF NOT EXISTS chain_group_id uuid NULL;

ALTER TABLE production_schedule
ADD COLUMN IF NOT EXISTS chain_group_id uuid NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool:
- project_id: `dpsunmjbymnnyzaaudma`
- name: `chain_links`
- query: (content of the file)

- [ ] **Step 3: Commit**

```bash
git add migrations/chain_links.sql
git commit -m "feat: add chain_group_id migration for recipe_processes and production_schedule"
```

---

### Task 2: Backend — RecipeProcessUpdate + filter fix

**Files:**
- Modify: `backend/main.py:116-118` (RecipeProcessUpdate model)
- Modify: `backend/main.py:1444` (update_recipe_process filter)

- [ ] **Step 1: Add chain_group_id to RecipeProcessUpdate**

At `backend/main.py:116-118`, change:

```python
class RecipeProcessUpdate(BaseModel):
    sort_order: Optional[int] = None
    time_per_unit_minutes: Optional[float] = None
```

To:

```python
class RecipeProcessUpdate(BaseModel):
    sort_order: Optional[int] = None
    time_per_unit_minutes: Optional[float] = None
    chain_group_id: Optional[str] = None
```

- [ ] **Step 1b: Add chain_group_id to ProductionScheduleInput**

At `backend/main.py:125-131`, add the field:

```python
class ProductionScheduleInput(BaseModel):
    planned_date: Optional[datetime] = None
    start_time: Optional[str] = None
    process_id: Optional[str] = None
    custom_item_name: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    chain_group_id: Optional[str] = None        # ← NEW
```

This is needed so `PUT /api/production/schedule/{id}` can accept `chain_group_id: null` for break-link.

- [ ] **Step 2: Fix filter to support null values**

At `backend/main.py:1444`, change:

```python
payload = {k: v for k, v in data.model_dump().items() if v is not None}
```

To:

```python
payload = data.model_dump(exclude_unset=True)
```

This ensures `chain_group_id: null` (unlinking) is persisted instead of being silently dropped.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add chain_group_id to RecipeProcessUpdate and fix null filter"
```

---

### Task 3: Backend — resolve_recipe_slots + schedule_recipe propagation

**Files:**
- Modify: `backend/main.py:865-868` (resolve_recipe_slots select query)
- Modify: `backend/main.py:877-887` (slot dict construction)
- Modify: `backend/main.py:1529-1535` (schedule_recipe entry dict)

- [ ] **Step 1: Include chain_group_id in resolve_recipe_slots select**

At `backend/main.py:865-868`, the select query already uses `*` on `recipe_processes`, so `chain_group_id` will be included automatically after migration. No change needed to the query.

- [ ] **Step 2: Add chain_group_id to slot dict**

At `backend/main.py:877-887`, add `chain_group_id` to the slot dict. Change:

```python
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
```

To:

```python
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
                "chain_group_id": rp.get("chain_group_id"),
            })
```

- [ ] **Step 3: Propagate chain_group_id in schedule_recipe**

At `backend/main.py:1529-1535`, change:

```python
        entry = {
            "planned_date": data.planned_date,
            "process_id": slot["process_id"],
            "custom_item_name": slot["label"],
            "duration_minutes": max(1, round(slot["duration_minutes"])),
            "status": "pending",
        }
```

To:

```python
        entry = {
            "planned_date": data.planned_date,
            "process_id": slot["process_id"],
            "custom_item_name": slot["label"],
            "duration_minutes": max(1, round(slot["duration_minutes"])),
            "status": "pending",
            "chain_group_id": slot.get("chain_group_id"),
        }
```

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: propagate chain_group_id from recipe_processes through resolve-slots to schedule"
```

---

### Task 4: Frontend — TypeScript types + hook

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/hooks/useProduction.ts:15-29` (RecipeProcess)
- Modify: `frontend/src/modules/ProducaoModule/hooks/useProduction.ts:50-60` (ProductionSchedule)
- Modify: `frontend/src/modules/ProducaoModule/hooks/useProduction.ts:282` (updateRecipeProcess)

- [ ] **Step 1: Add chain_group_id to RecipeProcess**

At `useProduction.ts:15`, add `chain_group_id` to the interface. After line 29 (`};`), the field should be inside the interface:

```typescript
export interface RecipeProcess {
    id: string;
    recipe_id: string;
    process_id: string;
    sort_order: number;
    time_per_unit_minutes: number;
    chain_group_id?: string | null;           // ← NEW
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

- [ ] **Step 2: Add chain_group_id to ProductionSchedule**

At `useProduction.ts:50-60`, add the field:

```typescript
export interface ProductionSchedule {
    id: string;
    planned_date: string;
    start_time?: string;
    process_id?: string;
    custom_item_name?: string;
    duration_minutes: number;
    status: 'pending' | 'done' | 'cancelled';
    production_processes?: { name: string };
    updated_at?: string;
    chain_group_id?: string | null;           // ← NEW
}
```

- [ ] **Step 2b: Add chain_group_id to ResolvedSlot**

At `useProduction.ts:38-48`, add the field:

```typescript
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
    chain_group_id?: string | null;           // ← NEW
}
```

- [ ] **Step 3: Update updateRecipeProcess data type**

At `useProduction.ts:282`, change:

```typescript
const updateRecipeProcess = useCallback(async (rpId: string, data: { sort_order?: number; time_per_unit_minutes?: number }) => {
```

To:

```typescript
const updateRecipeProcess = useCallback(async (rpId: string, data: { sort_order?: number; time_per_unit_minutes?: number; chain_group_id?: string | null }) => {
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/ProducaoModule/hooks/useProduction.ts
git commit -m "feat: add chain_group_id to RecipeProcess and ProductionSchedule types"
```

---

## Chunk 2: Layout Expansion

### Task 5: AppShell max-width

**Files:**
- Modify: `frontend/src/components/features/AppShell.tsx:65`

- [ ] **Step 1: Change max-w-5xl to max-w-[1600px]**

At `AppShell.tsx:65`, change:

```tsx
<main className="max-w-5xl mx-auto px-4 py-6 md:px-8 pb-24 md:pb-8">
```

To:

```tsx
<main className="max-w-[1600px] mx-auto px-4 py-6 md:px-8 pb-24 md:pb-8">
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/features/AppShell.tsx
git commit -m "feat: expand global layout from 1024px to 1600px"
```

---

### Task 6: CatalogoView — 3-column grid for recipes

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Find the recipe list container**

Read the file and locate where recipes are mapped. It will be a `div` wrapping `{recipes.map(...)}`— likely using `space-y-*` for vertical stacking.

- [ ] **Step 2: Replace with responsive grid**

Change the recipe list wrapper from vertical stack to grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {recipes.map((recipe) => (
        // existing recipe card JSX
    ))}
</div>
```

Remove any `space-y-*` class on the parent if present, since `gap-4` handles spacing.

- [ ] **Step 3: Verify visual result**

Run: `npm run dev` (or check existing dev server)
Navigate to Produção → Catálogo de Processos.
Expected: recipes display in up to 3 columns on wide screens.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: 3-column responsive grid for recipe list in CatalogoView"
```

---

## Chunk 3: Chain Link UI in CatalogoView

### Task 7: Selection mode state + checkboxes

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Add selection state**

Inside the `CatalogoView` component, add state for chain selection:

```typescript
const [chainSelect, setChainSelect] = useState<{
    recipeId: string;
    selectedIds: Set<string>;
} | null>(null);
```

- [ ] **Step 2: Add "Selecionar" toggle button**

In each expanded recipe's process list header (near the "+" add button), add:

```tsx
<button
    onClick={() => setChainSelect(
        chainSelect?.recipeId === recipe.id
            ? null
            : { recipeId: recipe.id, selectedIds: new Set() }
    )}
    className="p-1 text-gray-400 hover:text-primary transition-colors"
    title="Selecionar para linkar"
>
    <Link2 size={16} />
</button>
```

Import `Link2` and `Link2Off` from `lucide-react`.

- [ ] **Step 3: Add checkboxes to SortableProcessRow**

Pass `chainSelect` state and a toggle function as props to `SortableProcessRow`. When `chainSelect` is active and `chainSelect.recipeId === recipe.id`, render a checkbox before the drag handle:

```tsx
{isSelecting && (
    <input
        type="checkbox"
        checked={chainSelect.selectedIds.has(rp.id)}
        onChange={() => onToggleSelect(rp.id)}
        className="w-4 h-4 accent-primary mr-1"
    />
)}
```

The toggle function:

```typescript
const toggleChainSelect = (rpId: string) => {
    if (!chainSelect) return;
    const next = new Set(chainSelect.selectedIds);
    if (next.has(rpId)) next.delete(rpId);
    else next.add(rpId);
    setChainSelect({ ...chainSelect, selectedIds: next });
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: add selection mode with checkboxes for chain linking"
```

---

### Task 8: Link/Unlink actions + visual indicators

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx`

- [ ] **Step 1: Add action bar when 2+ selected**

Below the process list, when `chainSelect` is active and `selectedIds.size >= 2`, show:

```tsx
{chainSelect && chainSelect.recipeId === recipe.id && chainSelect.selectedIds.size >= 2 && (
    <div className="flex gap-2 mt-2 p-2 bg-gray-50 rounded-lg">
        <button
            onClick={() => handleLinkProcesses(recipe.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90"
        >
            <Link2 size={14} /> Linkar
        </button>
        <button
            onClick={() => handleUnlinkProcesses(recipe.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-300"
        >
            <Link2Off size={14} /> Deslinkar
        </button>
    </div>
)}
```

- [ ] **Step 2: Implement handleLinkProcesses**

```typescript
const handleLinkProcesses = async (recipeId: string) => {
    if (!chainSelect || chainSelect.selectedIds.size < 2) return;
    const groupId = crypto.randomUUID();
    try {
        await Promise.all(
            Array.from(chainSelect.selectedIds).map(rpId =>
                updateRecipeProcess(rpId, { chain_group_id: groupId })
            )
        );
        // Refresh the recipe's processes
        const rps = await fetchRecipeProcesses(recipeId);
        setRecipeProcesses(prev => ({ ...prev, [recipeId]: rps }));
        setChainSelect(null);
    } catch (err) {
        console.error('Error linking processes:', err);
    }
};
```

- [ ] **Step 3: Implement handleUnlinkProcesses**

```typescript
const handleUnlinkProcesses = async (recipeId: string) => {
    if (!chainSelect) return;
    try {
        await Promise.all(
            Array.from(chainSelect.selectedIds).map(rpId =>
                updateRecipeProcess(rpId, { chain_group_id: null })
            )
        );
        const rps = await fetchRecipeProcesses(recipeId);
        setRecipeProcesses(prev => ({ ...prev, [recipeId]: rps }));
        setChainSelect(null);
    } catch (err) {
        console.error('Error unlinking processes:', err);
    }
};
```

- [ ] **Step 4: Add chain icon indicator in SortableProcessRow**

In the `SortableProcessRow` component, after the process name, if `rp.chain_group_id` is set, show:

```tsx
{rp.chain_group_id && (
    <span title="Processo linkado" className="text-primary">
        <Link2 size={12} />
    </span>
)}
```

- [ ] **Step 5: Add left border connector for consecutive linked processes**

In the recipe process list, when rendering consecutive `SortableProcessRow` items that share the same `chain_group_id`, add a colored left border. Use a helper to compute which items are in a connected group:

```typescript
const getChainColor = (groupId: string) => {
    let hash = 0;
    for (let i = 0; i < groupId.length; i++) {
        hash = ((hash << 5) - hash) + groupId.charCodeAt(i);
        hash |= 0;
    }
    const colors = ['border-l-blue-400', 'border-l-emerald-400', 'border-l-amber-400', 'border-l-purple-400', 'border-l-rose-400'];
    return colors[Math.abs(hash) % colors.length];
};
```

In the row wrapper, if `rp.chain_group_id`:

```tsx
className={`... ${rp.chain_group_id ? `border-l-4 ${getChainColor(rp.chain_group_id)}` : ''}`}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/catalogo/CatalogoView.tsx
git commit -m "feat: link/unlink actions with chain icons and connectors in CatalogoView"
```

---

## Chunk 4: Chain-Aware Calendar

### Task 9: TimeSlot — chain icon + break link button

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/agenda/TimeSlot.tsx`

- [ ] **Step 1: Import Link2 and Link2Off icons**

```typescript
import { Link2, Link2Off } from 'lucide-react';
```

- [ ] **Step 2: Add chain icon and break-link button**

Inside the `TimeSlot` component, in the hover action buttons area (lines 78-93), add a break-link button before the edit button when `entry.chain_group_id` exists:

```tsx
{entry.chain_group_id && (
    <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onBreakLink?.(entry); }}
        className="text-[10px] bg-white border border-orange-200 rounded px-1 text-orange-400 hover:text-orange-600"
        title="Quebrar link"
    >
        <Link2Off size={10} />
    </button>
)}
```

- [ ] **Step 3: Add chain indicator**

Add a small chain icon in the top-right corner of linked slots (always visible, not just on hover):

```tsx
{entry.chain_group_id && (
    <span className="absolute top-0.5 right-1 text-primary/60">
        <Link2 size={10} />
    </span>
)}
```

- [ ] **Step 4: Add onBreakLink prop**

Update `TimeSlotProps`:

```typescript
interface TimeSlotProps {
    entry: ProductionSchedule;
    pixelsPerMinute: number;
    onEdit: (entry: ProductionSchedule) => void;
    onDelete: (entry: ProductionSchedule) => void;
    onBreakLink?: (entry: ProductionSchedule) => void;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/agenda/TimeSlot.tsx
git commit -m "feat: chain icon and break-link button in TimeSlot"
```

---

### Task 10: AgendaView — chain-aware drag handler + break link

**Files:**
- Modify: `frontend/src/modules/ProducaoModule/components/agenda/AgendaView.tsx`

- [ ] **Step 1: Read AgendaView.tsx**

Read the file to locate:
- The `handleDragEnd` function (handles when a slot is dropped on the calendar)
- Where `updateScheduleEntry` is called to set `start_time`
- Where `TimeSlot` is rendered, to pass the new `onBreakLink` prop

- [ ] **Step 2: Add handleBreakLink function**

```typescript
const handleBreakLink = async (entry: ProductionSchedule) => {
    try {
        await updateScheduleEntry(entry.id, { chain_group_id: null });
        // Refresh schedule
        await refreshSchedule();
    } catch (err) {
        console.error('Error breaking link:', err);
    }
};
```

(`refreshSchedule` is whatever function the component already uses to reload `fetchSchedule` and update state.)

- [ ] **Step 3: Pass onBreakLink to TimeSlot**

Wherever `<TimeSlot>` is rendered, add:

```tsx
<TimeSlot
    entry={entry}
    pixelsPerMinute={pixelsPerMinute}
    onEdit={handleEdit}
    onDelete={handleDelete}
    onBreakLink={handleBreakLink}
/>
```

- [ ] **Step 3b: Add chain connector lines in DayColumn**

In `DayColumn.tsx`, after rendering `TimeSlot` entries, add a subtle vertical connector between consecutive chain siblings. When two adjacent (by time) slots share a `chain_group_id`, render a small dashed line between them:

```tsx
{/* Chain connector between consecutive linked slots */}
{entry.chain_group_id && nextEntry?.chain_group_id === entry.chain_group_id && (
    <div
        className="absolute left-1/2 w-0.5 bg-primary/30"
        style={{
            top: `${slotTop + slotHeight}px`,
            height: `${nextSlotTop - (slotTop + slotHeight)}px`,
        }}
    />
)}
```

The exact positioning depends on how DayColumn calculates slot positions. Read the file and adapt the pixel math to match. The connector should fill the gap between two consecutive chain slots.

- [ ] **Step 4: Modify handleDragEnd for chain propagation**

Inside `handleDragEnd`, after calculating the `start_time` for the dropped slot, check if it has a `chain_group_id`. If so, find all other schedule entries with the same `chain_group_id` and `planned_date`, sort them by original `sort_order` (or by their existing sequence), and assign sequential start times:

```typescript
const handleChainDrop = async (droppedEntry: ProductionSchedule, newStartTime: string) => {
    if (!droppedEntry.chain_group_id) {
        // Single slot — update normally
        await updateScheduleEntry(droppedEntry.id, { start_time: newStartTime });
        return;
    }

    // Find all chain siblings in the same day
    const chainSiblings = scheduleEntries
        .filter(e =>
            e.chain_group_id === droppedEntry.chain_group_id &&
            e.planned_date === droppedEntry.planned_date &&
            e.id !== droppedEntry.id
        );

    // All chain entries (dropped + siblings), sorted by creation order
    // (schedule entries are created in sort_order sequence by schedule-recipe,
    // so sorting by id preserves the original recipe process order)
    const allChain = [droppedEntry, ...chainSiblings]
        .sort((a, b) => a.id.localeCompare(b.id));

    // Sequence all chain entries starting at newStartTime in their recipe order
    let currentTime = newStartTime;
    const updates = allChain.map(entry => {
        const thisStart = currentTime;
        // Advance by this entry's duration
        const [h, m] = thisStart.split(':').map(Number);
        const totalMin = h * 60 + m + entry.duration_minutes;
        const nextH = Math.floor(totalMin / 60).toString().padStart(2, '0');
        const nextM = (totalMin % 60).toString().padStart(2, '0');
        currentTime = `${nextH}:${nextM}:00`;
        return { id: entry.id, start_time: `${thisStart.length === 5 ? thisStart + ':00' : thisStart}` };
    });

    // Save all in parallel
    await Promise.all(
        updates.map(u => updateScheduleEntry(u.id, { start_time: u.start_time }))
    );
};
```

Integrate this into the existing `handleDragEnd`:
- Where it currently calls `updateScheduleEntry(id, { start_time })` for a single entry, replace with `handleChainDrop(entry, startTime)`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/ProducaoModule/components/agenda/AgendaView.tsx
git commit -m "feat: chain-aware drag handler and break-link in AgendaView"
```

---

### Task 11: Final integration test + push

- [ ] **Step 1: Manual test — CatalogoView**

1. Open Produção → Catálogo de Processos
2. Verify 3-column grid on wide screen
3. Expand a recipe → click "Selecionar" → select 2+ processes → click "Linkar"
4. Verify chain icon appears next to linked processes
5. Verify left border connector between consecutive linked items

- [ ] **Step 2: Manual test — Agendar Lote**

1. Go to Agenda Semanal → "Agendar Lote" → "Por Receita"
2. Select a recipe with linked processes → schedule
3. Verify linked entries in "Não Agendado" show chain icon

- [ ] **Step 3: Manual test — Calendar drag**

1. Drag a linked entry to Monday 07:00
2. Verify all chain siblings position sequentially after it
3. Hover a linked slot → click "Quebrar link"
4. Drag the unlinked slot independently → verify others don't move

- [ ] **Step 4: Push**

```bash
git push
```
