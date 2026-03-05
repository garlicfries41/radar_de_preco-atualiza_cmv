import { useState, useEffect } from 'react';
import { getRecipes, updateRecipe, deleteRecipe, getRecipe, createRecipe } from '../../services/api';
import type { Recipe } from '../../types';
import { Loader2, ChefHat, Plus, Pencil, Trash2, Search, FlaskConical, Archive, ArrowLeft, TrendingUp, ArchiveRestore, Copy } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/text';

type Mode = 'ativo' | 'rascunho' | 'inativo';

export function RecipesList() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('ativo');
    // View State
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [promotingId, setPromotingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchRecipes = async (status: Mode = mode) => {
        setLoading(true);
        try {
            const data = await getRecipes(status);
            setRecipes(data);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar receitas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecipes(mode);
    }, [mode]);

    const switchMode = (newMode: Mode) => {
        setMode(newMode);
        setSearchTerm('');
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta receita?')) return;
        try {
            await deleteRecipe(id);
            toast.success('Receita excluída');
            fetchRecipes();
        } catch {
            toast.error('Erro ao excluir receita');
        }
    };

    const handleEdit = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setEditingId(id);
        setIsCreating(true);
    };

    const handleClone = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const recipeToClone = await getRecipe(id);
            if (!recipeToClone) return;

            const cloneForm = {
                name: '', // Nome em branco conforme solicitado
                yield_units: recipeToClone.yield_units,
                labor_minutes: recipeToClone.labor_minutes || 0,
                labor_cost: recipeToClone.labor_cost || 0,
                is_pre_preparo: recipeToClone.is_pre_preparo,
                production_unit: recipeToClone.production_unit || 'KG',
                net_weight: recipeToClone.net_weight,
                status: 'rascunho',
                ingredients: recipeToClone.ingredients?.map(i => ({
                    ingredient_id: i.ingredient_id,
                    quantity: i.quantity
                })) || []
            };

            await createRecipe(cloneForm);
            toast.success('Receita clonada para o ReceitaLab!');

            if (mode !== 'rascunho') {
                switchMode('rascunho');
            } else {
                fetchRecipes();
            }
        } catch (error) {
            console.error('Error cloning recipe:', error);
            toast.error('Erro ao clonar receita');
        }
    };

    const handleChangeStatus = async (e: React.MouseEvent, id: string, newStatus: string, label: string, openEdit = false) => {
        e.stopPropagation();
        try {
            const recipe = recipes.find(r => r.id === id);
            if (!recipe) return;
            await updateRecipe(id, { ...recipe, status: newStatus, ingredients: recipe.ingredients?.map(i => ({ ingredient_id: i.ingredient_id, quantity: i.quantity })) ?? [] });
            toast.success(label);
            if (openEdit) {
                // After promoting: open edit form with product highlight
                setPromotingId(id);
                setEditingId(id);
                setIsCreating(true);
            } else {
                fetchRecipes();
            }
        } catch {
            toast.error('Erro ao atualizar status');
        }
    };

    const closeForm = () => {
        setIsCreating(false);
        setEditingId(null);
        setPromotingId(null);
    };

    if (isCreating) {
        return (
            <RecipeForm
                recipeId={editingId}
                defaultStatus={promotingId ? 'ativo' : (mode === 'rascunho' ? 'rascunho' : 'ativo')}
                highlightProduct={!!promotingId}
                onClose={closeForm}
                onSuccess={() => {
                    closeForm();
                    fetchRecipes();
                }}
            />
        );
    }

    if (loading && recipes.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    const modeConfig = {
        ativo: {
            title: 'Receitas & CMV',
            emptyMsg: 'Nenhuma receita cadastrada.',
            badgeClass: '',
            badgeLabel: '',
        },
        rascunho: {
            title: '⚗️ ReceitaLab',
            emptyMsg: 'Nenhuma receita em teste.',
            badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
            badgeLabel: 'RASCUNHO',
        },
        inativo: {
            title: '🗄️ Receitas Inativas',
            emptyMsg: 'Nenhuma receita inativada.',
            badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
            badgeLabel: 'INATIVO',
        },
    };

    const cfg = modeConfig[mode];
    const filtered = recipes.filter(r =>
        !r.is_pre_preparo && normalizeText(r.name).includes(normalizeText(searchTerm))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    {mode !== 'ativo' && (
                        <button
                            onClick={() => switchMode('ativo')}
                            className="p-2 text-[#6b7280] hover:text-[#111827] hover:bg-[#f9fafb] rounded-lg transition-colors"
                            title="Voltar para Receitas"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-[#111827] whitespace-nowrap">{cfg.title}</h2>
                </div>

                <div className="flex-1 max-w-md w-full relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar receitas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-[#e5e7eb] rounded-lg pl-10 pr-4 py-2 text-[#111827] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#16a34a] outline-none transition-shadow shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {mode === 'ativo' && (
                        <>
                            <button
                                onClick={() => switchMode('rascunho')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors text-sm font-medium"
                                title="ReceitaLab – receitas em teste"
                            >
                                <FlaskConical size={16} />
                                ReceitaLab
                            </button>
                            <button
                                onClick={() => switchMode('inativo')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300 transition-colors text-sm font-medium"
                                title="Receitas Inativas"
                            >
                                <Archive size={16} />
                                Inativas
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-[#15803d] hover:bg-[#166534] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shadow-sm"
                    >
                        <Plus size={20} />
                        {mode === 'rascunho' ? 'Novo Rascunho' : 'Nova Receita'}
                    </button>
                </div>
            </div>

            {/* Mode description banner */}
            {mode === 'rascunho' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
                    ⚗️ Receitas em teste — sem vínculo com produtos. Use para explorar custos e valores nutricionais livremente.
                </div>
            )}
            {mode === 'inativo' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">
                    🗄️ Receitas inativadas não aparecem no painel principal. Reative quando necessário.
                </div>
            )}

            {/* Recipe Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((recipe) => (
                    <div
                        key={recipe.id}
                        className="bg-white rounded-xl border border-[#e5e7eb] p-4 hover:border-[#d1d5db] hover:shadow-md transition-all flex items-center justify-between gap-4"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                                <h3 className="font-bold text-[#111827] text-lg leading-tight break-words flex-1 min-w-0" title={recipe.name}>{recipe.name}</h3>
                                {cfg.badgeLabel && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 shrink-0 ${cfg.badgeClass}`}>
                                        {cfg.badgeLabel}
                                    </span>
                                )}
                            </div>
                            <p className="text-[#6b7280] text-sm mt-1 truncate">
                                Rendimento: {recipe.yield_units} un
                                {recipe.sku && <span className="ml-2 text-xs bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">SKU: {recipe.sku}</span>}
                            </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                                <div className="text-xs text-[#6b7280] leading-none mb-1">Custo UN</div>
                                <div className="text-xl font-bold text-[#15803d] leading-none">
                                    R$ {recipe.cmv_per_unit?.toFixed(2) || '0.00'}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 border-l border-[#e5e7eb] pl-4">
                                {/* Promote (draft → active) */}
                                {mode === 'rascunho' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, recipe.id, 'ativo', 'Receita promovida! Vincule um produto abaixo.', true)}
                                        className="p-2 text-amber-600 hover:text-[#15803d] hover:bg-[#f0fdf4] rounded transition-colors"
                                        title="Promover para Receitas Ativas"
                                    >
                                        <TrendingUp size={18} />
                                    </button>
                                )}
                                {/* Reactivate (inactive → active) */}
                                {mode === 'inativo' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, recipe.id, 'ativo', 'Receita reativada!')}
                                        className="p-2 text-[#9ca3af] hover:text-[#15803d] hover:bg-[#f0fdf4] rounded transition-colors"
                                        title="Reativar Receita"
                                    >
                                        <ArchiveRestore size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleEdit(e, recipe.id)}
                                    className="p-2 text-[#9ca3af] hover:text-[#111827] hover:bg-[#f9fafb] rounded transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={18} />
                                </button>
                                {(mode === 'ativo' || mode === 'rascunho') && (
                                    <button
                                        onClick={(e) => handleClone(e, recipe.id)}
                                        className="p-2 text-[#9ca3af] hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Clonar Receita"
                                    >
                                        <Copy size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleDelete(e, recipe.id)}
                                    className="p-2 text-[#9ca3af] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[#6b7280] bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <ChefHat size={48} className="mx-auto mb-3 opacity-20" />
                        <p>{cfg.emptyMsg}</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-4 text-[#15803d] hover:underline text-sm font-medium"
                        >
                            {mode === 'rascunho' ? 'Criar primeiro rascunho' : 'Criar primeira receita'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
