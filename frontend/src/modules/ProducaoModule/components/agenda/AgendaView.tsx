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
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import { useProduction } from '../../hooks/useProduction';
import type { ProductionSchedule, ProductionProcess, RecipeSummary, ResolvedSlot } from '../../hooks/useProduction';
import { DayColumn, START_HOUR, PIXELS_PER_MINUTE } from './DayColumn';
import { UnscheduledQueue } from './UnscheduledQueue';
import { TimeAxis } from './TimeAxis';
import { TimeSlotOverlay } from './TimeSlot';

type ModalMode = 'task' | 'recipe';

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
        fetchRecipes,
        resolveRecipeSlots,
        scheduleRecipe,
        loading
    } = useProduction();

    const [scheduleData, setScheduleData] = useState<ProductionSchedule[]>([]);
    const [processesList, setProcessesList] = useState<ProductionProcess[]>([]);

    // Drag State
    const [activeEntry, setActiveEntry] = useState<ProductionSchedule | null>(null);

    // Form State — Tarefa Avulsa
    const [editingEntry, setEditingEntry] = useState<ProductionSchedule | null>(null);
    const [formData, setFormData] = useState({
        planned_date: new Date(),
        process_id: '',
        custom_item_name: '',
        duration_minutes: 60,
    });

    // Modal mode
    const [modalMode, setModalMode] = useState<ModalMode>('task');

    // Recipe scheduling state
    const [recipesList, setRecipesList] = useState<RecipeSummary[]>([]);
    const [selectedRecipeId, setSelectedRecipeId] = useState('');
    const [recipeQuantity, setRecipeQuantity] = useState(1);
    const [recipePlannedDate, setRecipePlannedDate] = useState(new Date());
    const [resolvedSlots, setResolvedSlots] = useState<ResolvedSlot[]>([]);
    const [resolvedTotal, setResolvedTotal] = useState(0);
    const [resolving, setResolving] = useState(false);

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

    const loadRecipes = async () => {
        if (recipesList.length === 0) {
            const data = await fetchRecipes();
            setRecipesList(data.filter(r => !r.is_pre_preparo));
        }
    };

    const handlePreviousWeek = () => setCurrentWeekStart(subDays(currentWeekStart, 7));
    const handleNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));

    const handleOpenModal = () => {
        setEditingEntry(null);
        setModalMode('task');
        setFormData({
            planned_date: new Date(),
            process_id: '',
            custom_item_name: '',
            duration_minutes: 60,
        });
        // Reset recipe state
        setSelectedRecipeId('');
        setRecipeQuantity(1);
        setRecipePlannedDate(new Date());
        setResolvedSlots([]);
        setResolvedTotal(0);
        setIsModalOpen(true);
        loadRecipes();
    };

    const handleEditEntry = (task: ProductionSchedule) => {
        setEditingEntry(task);
        setModalMode('task');
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

    // --- Recipe resolve ---
    const handleResolveSlots = async (recipeId: string, qty: number) => {
        if (!recipeId || qty <= 0) {
            setResolvedSlots([]);
            setResolvedTotal(0);
            return;
        }
        setResolving(true);
        const result = await resolveRecipeSlots(recipeId, qty);
        setResolvedSlots(result.slots);
        setResolvedTotal(result.total_minutes);
        setResolving(false);
    };

    const handleRecipeChange = (recipeId: string) => {
        setSelectedRecipeId(recipeId);
        const recipe = recipesList.find(r => r.id === recipeId);
        const qty = recipe ? recipe.yield_units : recipeQuantity;
        setRecipeQuantity(qty);
        handleResolveSlots(recipeId, qty);
    };

    const handleQuantityChange = (qty: number) => {
        setRecipeQuantity(qty);
        handleResolveSlots(selectedRecipeId, qty);
    };

    const handleScheduleRecipe = async () => {
        if (!selectedRecipeId) return;
        try {
            await scheduleRecipe({
                recipe_id: selectedRecipeId,
                quantity: recipeQuantity,
                planned_date: format(recipePlannedDate, 'yyyy-MM-dd'),
            });
            setIsModalOpen(false);
            loadWeekData(currentWeekStart, addDays(currentWeekStart, 5));
        } catch {
            alert("Erro ao agendar receita.");
        }
    };

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${Math.round(minutes)} min`;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };

    // --- Drag & Drop ---
    const handleDragStart = (event: DragStartEvent) => {
        const entry = event.active.data.current?.entry as ProductionSchedule | undefined;
        setActiveEntry(entry ?? null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveEntry(null);

        const { active, over } = event;
        if (!over) return;

        const entry: ProductionSchedule = active.data.current?.entry;
        if (!entry) return;

        const overId = String(over.id);

        if (overId === 'unscheduled') {
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

        // Posição do TOPO do slot (não do cursor) na posição final
        const overRect = over.rect;
        const slotTopY = (active.rect.current.initial?.top ?? 0) + event.delta.y;
        const relativeY = slotTopY - overRect.top;

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

    // Separar slots diretos e pré-preparos para preview
    const directSlots = resolvedSlots.filter(s => !s.is_sub_preparo);
    const subSlots = resolvedSlots.filter(s => s.is_sub_preparo);

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
                <DndContext collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="flex flex-1 overflow-x-auto overflow-y-auto">
                        <UnscheduledQueue entries={scheduleData.filter(e => !e.start_time)} />
                        <TimeAxis />
                        {weekDays.map(day => (
                            <DayColumn
                                key={format(day, 'yyyy-MM-dd')}
                                day={day}
                                entries={scheduleData.filter(e => e.planned_date?.startsWith(format(day, 'yyyy-MM-dd')))}
                                onEdit={handleEditEntry}
                                onDelete={handleDeleteEntry}
                            />
                        ))}
                    </div>
                    <DragOverlay dropAnimation={null}>
                        {activeEntry ? (
                            <TimeSlotOverlay entry={activeEntry} pixelsPerMinute={PIXELS_PER_MINUTE} />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Modal Nova Tarefa / Agendar por Receita */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="font-bold text-lg text-gray-900 font-heading">
                                {editingEntry ? 'Editar Agendamento' : 'Agendar Produção'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); setEditingEntry(null); }} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Toggle Tarefa Avulsa / Por Receita */}
                        {!editingEntry && (
                            <div className="px-6 pt-4 shrink-0">
                                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setModalMode('task')}
                                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                            modalMode === 'task'
                                                ? 'bg-primary text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        Tarefa Avulsa
                                    </button>
                                    <button
                                        onClick={() => setModalMode('recipe')}
                                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                            modalMode === 'recipe'
                                                ? 'bg-primary text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        Por Receita
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tarefa Avulsa (fluxo original) */}
                        {modalMode === 'task' && (
                            <form onSubmit={handleSaveEntry} className="p-6 space-y-4 overflow-y-auto">
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
                        )}

                        {/* Por Receita */}
                        {modalMode === 'recipe' && (
                            <div className="p-6 space-y-4 overflow-y-auto">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Receita</label>
                                    <select
                                        value={selectedRecipeId}
                                        onChange={(e) => handleRecipeChange(e.target.value)}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                    >
                                        <option value="">Selecione uma receita...</option>
                                        {recipesList.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.yield_units} un)</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={recipeQuantity}
                                            onChange={(e) => handleQuantityChange(Number(e.target.value))}
                                            className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                        <input
                                            type="date"
                                            value={format(recipePlannedDate, 'yyyy-MM-dd')}
                                            onChange={(e) => setRecipePlannedDate(new Date(e.target.value + 'T12:00:00'))}
                                            className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                        />
                                    </div>
                                </div>

                                {/* Preview dos slots */}
                                {resolving && (
                                    <p className="text-sm text-gray-400 text-center py-4">Calculando processos...</p>
                                )}

                                {!resolving && resolvedSlots.length > 0 && (
                                    <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 space-y-3 max-h-60 overflow-y-auto">
                                        {directSlots.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Processos diretos</p>
                                                {directSlots.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1 text-sm">
                                                        <span className="text-gray-700">{s.label}</span>
                                                        <span className="text-gray-500 ml-2 shrink-0">{formatDuration(s.duration_minutes)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {subSlots.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Pré-preparos</p>
                                                {subSlots.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1 text-sm">
                                                        <span className="text-amber-700">{s.label}</span>
                                                        <span className="text-amber-600 ml-2 shrink-0">{formatDuration(s.duration_minutes)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-medium">
                                            <span className="text-gray-700">
                                                Total: {formatDuration(resolvedTotal)} · {resolvedSlots.length} slot{resolvedSlots.length > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {!resolving && selectedRecipeId && resolvedSlots.length === 0 && (
                                    <p className="text-sm text-gray-400 text-center py-2">
                                        Nenhum processo vinculado a esta receita. Vincule processos no Catálogo.
                                    </p>
                                )}

                                <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleScheduleRecipe}
                                        disabled={loading || !selectedRecipeId || resolvedSlots.length === 0}
                                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-content bg-primary hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {loading ? 'Agendando...' : `Agendar ${resolvedSlots.length} Slot${resolvedSlots.length > 1 ? 's' : ''}`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
