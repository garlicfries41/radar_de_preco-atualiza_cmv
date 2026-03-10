import { useState, useCallback } from 'react';

export interface RecipeIngredient {
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

    // Busca uma receita específica com seus ingredientes aninhados
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
            return data;
        } catch (err: any) {
            setError(err.message);
            console.error(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        fetchRecipesList,
        fetchRecipeDetails
    };
}
