import { useState, useCallback } from 'react';

// Tipagem baseada nos Pydantic Models
export interface ProductionProcess {
    id: string;
    name: string;
    expected_duration_minutes: number;
    yield_notes?: string;
}

export interface ProductionSchedule {
    id: string;
    planned_date: string;
    process_id?: string;
    custom_item_name?: string;
    duration_minutes: number;
    status: 'pending' | 'done' | 'cancelled';
    production_processes?: { name: string };
    updated_at?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

    return {
        loading,
        error,
        fetchProcesses,
        fetchSchedule,
        createScheduleEntry,
        updateScheduleEntry,
        deleteScheduleEntry
    };
}
