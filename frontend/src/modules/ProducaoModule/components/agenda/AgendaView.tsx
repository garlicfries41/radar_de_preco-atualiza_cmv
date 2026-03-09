import React, { useState, useEffect } from 'react';
import {
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addDays,
    subDays,
    isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, FileText, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';

import { useProduction } from '../../hooks/useProduction';
import type { ProductionSchedule, ProductionProcess } from '../../hooks/useProduction';

type AgendaViewProps = {
    // Empty for now, but good practice
};

export const AgendaView: React.FC<AgendaViewProps> = () => {
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Custom Hook
    const {
        fetchSchedule,
        fetchProcesses,
        createScheduleEntry,
        updateScheduleEntry,
        deleteScheduleEntry,
        loading
    } = useProduction();

    // Data States
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

    // Calculate Days in Week whenever week start changes
    useEffect(() => {
        const end = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
        const days = eachDayOfInterval({ start: currentWeekStart, end });
        setWeekDays(days);

        // Auto Select Today if in current week, else select Monday
        if (!selectedDay || (selectedDay < currentWeekStart || selectedDay > end)) {
            setSelectedDay(new Date() >= currentWeekStart && new Date() <= end ? new Date() : days[1]); // Default to Monday
        }

        // Load API Data
        loadWeekData(currentWeekStart, end);
        loadProcesses();
    }, [currentWeekStart]);

    const loadWeekData = async (start: Date, end: Date) => {
        // API dates as YYYY-MM-DD
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

    const handleOpenModal = (day: Date) => {
        setEditingEntry(null);
        setFormData({
            planned_date: day,
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
            loadWeekData(currentWeekStart, endOfWeek(currentWeekStart, { weekStartsOn: 0 }));
        } catch (err) {
            alert("Erro ao salvar o apontamento na agenda.");
        }
    };

    const toggleStatus = async (item: ProductionSchedule) => {
        const newStatus = item.status === 'pending' ? 'done' : 'pending';
        try {
            await updateScheduleEntry(item.id, { status: newStatus });
            // Optmistic update
            setScheduleData(prev => prev.map(s => s.id === item.id ? { ...s, status: newStatus } : s));
        } catch (error) {
            // handled by hook
        }
    };

    // Filter items for selected day
    const dailyTasks = scheduleData.filter(item => {
        if (!selectedDay) return false;
        // item.planned_date is "YYYY-MM-DD" from DB, convert carefully
        return item.planned_date.startsWith(format(selectedDay, 'yyyy-MM-dd'));
    });

    return (
        <div className="flex flex-col h-full bg-[#f9fafb] min-h-[calc(100vh-4rem)] pb-24">
            {/* Header */}
            <div className="bg-white border-b border-[#E5E7EB] px-6 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold font-heading text-primary">Agenda de Produção</h1>
                    <p className="text-sm text-gray-500 font-body">
                        {format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} a {format(endOfWeek(currentWeekStart), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={handlePreviousWeek} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={handleNextWeek} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row flex-1 p-4 md:p-6 gap-6 max-w-7xl mx-auto w-full">

                {/* Left Column: Calendar Days */}
                <div className="w-full md:w-1/3">
                    <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-gray-50 border-b border-[#E5E7EB] px-4 py-3 font-medium text-gray-700 font-heading">
                            Dias da Semana
                        </div>
                        <div className="divide-y divide-gray-100">
                            {weekDays.map((day) => {
                                const isSelected = selectedDay && isSameDay(day, selectedDay);
                                const isTodayStr = isSameDay(day, new Date());
                                const dayTasksCount = scheduleData.filter(s => s.planned_date.startsWith(format(day, 'yyyy-MM-dd'))).length;

                                return (
                                    <div
                                        key={day.toISOString()}
                                        onClick={() => setSelectedDay(day)}
                                        className={`
                      p-4 cursor-pointer transition-colors flex items-center justify-between
                      ${isSelected ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-gray-50 border-l-4 border-transparent'}
                    `}
                                    >
                                        <div>
                                            <p className={`font-medium ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                                                {format(day, 'EEEE', { locale: ptBR }).charAt(0).toUpperCase() + format(day, 'EEEE', { locale: ptBR }).slice(1)}
                                            </p>
                                            <p className={`text-sm ${isSelected ? 'text-primary/80' : 'text-gray-500'}`}>
                                                {format(day, 'dd/MM/yyyy')} {isTodayStr && <span className="ml-2 text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full">Hoje</span>}
                                            </p>
                                        </div>
                                        {dayTasksCount > 0 && (
                                            <div className="bg-gray-100 text-gray-600 font-bold text-xs rounded-full h-6 w-6 flex items-center justify-center">
                                                {dayTasksCount}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Day Details */}
                <div className="w-full md:w-2/3 flex flex-col">
                    {selectedDay ? (
                        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] flex-1 flex flex-col">
                            <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold font-heading text-gray-800">
                                        Produção do Dia
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleOpenModal(selectedDay)}
                                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors shadow-sm"
                                >
                                    <Plus size={16} className="mr-2" /> Agendar Lote
                                </button>
                            </div>

                            <div className="p-6 flex-1 bg-gray-50/50">
                                {loading && <p className="text-gray-500 text-center py-8">Carregando...</p>}

                                {!loading && dailyTasks.length === 0 && (
                                    <div className="text-center py-12 flex flex-col items-center justify-center">
                                        <FileText size={48} className="text-gray-300 mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum lote planejado</h3>
                                        <p className="text-gray-500 max-w-sm mb-6">
                                            Não há processos de produção ou preparos programados para este dia.
                                        </p>
                                        <button
                                            onClick={() => handleOpenModal(selectedDay)}
                                            className="text-primary font-medium hover:underline flex items-center"
                                        >
                                            <Plus size={16} className="mr-1" /> Adicionar Primeira Tarefa
                                        </button>
                                    </div>
                                )}

                                {!loading && dailyTasks.length > 0 && (
                                    <div className="space-y-4">
                                        {dailyTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                className={`
                          bg-white border rounded-xl p-4 shadow-sm transition-all
                          ${task.status === 'done' ? 'border-green-200 bg-green-50/30' : 'border-gray-200 hover:border-primary/50'}
                        `}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex flex-1">
                                                        <button
                                                            onClick={() => toggleStatus(task)}
                                                            className={`mr-4 mt-1 rounded-full p-0.5 flex-shrink-0 transition-colors ${task.status === 'done' ? 'text-green-600 bg-green-100' : 'text-gray-300 hover:text-primary hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            <CheckCircle2 size={24} className={task.status === 'done' ? 'fill-current text-white' : ''} />
                                                        </button>
                                                        <div>
                                                            <h4 className={`text-lg font-bold font-heading mb-1 ${task.status === 'done' ? 'text-gray-500 line-through decoration-1' : 'text-gray-900'}`}>
                                                                {task.production_processes?.name || task.custom_item_name}
                                                            </h4>

                                                            <div className="flex items-center text-sm text-gray-500 space-x-4">
                                                                <span className="flex items-center">
                                                                    <Clock size={14} className="mr-1" /> {task.duration_minutes} minutos
                                                                </span>
                                                                {task.production_processes && (
                                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">Catálogo</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                                        <button
                                                            onClick={() => handleEditEntry(task)}
                                                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteEntry(task)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Deletar"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] flex-1 flex items-center justify-center">
                            <p className="text-gray-500">Selecione um dia da semana para ver os detalhes.</p>
                        </div>
                    )}
                </div>
            </div>

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
                                    type="text"
                                    value={format(formData.planned_date, 'dd/MM/yyyy')}
                                    disabled
                                    className="w-full border-gray-300 rounded-md shadow-sm bg-gray-50 px-3 py-2 text-gray-500"
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
                                            custom_item_name: '', // clear custom if standard selected
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
