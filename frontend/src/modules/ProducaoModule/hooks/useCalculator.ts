import { useState, useCallback } from 'react';

export interface RecipeIngredient {
    ingredient_id: string;
    quantity: number;
    ingredients: {
        name: string;
        unit: string;
        category?: string;
    };
    // Sub-ingredientes (expandidos no frontend quando category === "Pré-preparo")
    sub_ingredients?: SubIngredient[];
    sub_recipe_yield?: number; // yield_units da sub-receita (para calcular proporção)
}

export interface SubIngredient {
    ingredient_id: string;
    quantity: number;
    ingredients: {
        name: string;
        unit: string;
    };
}

export interface RecipeWithIngredients {
    id: string;
    name: string;
    yield_units: number;
    total_weight_kg: number;
    sauce_yield_kg?: number;
    production_unit?: string;
    is_pre_preparo?: boolean;
    recipe_ingredients: RecipeIngredient[];
}

const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `${window.location.protocol}//${hostname}:8000`;
        }
    }
    return 'http://localhost:8000';
};

const API_BASE_URL = getApiUrl();

export function useCalculator() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Busca lista simplificada para o select
    const fetchRecipesList = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/recipes?status=ativo`);
            if (!res.ok) throw new Error('Erro ao buscar receitas');
            return await res.json();
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Busca a receita que produz um dado ingredient_id (para expandir pré-preparos)
    const findRecipeByDerivedIngredient = useCallback(async (ingredientId: string): Promise<RecipeWithIngredients | null> => {
        try {
            // Busca todas as receitas que são pré-preparo
            const listRes = await fetch(`${API_BASE_URL}/api/recipes?status=ativo`);
            if (!listRes.ok) return null;
            const allRecipes = await listRes.json();
            const match = allRecipes.find((r: any) => r.derived_ingredient_id === ingredientId);
            if (!match) return null;

            // Busca detalhes dessa sub-receita
            const detailRes = await fetch(`${API_BASE_URL}/api/recipes/${match.id}`);
            if (!detailRes.ok) return null;
            const data = await detailRes.json();
            if (data.ingredients && !data.recipe_ingredients) {
                data.recipe_ingredients = data.ingredients;
            }
            return data;
        } catch {
            return null;
        }
    }, []);

    // Busca uma receita específica com seus ingredientes aninhados + expande pré-preparos
    const fetchRecipeDetails = useCallback(async (recipeId: string): Promise<RecipeWithIngredients | null> => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}`);
            if (!res.ok) throw new Error('Erro ao buscar detalhes da receita');
            const data = await res.json();
            // Backend retorna "ingredients", mas a UI espera "recipe_ingredients"
            if (data.ingredients && !data.recipe_ingredients) {
                data.recipe_ingredients = data.ingredients;
            }

            // Expandir sub-ingredientes para itens que são Pré-preparo
            const enriched = await Promise.all(
                (data.recipe_ingredients || []).map(async (ing: RecipeIngredient) => {
                    const cat = ing.ingredients?.category?.toLowerCase() || '';
                    if (cat.includes('pré-preparo') || cat.includes('pre-preparo')) {
                        const subRecipe = await findRecipeByDerivedIngredient(ing.ingredient_id);
                        if (subRecipe) {
                            return {
                                ...ing,
                                sub_ingredients: subRecipe.recipe_ingredients,
                                sub_recipe_yield: subRecipe.yield_units,
                            };
                        }
                    }
                    return ing;
                })
            );

            data.recipe_ingredients = enriched;
            return data;
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [findRecipeByDerivedIngredient]);

    return {
        loading,
        error,
        fetchRecipesList,
        fetchRecipeDetails
    };
}
