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
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            title="Voltar para Receitas"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-white whitespace-nowrap">{cfg.title}</h2>
                </div>

                <div className="flex-1 max-w-md w-full relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar receitas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {mode === 'ativo' && (
                        <>
                            <button
                                onClick={() => switchMode('rascunho')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-colors text-sm font-medium"
                                title="ReceitaLab – receitas em teste"
                            >
                                <FlaskConical size={16} />
                                ReceitaLab
                            </button>
                            <button
                                onClick={() => switchMode('inativo')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-700 border border-gray-600 transition-colors text-sm font-medium"
                                title="Receitas Inativas"
                            >
                                <Archive size={16} />
                                Inativas
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-primary hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                        <Plus size={20} />
                        {mode === 'rascunho' ? 'Novo Rascunho' : 'Nova Receita'}
                    </button>
                </div>
            </div>

            {/* Mode description banner */}
            {mode === 'rascunho' && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 text-sm text-amber-300">
                    ⚗️ Receitas em teste — sem vínculo com produtos. Use para explorar custos e valores nutricionais livremente.
                </div>
            )}
            {mode === 'inativo' && (
                <div className="bg-gray-700/40 border border-gray-600 rounded-lg px-4 py-2 text-sm text-gray-400">
                    🗄️ Receitas inativadas não aparecem no painel principal. Reative quando necessário.
                </div>
            )}

            {/* Recipe Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((recipe) => (
                    <div
                        key={recipe.id}
                        className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors flex items-center justify-between gap-4"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-white text-lg leading-tight truncate" title={recipe.name}>{recipe.name}</h3>
                                {cfg.badgeLabel && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badgeClass}`}>
                                        {cfg.badgeLabel}
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-400 text-sm mt-1 truncate">
                                Rendimento: {recipe.yield_units} un
                                {recipe.sku && <span className="ml-2 text-xs bg-gray-700 px-1.5 py-0.5 rounded">SKU: {recipe.sku}</span>}
                            </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 leading-none mb-1">Custo UN</div>
                                <div className="text-xl font-bold text-emerald-400 leading-none">
                                    R$ {recipe.cmv_per_unit?.toFixed(2) || '0.00'}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 border-l border-gray-700 pl-4">
                                {/* Promote (draft → active) */}
                                {mode === 'rascunho' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, recipe.id, 'ativo', 'Receita promovida! Vincule um produto abaixo.', true)}
                                        className="p-2 text-amber-400 hover:text-emerald-400 hover:bg-gray-700 rounded transition-colors"
                                        title="Promover para Receitas Ativas"
                                    >
                                        <TrendingUp size={18} />
                                    </button>
                                )}
                                {/* Reactivate (inactive → active) */}
                                {mode === 'inativo' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, recipe.id, 'ativo', 'Receita reativada!')}
                                        className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-700 rounded transition-colors"
                                        title="Reativar Receita"
                                    >
                                        <ArchiveRestore size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleEdit(e, recipe.id)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={18} />
                                </button>
                                {(mode === 'ativo' || mode === 'rascunho') && (
                                    <button
                                        onClick={(e) => handleClone(e, recipe.id)}
                                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                                        title="Clonar Receita"
                                    >
                                        <Copy size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleDelete(e, recipe.id)}
                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-800/50 rounded-lg border border-dashed border-gray-700">
                        <ChefHat size={48} className="mx-auto mb-3 opacity-20" />
                        <p>{cfg.emptyMsg}</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-4 text-primary hover:underline text-sm"
                        >
                            {mode === 'rascunho' ? 'Criar primeiro rascunho' : 'Criar primeira receita'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
