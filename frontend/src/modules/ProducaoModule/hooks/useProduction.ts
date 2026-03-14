import { useState, useCallback } from 'react';

// Tipagem baseada nos Pydantic Models
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

export interface RecipeProcess {
    id: string;
    recipe_id: string;
    process_id: string;
    sort_order: number;
    time_per_unit_minutes: number;
    chain_group_id?: string | null;
    production_processes?: {
        id: string;
        name: string;
        expected_duration_minutes: number;
        process_type: 'labor' | 'wait';
        time_source: 'measured' | 'estimated';
        measured_at?: string | null;
    };
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
    chain_group_id?: string | null;
}

export interface ProductionSchedule {
    id: string;
    planned_date: string;
    start_time?: string;        // formato "HH:MM:SS"
    process_id?: string;
    custom_item_name?: string;
    duration_minutes: number;
    status: 'pending' | 'done' | 'cancelled';
    production_processes?: { name: string };
    updated_at?: string;
    chain_group_id?: string | null;
}

const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Se não for localhost, assume que o backend está no mesmo host na porta 8000
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `${window.location.protocol}//${hostname}:8000`;
        }
    }
    return 'http://localhost:8000';
};

const API_BASE_URL = getApiUrl();

export function useProduction() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProcesses = useCallback(async (): Promise<ProductionProcess[]> => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/processes`);
            if (!res.ok) throw new Error('Erro ao buscar processos de produção');
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

    const fetchSchedule = useCallback(async (startDate: string, endDate: string): Promise<ProductionSchedule[]> => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/schedule?start_date=${startDate}&end_date=${endDate}`);
            if (!res.ok) throw new Error('Erro ao buscar agenda de produção');
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

    const createScheduleEntry = useCallback(async (entry: Partial<ProductionSchedule>) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
            });
            if (!res.ok) throw new Error('Erro ao criar agendamento');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateScheduleEntry = useCallback(async (id: string, entry: Partial<ProductionSchedule>) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/schedule/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
            });
            if (!res.ok) throw new Error('Erro ao atualizar agendamento');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteScheduleEntry = useCallback(async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/schedule/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Erro ao deletar agendamento');
            return true;
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // --- CRUD Catálogo de Processos ---

    const createProcess = useCallback(async (process: Omit<ProductionProcess, 'id'>) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/processes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(process),
            });
            if (!res.ok) throw new Error('Erro ao criar processo');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProcess = useCallback(async (id: string, process: Partial<ProductionProcess>) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/processes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(process),
            });
            if (!res.ok) throw new Error('Erro ao atualizar processo');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteProcess = useCallback(async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/production/processes/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Erro ao deletar processo');
            return true;
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // --- Recipe Processes ---

    const fetchRecipes = useCallback(async (): Promise<RecipeSummary[]> => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/recipes`);
            if (!res.ok) throw new Error('Erro ao buscar receitas');
            return await res.json();
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

    const updateRecipeProcess = useCallback(async (rpId: string, data: { sort_order?: number; time_per_unit_minutes?: number; chain_group_id?: string | null }) => {
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

    const getProcessUsageCount = useCallback(async (processId: string): Promise<{ count: number; recipes: string[] }> => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/production/processes/${processId}/usage-count`);
            if (!res.ok) throw new Error('Erro ao buscar uso do processo');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            return { count: 0, recipes: [] };
        }
    }, []);

    const updateProcessCascade = useCallback(async (processId: string, data: {
        name?: string;
        time_per_unit_minutes?: number;
        process_type?: 'labor' | 'wait';
        time_source?: 'measured' | 'estimated';
        measured_at?: string | null;
    }) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/production/processes/${processId}/update-cascade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Erro ao atualizar processo');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        fetchProcesses,
        fetchSchedule,
        createScheduleEntry,
        updateScheduleEntry,
        deleteScheduleEntry,
        createProcess,
        updateProcess,
        deleteProcess,
        fetchRecipes,
        fetchRecipeProcesses,
        addRecipeProcess,
        updateRecipeProcess,
        deleteRecipeProcess,
        resolveRecipeSlots,
        scheduleRecipe,
        getProcessUsageCount,
        updateProcessCascade,
        reorderRecipeProcesses,
    };
}
