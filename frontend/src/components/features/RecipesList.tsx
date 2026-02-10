import { useState, useEffect } from 'react';
import { getRecipes } from '../../services/api';
import type { Recipe } from '../../types';
import { Loader2, ChefHat, Info, Plus, Pencil, Trash2 } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import { deleteRecipe } from '../../services/api';
import toast from 'react-hot-toast';

export function RecipesList() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);

    // View State
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const fetchRecipes = async () => {
        setLoading(true);
        try {
            const data = await getRecipes();
            setRecipes(data);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar receitas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta receita?')) return;

        try {
            await deleteRecipe(id);
            toast.success('Receita excluída');
            fetchRecipes();
        } catch (error) {
            toast.error('Erro ao excluir receita');
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Receitas & CMV</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-primary hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} />
                    Nova Receita
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipes.map((recipe) => (
                    <div
                        key={recipe.id}
                        className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors cursor-pointer"
                        onClick={() => setSelectedRecipe(selectedRecipe === recipe.id ? null : recipe.id)}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-700 rounded-lg text-primary">
                                    <ChefHat size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg leading-tight">{recipe.name}</h3>
                                    <p className="text-gray-400 text-sm">
                                        Rendimento: {recipe.yield_units} un
                                        {recipe.sku && <span className="ml-2 text-xs bg-gray-700 px-1.5 py-0.5 rounded">SKU: {recipe.sku}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-400">Custo UN</div>
                                <div className="text-xl font-bold text-emerald-400">
                                    R$ {recipe.cmv_per_unit?.toFixed(2) || '0.00'}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleEdit(e, recipe.id)}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, recipe.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-center text-xs text-primary font-medium">
                                <Info size={14} className="mr-1" />
                                {selectedRecipe === recipe.id ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                            </div>
                        </div>

                        {selectedRecipe === recipe.id && (
                            <div className="mt-4 pt-3 border-t border-gray-700 bg-gray-900/50 rounded-md p-3">
                                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                                    <div>
                                        <span className="text-gray-500 block text-xs">Custo Total</span>
                                        <span className="text-white font-mono">R$ {recipe.current_cost?.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Mão de Obra</span>
                                        <span className="text-white font-mono">R$ {recipe.labor_cost?.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Peso Total</span>
                                        <span className="text-white font-mono">{recipe.total_weight_kg?.toFixed(3)} kg</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">CMV / KG</span>
                                        <span className="text-white font-mono">R$ {recipe.cmv_per_kg?.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {recipes.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-800/50 rounded-lg border border-dashed border-gray-700">
                        <ChefHat size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Nenhuma receita cadastrada.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-4 text-primary hover:underline text-sm"
                        >
                            Criar primeira receita
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
