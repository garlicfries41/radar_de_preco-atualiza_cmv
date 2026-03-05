import { useState, useEffect } from 'react';
import { getRecipes, deleteRecipe } from '../../services/api';
import type { Recipe } from '../../types';
import { Loader2, ChefHat, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/text';

export function PrePreparosList() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    // View State
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchRecipes = async () => {
        setLoading(true);
        try {
            const data = await getRecipes();
            setRecipes(data);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar pré-preparos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta sub-receita?')) return;

        try {
            await deleteRecipe(id);
            toast.success('Pré-preparo excluído');
            fetchRecipes();
        } catch (error) {
            toast.error('Erro ao excluir pré-preparo');
        }
    };

    const handleEdit = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setEditingId(id);
        setIsCreating(true);
    };

    const closeForm = () => {
        setIsCreating(false);
        setEditingId(null);
    };

    if (isCreating) {
        return (
            <RecipeForm
                recipeId={editingId}
                onClose={closeForm}
                isPrePreparo={true}
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

    const filteredRecipes = recipes.filter(r =>
        r.is_pre_preparo && normalizeText(r.name).includes(normalizeText(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-text-primary font-serif whitespace-nowrap">Pré-preparos (Sub-receitas)</h2>

                <div className="flex-1 max-w-md w-full relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar pré-preparos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2 text-text-primary focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>

                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-accent hover:opacity-90 text-text-primary font-medium border border-border px-4 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                    <Plus size={20} />
                    Novo Pré-preparo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRecipes.map((recipe) => (
                    <div
                        key={recipe.id}
                        className="bg-surface rounded-xl border-2 border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-4"
                    >
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-text-primary text-lg leading-tight truncate" title={recipe.name}>{recipe.name}</h3>
                            <p className="text-text-secondary text-sm mt-1 truncate">
                                Rendimento: {recipe.yield_units} {recipe.production_unit || 'KG'}
                            </p>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                            <div className="text-right">
                                <div className="text-xs text-text-secondary leading-none mb-1">Custo {recipe.production_unit || 'KG'}</div>
                                <div className="text-xl font-bold text-primary leading-none">
                                    R$ {recipe.cmv_per_unit?.toFixed(2) || '0.00'}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 border-l border-border pl-4">
                                <button
                                    onClick={(e) => handleEdit(e, recipe.id)}
                                    className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-alt rounded transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, recipe.id)}
                                    className="p-2 text-text-secondary hover:text-red-400 hover:bg-surface-alt rounded transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredRecipes.length === 0 && (
                    <div className="col-span-full py-12 text-center text-text-tertiary bg-background rounded-xl border border-dashed border-border">
                        <ChefHat size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Nenhum pré-preparo cadastrado.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-4 text-primary hover:underline text-sm"
                        >
                            Criar primeiro pré-preparo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
