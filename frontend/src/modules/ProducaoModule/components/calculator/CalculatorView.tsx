import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Save, UtensilsCrossed, Scale, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { useCalculator } from '../../hooks/useCalculator';
import type { RecipeWithIngredients, RecipeIngredient } from '../../hooks/useCalculator';

const EGG_WEIGHT_GRAMS = 52;

export const CalculatorView: React.FC = () => {
    const { fetchRecipesList, fetchRecipeDetails, loading } = useCalculator();

    // States
    const [recipesList, setRecipesList] = useState<any[]>([]);
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
    const [activeRecipe, setActiveRecipe] = useState<RecipeWithIngredients | null>(null);

    // Interactive Inputs
    const [baseIngredientId, setBaseIngredientId] = useState<string>('');
    const [baseQuantityInput, setBaseQuantityInput] = useState<number | ''>('');

    // Sub-ingredient expansion state
    const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

    // Initial Load
    useEffect(() => {
        loadList();
    }, []);

    const loadList = async () => {
        const list = await fetchRecipesList();
        setRecipesList(list);
    };

    // When Recipe Selected => Fetch Details
    useEffect(() => {
        const loadDetails = async () => {
            if (!selectedRecipeId) {
                setActiveRecipe(null);
                setBaseIngredientId('');
                setBaseQuantityInput('');
                setExpandedSubs(new Set());
                return;
            }
            const details = await fetchRecipeDetails(selectedRecipeId);
            setActiveRecipe(details);
            setExpandedSubs(new Set());

            // Auto-select first ingredient as base if available
            if (details?.recipe_ingredients?.length) {
                setBaseIngredientId(details.recipe_ingredients[0].ingredient_id);
                setBaseQuantityInput(details.recipe_ingredients[0].quantity);
            }
        };
        loadDetails();
    }, [selectedRecipeId]);

    const toggleSubExpansion = (ingredientId: string) => {
        setExpandedSubs(prev => {
            const next = new Set(prev);
            if (next.has(ingredientId)) next.delete(ingredientId);
            else next.add(ingredientId);
            return next;
        });
    };

    // --- CORE CALCULATION LOGIC (Reverse Rule of 3) ---
    const calculationResults = useMemo(() => {
        if (!activeRecipe || !baseIngredientId || baseQuantityInput === '' || Number(baseQuantityInput) <= 0) {
            return null;
        }

        const originalBaseIngredient = activeRecipe.recipe_ingredients.find((ri: RecipeIngredient) => ri.ingredient_id === baseIngredientId);
        if (!originalBaseIngredient || originalBaseIngredient.quantity <= 0) return null;

        const inputQtd = Number(baseQuantityInput);
        const multiplier = inputQtd / originalBaseIngredient.quantity;

        // Scale all ingredients
        const scaledIngredients = activeRecipe.recipe_ingredients.map((ing: RecipeIngredient) => ({
            ...ing,
            scaled_quantity: ing.quantity * multiplier
        }));

        // Scale Outputs
        const expected_units = activeRecipe.yield_units * multiplier;
        const expected_sauce_kg = activeRecipe.sauce_yield_kg ? (activeRecipe.sauce_yield_kg * multiplier) : null;

        return {
            multiplier,
            scaledIngredients,
            expected_units,
            expected_sauce_kg
        };
    }, [activeRecipe, baseIngredientId, baseQuantityInput]);

    // Helper: detect if ingredient is egg
    const isEgg = (name: string) => /\bovo\b|\bovos\b|\begg\b/i.test(name);

    // Helper: detect if ingredient is "Massa Extrusada" (always show pre-cooked weight)
    const isMassaExtrusada = (name: string) => /massa\s+extrus/i.test(name);

    // Get production unit label
    const productionUnit = activeRecipe?.production_unit || 'UN';
    const unitLabel = productionUnit === 'KG' ? 'kg' : 'un';

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 pb-24 h-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold font-heading text-primary flex items-center">
                    <Calculator className="mr-3 text-primary/80" />
                    Calculadora de Lote Dinâmica
                </h1>
                <p className="text-sm text-gray-500 font-body mt-1">
                    Descubra quanto produzir baseando-se na quantidade de um ingrediente que você tem disponível.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT PANEL: INPUTS */}
                <div className="lg:col-span-5 space-y-6">

                    {/* STEP 1: Select Recipe */}
                    <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-5">
                        <h3 className="text-gray-900 font-bold mb-4 font-heading text-lg flex items-center">
                            <span className="bg-primary text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2">1</span>
                            Qual lote deseja produzir?
                        </h3>

                        {loading && !activeRecipe ? (
                            <p className="text-gray-400 text-sm animate-pulse">Carregando receitas...</p>
                        ) : (
                            <select
                                title="Selecione um lote..."
                                value={selectedRecipeId}
                                onChange={(e) => setSelectedRecipeId(e.target.value)}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-4 py-3 bg-gray-50 text-gray-800"
                            >
                                <option value="">-- Selecione uma Receita/Preparo --</option>
                                {recipesList.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} (Rend: {r.yield_units} {(r.production_unit || 'UN') === 'KG' ? 'kg' : 'un'})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* STEP 2: The Base Ingredient Input */}
                    <div className={`bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-5 transition-opacity duration-300 ${!activeRecipe ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <h3 className="text-gray-900 font-bold mb-4 font-heading text-lg flex items-center">
                            <span className="bg-primary text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2">2</span>
                            Base de Cálculo
                        </h3>

                        <p className="text-xs text-gray-500 mb-4 font-body">
                            A partir de qual ingrediente você quer basear este lote? Escolha o ingrediente e informe quanto você quer/pode usar dele.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente Guia</label>
                                <select
                                    title="Selecionar ingrediente guia..."
                                    value={baseIngredientId}
                                    onChange={(e) => setBaseIngredientId(e.target.value)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 bg-gray-50"
                                    disabled={!activeRecipe}
                                >
                                    <option value="">Selecione...</option>
                                    {activeRecipe?.recipe_ingredients.map((ing: RecipeIngredient) => (
                                        <option key={ing.ingredient_id} value={ing.ingredient_id}>
                                            {ing.ingredients.name} (Ref: {ing.quantity} {ing.ingredients.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade a Utilizar</label>
                                <div className="relative rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="block w-full rounded-lg border-gray-300 pl-4 pr-12 py-3 focus:border-primary focus:ring-primary sm:text-lg font-medium text-primary"
                                        placeholder="Ex: 5"
                                        value={baseQuantityInput}
                                        onChange={(e) => setBaseQuantityInput(e.target.value !== '' ? Number(e.target.value) : '')}
                                        disabled={!activeRecipe || !baseIngredientId}
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                        <span className="text-gray-500 sm:text-sm font-medium">
                                            {activeRecipe?.recipe_ingredients.find((i: RecipeIngredient) => i.ingredient_id === baseIngredientId)?.ingredients.unit || '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* RIGHT PANEL: RESULTS */}
                <div className="lg:col-span-7">
                    <div className="bg-white rounded-xl shadow-md border border-primary/20 h-full overflow-hidden flex flex-col relative">

                        {/* Header Result */}
                        <div className="bg-primary text-white px-6 py-5">
                            <h2 className="text-xl font-bold font-heading flex items-center">
                                <Target className="mr-2 opacity-80" /> Plano de Produção
                            </h2>
                            {activeRecipe && (
                                <p className="opacity-90 mt-1 font-body text-sm">
                                    Receita: <strong>{activeRecipe.name}</strong>
                                </p>
                            )}
                        </div>

                        {/* Content Result */}
                        <div className="flex-1 p-6 bg-gray-50">

                            {!activeRecipe ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8">
                                    <UtensilsCrossed size={48} className="mb-4 opacity-20" />
                                    <p className="font-medium text-gray-500">Selecione uma receita à esquerda para liberar a calculadora.</p>
                                </div>
                            ) : !calculationResults ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8">
                                    <Scale size={48} className="mb-4 opacity-20 text-primary" />
                                    <p className="font-medium text-gray-500 max-w-sm">Insira o ingrediente base e a quantidade desejada para calcular as proporções da receita.</p>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                                    {/* Summary / Yield Cards */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-white rounded-lg p-3 border border-green-100 shadow-sm border-l-4 border-l-green-500">
                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                                                Rendimento ({unitLabel})
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900 font-heading">
                                                {calculationResults.expected_units.toFixed(2)}
                                                <span className="text-sm font-normal text-gray-500 ml-1">{unitLabel}</span>
                                            </p>
                                        </div>

                                        {calculationResults.expected_sauce_kg !== null ? (
                                            <div className="bg-white rounded-lg p-3 border border-purple-100 shadow-sm border-l-4 border-l-purple-500">
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Molho/Recheio</p>
                                                <p className="text-2xl font-bold text-gray-900 font-heading">
                                                    {calculationResults.expected_sauce_kg.toFixed(2)}
                                                    <span className="text-sm font-normal text-gray-500 ml-1">kg</span>
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm border-l-4 border-l-gray-300">
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Fator</p>
                                                <p className="text-2xl font-bold text-gray-900 font-heading">
                                                    {calculationResults.multiplier.toFixed(2)}
                                                    <span className="text-sm font-normal text-gray-500 ml-1">x</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Lista de Ingredientes Necessária</h3>

                                    {/* Ingredients List */}
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                        <ul className="divide-y divide-gray-100">
                                            {calculationResults.scaledIngredients.map((ing: RecipeIngredient & { scaled_quantity: number }) => {
                                                const isBase = ing.ingredient_id === baseIngredientId;
                                                const hasSubs = ing.sub_ingredients && ing.sub_ingredients.length > 0;
                                                const isExpanded = expandedSubs.has(ing.ingredient_id);
                                                const ingName = ing.ingredients.name;
                                                const ingUnit = ing.ingredients.unit;

                                                // Cálculos auxiliares
                                                const eggCount = isEgg(ingName) && ingUnit?.toLowerCase() === 'kg'
                                                    ? Math.round((ing.scaled_quantity * 1000) / EGG_WEIGHT_GRAMS)
                                                    : null;

                                                const massaPreCozida = isMassaExtrusada(ingName)
                                                    ? ing.scaled_quantity * 1.28
                                                    : null;

                                                // Proporção do sub-preparo para escalar sub-ingredientes
                                                const subScale = hasSubs && ing.sub_recipe_yield
                                                    ? ing.scaled_quantity / ing.sub_recipe_yield
                                                    : 1;

                                                return (
                                                    <li key={ing.ingredient_id} className={isBase ? 'bg-primary/5' : ''}>
                                                        <div className={`px-4 py-3 flex justify-between items-center ${hasSubs ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                                            onClick={() => hasSubs && toggleSubExpansion(ing.ingredient_id)}
                                                        >
                                                            <div className="flex items-center">
                                                                {hasSubs && (
                                                                    isExpanded
                                                                        ? <ChevronDown size={14} className="mr-1 text-gray-400" />
                                                                        : <ChevronRight size={14} className="mr-1 text-gray-400" />
                                                                )}
                                                                {isBase && !hasSubs && <span className="w-2 h-2 rounded-full bg-primary mr-2" title="Ingrediente Base"></span>}
                                                                <div>
                                                                    <span className={`font-medium ${isBase ? 'text-primary' : 'text-gray-700'}`}>
                                                                        {ingName}
                                                                    </span>
                                                                    {hasSubs && (
                                                                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Pré-preparo</span>
                                                                    )}
                                                                    {/* Info auxiliar: ovos */}
                                                                    {eggCount !== null && (
                                                                        <span className="ml-2 text-xs text-blue-600 font-medium">
                                                                            ≈ {eggCount} {eggCount === 1 ? 'ovo' : 'ovos'}
                                                                        </span>
                                                                    )}
                                                                    {/* Info auxiliar: massa pré-cozida */}
                                                                    {massaPreCozida !== null && (
                                                                        <span className="ml-2 text-xs text-orange-600 font-medium">
                                                                            → {massaPreCozida.toFixed(2)} kg pré-cozida
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <span className={`font-bold text-lg ${isBase ? 'text-primary' : 'text-gray-900'}`}>
                                                                    {ing.scaled_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                                                                </span>
                                                                <span className="text-gray-500 ml-1 text-sm">{ingUnit}</span>
                                                            </div>
                                                        </div>

                                                        {/* Sub-ingredientes expandidos */}
                                                        {hasSubs && isExpanded && (
                                                            <div className="bg-gray-50 border-t border-gray-100">
                                                                <ul className="divide-y divide-gray-100">
                                                                    {ing.sub_ingredients!.map((sub) => (
                                                                        <li key={sub.ingredient_id} className="px-4 pl-10 py-2 flex justify-between items-center">
                                                                            <span className="text-sm text-gray-600">
                                                                                {sub.ingredients.name}
                                                                            </span>
                                                                            <div className="text-right flex-shrink-0">
                                                                                <span className="font-medium text-sm text-gray-700">
                                                                                    {(sub.quantity * subScale).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                                                                                </span>
                                                                                <span className="text-gray-400 ml-1 text-xs">{sub.ingredients.unit}</span>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>

                                    <div className="mt-6 flex justify-end">
                                        <button className="text-sm font-medium text-gray-400 border border-gray-200 px-4 py-2 rounded-lg cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center">
                                            <Save size={16} className="mr-2" />
                                            Salvar Lote (Em Breve)
                                        </button>
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
