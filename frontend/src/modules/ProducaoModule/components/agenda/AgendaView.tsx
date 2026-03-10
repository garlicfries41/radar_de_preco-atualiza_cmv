import React, { useState, useEffect } from 'react';
import {
    format,
    startOfWeek,
    eachDayOfInterval,
    addDays,
    subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { DndContext, pointerWithin } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';

import { useProduction } from '../../hooks/useProduction';
import type { ProductionSchedule, ProductionProcess } from '../../hooks/useProduction';
import { DayColumn, START_HOUR, PIXELS_PER_MINUTE } from './DayColumn';
import { UnscheduledQueue } from './UnscheduledQueue';
import { TimeAxis } from './TimeAxis';

export const AgendaView: React.FC = () => {
    // Semana começa na segunda (weekStartsOn: 1), mostra Seg–Sáb (6 dias)
    const [currentWeekStart, setCurrentWeekStart] = useState(
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const {
        fetchSchedule,
        fetchProcesses,
        createScheduleEntry,
        updateScheduleEntry,
        deleteScheduleEntry,
        loading
    } = useProduction();

    const [scheduleData, setScheduleData] = useState<ProductionSchedule[]>([]);
    const [processesList, setProcessesList] = useState<ProductionProcess[]>([]);

    // Form State
    const [editingEntry, setEditingEntry] = useState<ProductionSchedule | null>(null);
    const [formData, setFormData] = useState({
        planned_date: new Date(),
        process_id: '',
        custom_item_name: '',
        duration_minutes: 60,
    });

    // Seg–Sáb = 6 dias
    useEffect(() => {
        const days = eachDayOfInterval({
            start: currentWeekStart,
            end: addDays(currentWeekStart, 5), // Seg a Sáb
        });
        setWeekDays(days);

        const endDate = addDays(currentWeekStart, 5);
        loadWeekData(currentWeekStart, endDate);
        loadProcesses();
    }, [currentWeekStart]);

    const loadWeekData = async (start: Date, end: Date) => {
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const data = await fetchSchedule(startStr, endStr);
        setScheduleData(data);
    };

    const loadProcesses = async () => {
        if (processesList.length === 0) {
            const procs = await fetchProcesses();
            setProcessesList(procs);
        }
    };

    const handlePreviousWeek = () => setCurrentWeekStart(subDays(currentWeekStart, 7));
    const handleNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));

    const handleOpenModal = () => {
        setEditingEntry(null);
        setFormData({
            planned_date: new Date(),
            process_id: '',
            custom_item_name: '',
            duration_minutes: 60,
        });
        setIsModalOpen(true);
    };

    const handleEditEntry = (task: ProductionSchedule) => {
        setEditingEntry(task);
        setFormData({
            planned_date: new Date(task.planned_date + 'T12:00:00'),
            process_id: task.process_id || '',
            custom_item_name: task.custom_item_name || '',
            duration_minutes: task.duration_minutes,
        });
        setIsModalOpen(true);
    };

    const handleDeleteEntry = async (task: ProductionSchedule) => {
        const name = task.production_processes?.name || task.custom_item_name || 'esta tarefa';
        if (!confirm(`Deletar "${name}" da agenda?`)) return;
        try {
            await deleteScheduleEntry(task.id);
            setScheduleData(prev => prev.filter(s => s.id !== task.id));
        } catch {
            // erro tratado pelo hook
        }
    };

    const handleSaveEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.process_id && !formData.custom_item_name) {
            alert("Selecione um processo do catálogo ou escreva uma tarefa customizada.");
            return;
        }

        try {
            const payload = {
                planned_date: format(formData.planned_date, 'yyyy-MM-dd'),
                process_id: formData.process_id || undefined,
                custom_item_name: formData.custom_item_name || undefined,
                duration_minutes: Number(formData.duration_minutes),
                status: 'pending' as const
            };

            if (editingEntry) {
                await updateScheduleEntry(editingEntry.id, payload);
            } else {
                await createScheduleEntry(payload);
            }
            setIsModalOpen(false);
            setEditingEntry(null);
            loadWeekData(currentWeekStart, addDays(currentWeekStart, 5));
        } catch (err) {
            alert("Erro ao salvar o apontamento na agenda.");
        }
    };

    // --- Drag & Drop ---
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over, activatorEvent } = event;
        if (!over) return;

        const entry: ProductionSchedule = active.data.current?.entry;
        if (!entry) return;

        const overId = String(over.id);

        if (overId === 'unscheduled') {
            // Remover horário — mover para fila
            const updated = { ...entry, start_time: undefined };
            setScheduleData(prev => prev.map(s => s.id === entry.id ? updated : s));
            try {
                await updateScheduleEntry(entry.id, {
                    start_time: null,
                    planned_date: entry.planned_date,
                    duration_minutes: entry.duration_minutes,
                    status: entry.status,
                } as any);
            } catch (err) {
                console.error('Erro ao remover horário:', err);
                loadWeekData(currentWeekStart, addDays(currentWeekStart, 5));
            }
            return;
        }

        // overId é uma data no formato 'yyyy-MM-dd'
        const targetDate = overId;

        // Calcular posição absoluta do pointer dentro da coluna droppable
        const overRect = over.rect;
        const pointerY = (activatorEvent as PointerEvent).clientY + event.delta.y;
        const relativeY = pointerY - overRect.top;

        // Converter pixels → minutos com snap de 15min
        const rawMinutes = relativeY / PIXELS_PER_MINUTE;
        const snappedMinutes = Math.round(rawMinutes / 15) * 15;
        const clampedMinutes = Math.max(0, Math.min((19 - START_HOUR) * 60 - entry.duration_minutes, snappedMinutes));
        const newHour = Math.floor(clampedMinutes / 60) + START_HOUR;
        const newMin = clampedMinutes % 60;
        const newStartTime = `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}:00`;

        const updated = { ...entry, planned_date: targetDate, start_time: newStartTime };
        setScheduleData(prev => prev.map(s => s.id === entry.id ? updated : s));
        try {
            await updateScheduleEntry(entry.id, {
                planned_date: targetDate,
                start_time: newStartTime,
                duration_minutes: entry.duration_minutes,
                status: entry.status,
            } as any);
        } catch (err) {
            console.error('Erro ao salvar posição:', err);
            loadWeekData(currentWeekStart, addDays(currentWeekStart, 5));
        }
    };

    const weekEnd = weekDays.length > 0 ? weekDays[weekDays.length - 1] : currentWeekStart;

    return (
        <div className="flex flex-col h-full bg-[#f9fafb] min-h-[calc(100vh-4rem)]">
            {/* Header */}
            <div className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold font-heading text-primary">Agenda de Produção</h1>
                    <p className="text-sm text-gray-500 font-body">
                        {format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={handlePreviousWeek} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={handleNextWeek} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                    <button
                        onClick={handleOpenModal}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors shadow-sm ml-2"
                    >
                        <Plus size={16} className="mr-2" /> Agendar Lote
                    </button>
                </div>
            </div>

            {/* Grade semanal com DnD */}
            {loading && scheduleData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500">Carregando...</p>
                </div>
            ) : (
                <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
                    <div className="flex flex-1 overflow-x-auto overflow-y-auto">
                        <UnscheduledQueue entries={scheduleData.filter(e => !e.start_time)} />
                        <TimeAxis />
                        {weekDays.map(day => (
                            <DayColumn
                                key={format(day, 'yyyy-MM-dd')}
                                day={day}
                                entries={scheduleData.filter(e => e.planned_date === format(day, 'yyyy-MM-dd'))}
                                onEdit={handleEditEntry}
                                onDelete={handleDeleteEntry}
                            />
                        ))}
                    </div>
                </DndContext>
            )}

            {/* Modal Nova Tarefa */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900 font-heading">
                                {editingEntry ? 'Editar Agendamento' : 'Agendar Produção'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); setEditingEntry(null); }} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                <input
                                    type="date"
                                    value={format(formData.planned_date, 'yyyy-MM-dd')}
                                    onChange={(e) => setFormData({ ...formData, planned_date: new Date(e.target.value + 'T12:00:00') })}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar no Catálogo Padrão</label>
                                <select
                                    value={formData.process_id}
                                    onChange={(e) => {
                                        const procId = e.target.value;
                                        const proc = processesList.find(p => p.id === procId);
                                        setFormData({
                                            ...formData,
                                            process_id: procId,
                                            custom_item_name: '',
                                            duration_minutes: proc ? proc.expected_duration_minutes : formData.duration_minutes
                                        });
                                    }}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                >
                                    <option value="">-- Tarefa Avulsa (Preencher abaixo) --</option>
                                    {processesList.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.expected_duration_minutes} min)</option>
                                    ))}
                                </select>
                            </div>

                            {!formData.process_id && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Tarefa Avulsa</label>
                                    <input
                                        type="text"
                                        value={formData.custom_item_name}
                                        onChange={(e) => setFormData({ ...formData, custom_item_name: e.target.value })}
                                        placeholder="Ex: Limpeza Pesada do Fogão"
                                        required
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duração Reservada (Minutos)</label>
                                <input
                                    type="number"
                                    min="5"
                                    step="5"
                                    value={formData.duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                                    required
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                />
                            </div>

                            <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100 mt-6 !mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-content bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                >
                                    {loading ? 'Salvando...' : (editingEntry ? 'Atualizar' : 'Salvar Atividade')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
