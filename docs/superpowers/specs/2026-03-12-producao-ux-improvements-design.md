# Producao Module UX Improvements - Design Spec

**Date:** 2026-03-12
**Status:** Approved

## Overview

Five improvements to the production module: process reordering, labor/wait classification, calendar overlap layout, time measurement tracking, and a global process management panel.

## 1. Reorder Processes (Drag & Drop)

**Goal:** Allow reordering processes within a recipe via drag & drop.

**Approach:** Use @dnd-kit (already installed) with `SortableContext` + `verticalListSortingStrategy`.

**Schema:** No changes. `recipe_processes.sort_order` already exists.

**Backend:**
- Existing `PUT /api/recipe-processes/{rp_id}` already accepts `sort_order`.
- Add `PUT /api/recipes/{recipe_id}/reorder-processes` that accepts `{ process_ids: string[] }` and bulk-updates `sort_order` values (0, 1, 2...). This avoids N individual PUT calls on each drag.

**Frontend (CatalogoView):**
- Wrap process list in `DndContext` + `SortableContext` from @dnd-kit/sortable.
- Each process row becomes a `useSortable` item with a drag handle (GripVertical icon).
- On `onDragEnd`: reorder local state, call bulk reorder endpoint.
- Drag handle appears left of the process number.

## 2. Labor vs Wait (process_type)

**Goal:** Classify processes as active labor (someone working) or passive wait (fermentation, cooling, etc.) to support future labor cost calculations.

**Schema:** Add to `production_processes`:

```sql
ALTER TABLE production_processes
ADD COLUMN process_type text NOT NULL DEFAULT 'labor'
CHECK (process_type IN ('labor', 'wait'));
```

**Backend:**
- `GET /api/production/processes` returns `process_type`.
- `POST /api/production/processes` accepts `process_type`.
- `PUT /api/production/processes/{id}/update-cascade` accepts `process_type`.

**Frontend:**
- **Catalog listing:** Small icon badge next to process name. Labor = user icon (blue). Wait = hourglass icon (gray).
- **Add process form (new mode):** Toggle button group "Mao de obra" / "Espera" below time input.
- **Edit modal:** Same toggle button group.
- **All Processes panel:** Shows process_type in the list with ability to edit.

## 3. Calendar Overlap (Side-by-Side Columns)

**Goal:** When schedule entries overlap in time, display them side-by-side instead of stacking.

**Algorithm:**
1. For each day's entries (that have `start_time`), sort by start_time.
2. Detect overlap groups: entry B overlaps entry A if `B.start < A.start + A.duration`.
3. Within each overlap group, assign column index (0, 1, 2...) and total columns count.
4. Each entry renders with: `left = (colIndex / totalCols) * 100%`, `width = (1 / totalCols) * 100%`.

**Implementation location:** `AgendaView.tsx` > `DayColumn` component.

**Current rendering:** Each entry is `position: absolute` with `top` based on start_time and `height` based on duration. Currently `left: 0, right: 0` (full width).

**Change:** Add `left` and `width` style properties based on overlap calculation. The overlap detection runs as a pure function `computeOverlapLayout(entries)` that returns `{ entryId, colIndex, totalCols }[]`.

**Drag & drop compatibility:** Drop position calculation stays the same (Y → time). The column position is visual only and recalculated after each state change.

## 4. Time Measurement Tracking (Aferido vs Estimado)

**Goal:** Track whether a process's time is measured (aferido) or estimated, with measurement date.

**Schema:** Add to `production_processes`:

```sql
ALTER TABLE production_processes
ADD COLUMN time_source text NOT NULL DEFAULT 'estimated'
CHECK (time_source IN ('measured', 'estimated'));

ALTER TABLE production_processes
ADD COLUMN measured_at timestamptz NULL;
```

**Backend:**
- All process endpoints return and accept `time_source` and `measured_at`.
- When `time_source` is set to `'measured'` and `measured_at` is null, auto-set `measured_at = now()`.
- `update-cascade` propagates `time_source` and `measured_at` along with time changes.

**Frontend:**
- **Catalog listing (badge):** After the time display, show a small icon:
  - Measured: green check-circle icon with tooltip "Aferido em DD/MM/YYYY"
  - Estimated: gray tilde "~" with tooltip "Tempo estimado"
- **Edit modal:** Below the time input, add a row:
  - Toggle: "Estimado" / "Aferido"
  - When "Aferido" selected: date picker for `measured_at` (defaults to today)
  - When "Estimado" selected: hide date picker, clear `measured_at`
- **Add process form (new mode):** Default to "estimated". Can optionally mark as measured.

## 5. Global Process Management Panel

**Goal:** Allow viewing, editing, and permanently deleting any process from a central panel.

**UI:** Button in CatalogoView header (right-aligned), labeled "Todos os Processos" with a list icon.

**Panel behavior:**
- Opens as a modal (consistent with existing edit modal pattern).
- Shows all `production_processes` in a searchable list.
- Each row shows: name, process_type badge, time_source badge, usage count (N receitas).
- Actions per row: Edit (pencil) opens the existing edit modal (without recipe context, so time shows as `expected_duration_minutes`), Delete (trash) with cascade warning.
- Search/filter input at the top.

**Edit from global panel:** Since there's no recipe context, the edit modal shows `expected_duration_minutes` directly (not total time / yield). The label changes to "Duração esperada (min)".

**Delete:** Same cascade logic as existing delete - warns about affected recipes, removes from `recipe_processes` first, then `production_processes`.

## Data Flow Summary

```
production_processes (catalog)
├── process_type: 'labor' | 'wait'
├── time_source: 'measured' | 'estimated'
├── measured_at: timestamp | null
└── expected_duration_minutes: number

recipe_processes (per-recipe link)
├── sort_order: number (drag & drop)
└── time_per_unit_minutes: number (calculated from total / yield)

production_schedule (calendar)
└── overlap layout computed client-side from start_time + duration
```

## Files to Modify

| File | Changes |
|------|---------|
| `migrations/` (new) | Add process_type, time_source, measured_at columns |
| `backend/main.py` | New reorder endpoint, update existing endpoints for new fields |
| `useProduction.ts` | Update interfaces, add reorderProcesses function |
| `CatalogoView.tsx` | Drag & drop, badges, updated edit modal, global panel |
| `AgendaView.tsx` | Overlap layout algorithm in DayColumn |

## Out of Scope

- Labor cost calculation (future feature, will use process_type)
- Resource/station management (raias)
- Batch-level time tracking
