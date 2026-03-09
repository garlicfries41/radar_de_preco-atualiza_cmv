import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Clock, FileText, X } from 'lucide-react';
import { useProduction } from '../../hooks/useProduction';
import type { ProductionProcess } from '../../hooks/useProduction';

export const CatalogoView: React.FC = () => {
    const {
        fetchProcesses,
        createProcess,
        updateProcess,
        deleteProcess,
        loading
    } = useProduction();

    const [processes, setProcesses] = useState<ProductionProcess[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProcess, setEditingProcess] = useState<ProductionProcess | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        expected_duration_minutes: 60,
        yield_notes: '',
    });

    useEffect(() => {
        loadProcesses();
    }, []);

    const loadProcesses = async () => {
        const data = await fetchProcesses();
        setProcesses(data);
    };

    const openCreateModal = () => {
        setEditingProcess(null);
        setFormData({ name: '', expected_duration_minutes: 60, yield_notes: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (proc: ProductionProcess) => {
        setEditingProcess(proc);
        setFormData({
            name: proc.name,
            expected_duration_minutes: proc.expected_duration_minutes,
            yield_notes: proc.yield_notes || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            if (editingProcess) {
                await updateProcess(editingProcess.id, {
                    name: formData.name.trim(),
                    expected_duration_minutes: Number(formData.expected_duration_minutes),
                    yield_notes: formData.yield_notes.trim() || undefined,
                } as ProductionProcess);
            } else {
                await createProcess({
                    name: formData.name.trim(),
                    expected_duration_minutes: Number(formData.expected_duration_minutes),
                    yield_notes: formData.yield_notes.trim() || undefined,
                } as Omit<ProductionProcess, 'id'>);
            }
            setIsModalOpen(false);
            loadProcesses();
        } catch {
            // erro tratado pelo hook
        }
    };

    const handleDelete = async (proc: ProductionProcess) => {
        if (!confirm(`Deletar o processo "${proc.name}"? Agendamentos existentes que usam este processo não serão afetados.`)) return;
        try {
            await deleteProcess(proc.id);
            setProcesses(prev => prev.filter(p => p.id !== proc.id));
        } catch {
            // erro tratado pelo hook
        }
    };

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes} min`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold font-heading text-primary flex items-center">
                        <FileText className="mr-3 text-primary/80" />
                        Catálogo de Processos
                    </h1>
                    <p className="text-sm text-gray-500 font-body mt-1">
                        Processos padrão reutilizáveis na agenda de produção.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors shadow-sm"
                >
                    <Plus size={16} className="mr-2" /> Novo Processo
                </button>
            </div>

            {/* Lista */}
            {loading && processes.length === 0 && (
                <p className="text-gray-500 text-center py-8">Carregando...</p>
            )}

            {!loading && processes.length === 0 && (
                <div className="text-center py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                    <FileText size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum processo cadastrado</h3>
                    <p className="text-gray-500 max-w-sm mb-6">
                        Crie processos padrão como "Extrusão de Massa" ou "Molho Bechamel" para usá-los na agenda.
                    </p>
                    <button
                        onClick={openCreateModal}
                        className="text-primary font-medium hover:underline flex items-center"
                    >
                        <Plus size={16} className="mr-1" /> Criar Primeiro Processo
                    </button>
                </div>
            )}

            {processes.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {processes.map((proc) => (
                            <div
                                key={proc.id}
                                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 font-heading">{proc.name}</h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="flex items-center text-sm text-gray-500">
                                            <Clock size={14} className="mr-1" />
                                            {formatDuration(proc.expected_duration_minutes)}
                                        </span>
                                        {proc.yield_notes && (
                                            <span className="text-sm text-gray-400 truncate">
                                                {proc.yield_notes}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => openEditModal(proc)}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(proc)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Deletar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Criar/Editar */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900 font-heading">
                                {editingProcess ? 'Editar Processo' : 'Novo Processo'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Processo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder='Ex: "Extrusão de Massa", "Molho Bechamel"'
                                    required
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duração Padrão (Minutos)</label>
                                <input
                                    type="number"
                                    min="5"
                                    step="5"
                                    value={formData.expected_duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, expected_duration_minutes: Number(e.target.value) })}
                                    required
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observações de Rendimento (opcional)</label>
                                <input
                                    type="text"
                                    value={formData.yield_notes}
                                    onChange={(e) => setFormData({ ...formData, yield_notes: e.target.value })}
                                    placeholder="Ex: Rende massa para 100 lasanhas"
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                />
                            </div>

                            <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100 mt-6 !mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-content bg-primary hover:bg-primary/90"
                                >
                                    {loading ? 'Salvando...' : (editingProcess ? 'Atualizar' : 'Criar Processo')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
