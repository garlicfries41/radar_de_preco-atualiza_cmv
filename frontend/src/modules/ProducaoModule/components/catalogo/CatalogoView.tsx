import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, X, ChevronDown, ChevronRight, BookOpen, Pencil } from 'lucide-react';
import { useProduction } from '../../hooks/useProduction';
import type { ProductionProcess, RecipeSummary, RecipeProcess } from '../../hooks/useProduction';

type AddMode = 'existing' | 'new';

interface AddProcessFormState {
    recipeId: string;
    mode: AddMode;
    process_id: string;
    newName: string;
    totalMinutes: number;
    time_per_unit_minutes: number;
}

interface EditProcessState {
    processId: string;
    name: string;
    totalMinutes: number;
    time_per_unit_minutes: number;
    yieldUnits: number;
    recipeName: string;
}

export const CatalogoView: React.FC = () => {
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
        loading
    } = useProduction();

    const [processes, setProcesses] = useState<ProductionProcess[]>([]);
    const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
    const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
    const [recipeProcesses, setRecipeProcesses] = useState<Record<string, RecipeProcess[]>>({});
    const [addForm, setAddForm] = useState<AddProcessFormState | null>(null);

    // Edição inline
    const [editForm, setEditForm] = useState<EditProcessState | null>(null);
    const [editModal, setEditModal] = useState(false);
    const [usageInfo, setUsageInfo] = useState<{ count: number; recipes: string[] } | null>(null);

    useEffect(() => {
        loadProcesses();
        loadRecipes();
    }, []);

    const loadProcesses = async () => {
        const data = await fetchProcesses();
        setProcesses(data);
    };

    const loadRecipes = async () => {
        const data = await fetchRecipes();
        setRecipes(data.filter(r => !r.is_pre_preparo));
    };

    const toggleRecipe = async (recipeId: string) => {
        if (expandedRecipe === recipeId) {
            setExpandedRecipe(null);
            return;
        }
        setExpandedRecipe(recipeId);
        if (!recipeProcesses[recipeId]) {
            const rps = await fetchRecipeProcesses(recipeId);
            setRecipeProcesses(prev => ({ ...prev, [recipeId]: rps }));
        }
    };

    const getRecipeYield = (recipeId: string) => {
        const recipe = recipes.find(r => r.id === recipeId);
        return recipe?.yield_units || 1;
    };

    // --- Adicionar processo ---
    const openAddForm = (recipeId: string) => {
        setAddForm({
            recipeId, mode: 'existing', process_id: '', newName: '', totalMinutes: 60, time_per_unit_minutes: 0,
        });
    };

    const handleModeChange = (mode: AddMode) => {
        if (!addForm) return;
        const defaultTotal = 60;
        const yieldUnits = getRecipeYield(addForm.recipeId);
        const tpu = mode === 'new' && yieldUnits > 0 ? Math.round((defaultTotal / yieldUnits) * 100) / 100 : 0;
        setAddForm({ ...addForm, mode, process_id: '', newName: '', totalMinutes: defaultTotal, time_per_unit_minutes: tpu });
    };

    const handleSelectProcess = (processId: string) => {
        if (!addForm) return;
        const proc = processes.find(p => p.id === processId);
        const yieldUnits = getRecipeYield(addForm.recipeId);
        let tpu = proc?.default_time_per_unit || 0;
        if (!tpu && proc && proc.expected_duration_minutes > 0 && yieldUnits > 0) {
            tpu = Math.round((proc.expected_duration_minutes / yieldUnits) * 100) / 100;
        }
        setAddForm({ ...addForm, process_id: processId, time_per_unit_minutes: tpu });
    };

    const handleTotalTimeChange = (totalMinutes: number) => {
        if (!addForm) return;
        const yieldUnits = getRecipeYield(addForm.recipeId);
        const tpu = yieldUnits > 0 ? Math.round((totalMinutes / yieldUnits) * 100) / 100 : 0;
        setAddForm({ ...addForm, totalMinutes, time_per_unit_minutes: tpu });
    };

    const handleSaveProcess = async () => {
        if (!addForm) return;
        try {
            const recipeId = addForm.recipeId;
            const existing = recipeProcesses[recipeId] || [];
            let processId = addForm.process_id;
            const tpu = addForm.time_per_unit_minutes;

            if (addForm.mode === 'new') {
                if (!addForm.newName.trim() || addForm.totalMinutes <= 0) return;
                const created = await createProcess({
                    name: addForm.newName.trim(),
                    expected_duration_minutes: addForm.totalMinutes,
                } as Omit<ProductionProcess, 'id'>);
                processId = created.id;
            } else {
                if (!processId) return;
            }

            if (tpu <= 0) return;

            await addRecipeProcess(recipeId, {
                process_id: processId,
                sort_order: existing.length,
                time_per_unit_minutes: tpu,
            });

            const rps = await fetchRecipeProcesses(recipeId);
            setRecipeProcesses(prev => ({ ...prev, [recipeId]: rps }));
            await loadProcesses();
            setAddForm(null);
        } catch { /* hook trata */ }
    };

    const handleRemoveRecipeProcess = async (recipeId: string, rpId: string) => {
        if (!confirm('Remover este processo da receita?')) return;
        try {
            await deleteRecipeProcess(rpId);
            setRecipeProcesses(prev => ({
                ...prev,
                [recipeId]: (prev[recipeId] || []).filter(rp => rp.id !== rpId),
            }));
        } catch { /* hook trata */ }
    };

    // --- Edição inline com cascata ---
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
        });
        const usage = await getProcessUsageCount(proc.id);
        setUsageInfo(usage);
        setEditModal(true);
    };

    const handleEditSave = async () => {
        if (!editForm) return;
        try {
            await updateProcessCascade(editForm.processId, {
                name: editForm.name,
                time_per_unit_minutes: editForm.time_per_unit_minutes,
            });
            // Recarregar dados
            await loadProcesses();
            // Recarregar processos da receita expandida
            if (expandedRecipe) {
                const rps = await fetchRecipeProcesses(expandedRecipe);
                setRecipeProcesses(prev => ({ ...prev, [expandedRecipe]: rps }));
            }
            setEditModal(false);
            setEditForm(null);
            setUsageInfo(null);
        } catch { /* hook trata */ }
    };

    const handleDeleteProcess = async () => {
        if (!editForm) return;
        const usage = usageInfo;
        const msg = usage && usage.count > 0
            ? `Deletar "${editForm.name}"? Será removido de ${usage.count} receita(s): ${usage.recipes.join(', ')}`
            : `Deletar "${editForm.name}"?`;
        if (!confirm(msg)) return;
        try {
            await deleteProcess(editForm.processId);
            await loadProcesses();
            if (expandedRecipe) {
                const rps = await fetchRecipeProcesses(expandedRecipe);
                setRecipeProcesses(prev => ({ ...prev, [expandedRecipe]: rps }));
            }
            setEditModal(false);
            setEditForm(null);
        } catch { /* hook trata */ }
    };

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${Math.round(minutes)} min`;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
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
            </div>

            {recipes.length === 0 && !loading && (
                <div className="text-center py-8 bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                    <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhuma receita de produto encontrada.</p>
                </div>
            )}

            <div className="space-y-3">
                {recipes.map(recipe => {
                    const isExpanded = expandedRecipe === recipe.id;
                    const rps = recipeProcesses[recipe.id] || [];
                    const totalMinutes = rps.reduce((sum, rp) => sum + recipe.yield_units * rp.time_per_unit_minutes, 0);

                    return (
                        <div key={recipe.id} className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleRecipe(recipe.id)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {isExpanded
                                        ? <ChevronDown size={18} className="text-primary shrink-0" />
                                        : <ChevronRight size={18} className="text-gray-400 shrink-0" />
                                    }
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-gray-900 font-heading truncate">{recipe.name}</h4>
                                        <span className="text-xs text-gray-500">
                                            {recipe.yield_units} un
                                            {rps.length > 0 && ` · ${rps.length} processo${rps.length > 1 ? 's' : ''} · ${formatDuration(totalMinutes)}`}
                                        </span>
                                    </div>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-gray-100 px-6 py-4">
                                    {rps.length === 0 && (
                                        <p className="text-sm text-gray-400 mb-3">Nenhum processo vinculado.</p>
                                    )}

                                    {rps.map((rp, idx) => (
                                        <div key={rp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-3">
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
                                                    onClick={() => openEditProcess(rp, recipe)}
                                                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                                                    title="Editar processo"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveRecipeProcess(recipe.id, rp.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remover da receita"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Form adicionar processo */}
                                    {addForm?.recipeId === recipe.id ? (
                                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex gap-1 mb-4 bg-gray-200 rounded-lg p-0.5 w-fit">
                                                <button
                                                    type="button"
                                                    onClick={() => handleModeChange('existing')}
                                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${addForm.mode === 'existing' ? 'bg-white text-primary shadow-sm' : 'text-gray-600'}`}
                                                >
                                                    Existente
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleModeChange('new')}
                                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${addForm.mode === 'new' ? 'bg-white text-primary shadow-sm' : 'text-gray-600'}`}
                                                >
                                                    Novo
                                                </button>
                                            </div>

                                            {addForm.mode === 'existing' ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Processo</label>
                                                        <select
                                                            value={addForm.process_id}
                                                            onChange={e => handleSelectProcess(e.target.value)}
                                                            className="w-full border border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {processes.map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name}
                                                                    {p.default_time_per_unit ? ` (${p.default_time_per_unit} min/un)` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {addForm.process_id && addForm.time_per_unit_minutes > 0 && (
                                                        <div className="flex items-center gap-3 text-sm text-gray-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                                                            <Clock size={14} className="text-amber-600" />
                                                            <span>{addForm.time_per_unit_minutes} min/un × {recipe.yield_units} un = <strong>{formatDuration(addForm.time_per_unit_minutes * recipe.yield_units)}</strong></span>
                                                        </div>
                                                    )}
                                                    {addForm.process_id && !addForm.time_per_unit_minutes && (
                                                        <p className="text-xs text-amber-600">Processo sem tempo/un cadastrado. Vincule primeiro a uma receita pelo modo "Novo".</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Nome do processo</label>
                                                        <input
                                                            type="text"
                                                            placeholder='Ex: "Montagem de Lasanha"'
                                                            value={addForm.newName}
                                                            onChange={e => setAddForm({ ...addForm, newName: e.target.value })}
                                                            className="w-full border border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-xs text-gray-500 mb-1">
                                                                Tempo total p/ {recipe.yield_units} un (min)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={addForm.totalMinutes}
                                                                onChange={e => handleTotalTimeChange(Number(e.target.value))}
                                                                className="w-full border border-gray-300 rounded-md shadow-sm text-sm px-3 py-2"
                                                            />
                                                        </div>
                                                        <div className="pt-5">
                                                            <span className="text-sm text-gray-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md">
                                                                = <strong>{addForm.time_per_unit_minutes}</strong> min/un
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 mt-4">
                                                <button
                                                    onClick={() => setAddForm(null)}
                                                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-100"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleSaveProcess}
                                                    disabled={loading || (addForm.mode === 'existing' ? !addForm.process_id || addForm.time_per_unit_minutes <= 0 : !addForm.newName.trim() || addForm.time_per_unit_minutes <= 0)}
                                                    className="px-4 py-1.5 bg-primary text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90"
                                                >
                                                    {loading ? 'Salvando...' : 'Salvar'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => openAddForm(recipe.id)}
                                            className="mt-3 text-sm text-primary hover:underline flex items-center"
                                        >
                                            <Plus size={14} className="mr-1" /> Adicionar processo
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal Editar Processo (com cascata) */}
            {editModal && editForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900 font-heading">Editar Processo</h3>
                            <button onClick={() => { setEditModal(false); setEditForm(null); setUsageInfo(null); }} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {usageInfo && usageInfo.count > 1 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                                    <strong>Atenção:</strong> esse processo é usado em {usageInfo.count} receita(s): {usageInfo.recipes.join(', ')}. A alteração será aplicada em todas.
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tempo total p/ {editForm.yieldUnits} un de {editForm.recipeName} (min)
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={editForm.totalMinutes}
                                        onChange={e => {
                                            const total = Number(e.target.value);
                                            const tpu = editForm.yieldUnits > 0 ? Math.round((total / editForm.yieldUnits) * 100) / 100 : 0;
                                            setEditForm({ ...editForm, totalMinutes: total, time_per_unit_minutes: tpu });
                                        }}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary px-3 py-2"
                                    />
                                </div>
                                <div className="pt-5">
                                    <span className="text-sm text-gray-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md">
                                        = <strong>{editForm.time_per_unit_minutes}</strong> min/un
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-between border-t border-gray-100">
                                <button
                                    onClick={handleDeleteProcess}
                                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                >
                                    <Trash2 size={14} className="inline mr-1" /> Deletar
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setEditModal(false); setEditForm(null); setUsageInfo(null); }}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleEditSave}
                                        disabled={loading || !editForm.name.trim() || editForm.totalMinutes <= 0}
                                        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {loading ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
