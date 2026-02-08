import { useState, useEffect } from 'react';
import { getRecipes } from '../../services/api';
import type { Recipe } from '../../types';
import { Loader2, ChefHat, Info } from 'lucide-react';

export function RecipesList() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const data = await getRecipes();
                setRecipes(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
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
                                <p className="text-gray-400 text-sm">Rendimento: {recipe.yield_units} un</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-400">Custo UN</div>
                            <div className="text-xl font-bold text-emerald-400">R$ {recipe.cost_per_unit?.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
                        <span className="text-xs text-gray-500 font-mono">ID: {recipe.id.slice(0, 8)}...</span>
                        <div className="flex items-center text-xs text-primary font-medium">
                            <Info size={14} className="mr-1" />
                            {selectedRecipe === recipe.id ? 'Ocultar Detalhes' : 'Ver Ingredientes'}
                        </div>
                    </div>

                    {selectedRecipe === recipe.id && (
                        <div className="mt-4 pt-3 border-t border-gray-700 bg-gray-900/50 rounded-md p-3">
                            <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Composição</h4>
                            <div className="space-y-1">
                                {recipe.ingredients?.map((ing, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-300">{ing.ingredient_name}</span>
                                        <span className="text-gray-500 font-mono">
                                            {ing.quantity} {ing.unit}
                                        </span>
                                    </div>
                                ))}
                                {(!recipe.ingredients || recipe.ingredients.length === 0) && (
                                    <span className="text-gray-500 text-xs italic">Sem ingredientes vinculados via backend mock.</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {recipes.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-gray-800/50 rounded-lg border border-dashed border-gray-700">
                    <ChefHat size={48} className="mx-auto mb-3 opacity-20" />
                    <p>Nenhuma receita cadastrada.</p>
                </div>
            )}
        </div>
    );
}
