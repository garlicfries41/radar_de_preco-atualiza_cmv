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
    start_time?: string;        // formato "HH:MM:SS"
    process_id?: string;
    custom_item_name?: string;
    duration_minutes: number;
    status: 'pending' | 'done' | 'cancelled';
    production_processes?: { name: string };
    updated_at?: string;
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
        deleteProcess
    };
}
