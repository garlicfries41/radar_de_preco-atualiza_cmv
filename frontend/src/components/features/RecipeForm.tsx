import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, ArrowLeft, Search, Calculator } from 'lucide-react';
import { getIngredients, createRecipe, updateRecipe, getRecipe } from '../../services/api';
import type { Ingredient, RecipeInput } from '../../types';
import toast from 'react-hot-toast';

interface RecipeFormProps {
    recipeId?: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

interface RecipeItem {
    ingredient_id: string;
    name: string;
    quantity: number;
    unit: string;
    current_price: number;
    yield_coefficient: number;
    category: string;
}

export function RecipeForm({ recipeId, onClose, onSuccess }: RecipeFormProps) {
    const [loading, setLoading] = useState(false);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    // Form State
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [yieldUnits, setYieldUnits] = useState(1);
    const [laborCost, setLaborCost] = useState(0);
    const [items, setItems] = useState<RecipeItem[]>([]);

    // UI State
    const [search, setSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        loadIngredients();
        if (recipeId) {
            loadRecipe(recipeId);
        }
    }, [recipeId]);

    const loadIngredients = async () => {
        try {
            const data = await getIngredients();
            setIngredients(data);
        } catch (error) {
            toast.error('Erro ao carregar ingredientes');
        }
    };

    const loadRecipe = async (id: string) => {
        try {
            setLoading(true);
            const data = await getRecipe(id);
            setName(data.name);
            setSku(data.sku || '');
            setYieldUnits(data.yield_units);
            setLaborCost(data.labor_cost);

            if (data.ingredients) {
                const mappedItems = data.ingredients.map(i => ({
                    ingredient_id: i.ingredient_id,
                    name: i.ingredients?.name || 'Desconhecido',
                    quantity: i.quantity,
                    unit: i.ingredients?.unit || 'UN',
                    current_price: i.ingredients?.current_price || 0,
                    yield_coefficient: i.ingredients?.yield_coefficient || 1,
                    category: i.ingredients?.category || 'OUTROS'
                }));
                setItems(mappedItems);
            }
        } catch (error) {
            toast.error('Erro ao carregar receita');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const filteredIngredients = useMemo(() => {
        if (!search) return [];
        return ingredients
            .filter(i =>
                i.name.toLowerCase().includes(search.toLowerCase()) &&
                !items.some(item => item.ingredient_id === i.id)
            )
            .slice(0, 5);
    }, [search, ingredients, items]);

    const addItem = (ingredient: Ingredient) => {
        setItems([...items, {
            ingredient_id: ingredient.id,
            name: ingredient.name,
            quantity: 0,
            unit: ingredient.unit,
            current_price: ingredient.current_price,
            yield_coefficient: ingredient.yield_coefficient || 1,
            category: ingredient.category
        }]);
        setSearch('');
        setShowSuggestions(false);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItemQuantity = (index: number, qty: number) => {
        const newItems = [...items];
        newItems[index].quantity = qty;
        setItems(newItems);
    };

    // Calculations
    const getEffectivePrice = (price: number, yieldCoeff: number) => {
        return yieldCoeff > 0 ? price / yieldCoeff : price;
    };

    const totalIngredientsCost = items.reduce((sum, item) => {
        const effectivePrice = getEffectivePrice(item.current_price, item.yield_coefficient || 1);
        return sum + (effectivePrice * item.quantity);
    }, 0);
    const totalCost = totalIngredientsCost + laborCost;
    const costPerUnit = yieldUnits > 0 ? totalCost / yieldUnits : 0;
    const totalWeight = items.reduce((sum, item) => sum + item.quantity, 0); // Approx sum of quantities (kg/l)

    const handleSave = async () => {
        if (!name) return toast.error('Nome é obrigatório');
        if (items.length === 0) return toast.error('Adicione pelo menos um ingrediente');

        const payload: RecipeInput = {
            name,
            sku: sku || undefined,
            yield_units: Number(yieldUnits),
            labor_cost: Number(laborCost),
            ingredients: items.map(i => ({
                ingredient_id: i.ingredient_id,
                quantity: Number(i.quantity)
            }))
        };

        try {
            setLoading(true);
            if (recipeId) {
                await updateRecipe(recipeId, payload);
                toast.success('Receita atualizada!');
            } else {
                await createRecipe(payload);
                toast.success('Receita criada!');
            }
            onSuccess();
        } catch (error) {
            toast.error('Erro ao salvar receita');
        } finally {
            setLoading(false);
        }
    };

    const groupedItems = useMemo(() => {
        const food = items.filter(i => i.category !== 'EMBALAGEM');
        const packaging = items.filter(i => i.category === 'EMBALAGEM');
        return { food, packaging };
    }, [items]);

    if (loading && recipeId && !name) { // Only show full loader on initial fetch
        return <div className="p-8 text-center text-gray-400">Carregando...</div>;
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-gray-700 pb-4">
                <button onClick={onClose} className="text-gray-400 hover:text-white flex items-center gap-2">
                    <ArrowLeft size={20} />
                    Voltar
                </button>
                <h2 className="text-xl font-bold text-white">
                    {recipeId ? 'Editar Receita' : 'Nova Receita'}
                </h2>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-primary hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={20} />
                    Salvar
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Nome da Receita</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none"
                                placeholder="Ex: Lasanha Bolonhesa"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">SKU (Opcional)</label>
                            <input
                                type="text"
                                value={sku}
                                onChange={e => setSku(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none"
                                placeholder="Ex: LAS-001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Rendimento (Unidades)</label>
                            <input
                                type="number"
                                min="1"
                                value={yieldUnits}
                                onChange={e => setYieldUnits(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Custo Mão de Obra (R$)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={laborCost}
                                onChange={e => setLaborCost(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Ingredient Search */}
                    <div className="relative z-10">
                        <label className="block text-sm text-gray-400 mb-1">Adicionar Ingrediente / Embalagem</label>
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded-md px-3">
                            <Search className="text-gray-500" size={18} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                className="w-full bg-transparent border-none p-2 text-white focus:outline-none"
                                placeholder="Busque por nome..."
                            />
                        </div>

                        {showSuggestions && search && filteredIngredients.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg overflow-hidden">
                                {filteredIngredients.map(ing => (
                                    <button
                                        key={ing.id}
                                        onClick={() => addItem(ing)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-700 flex justify-between items-center group"
                                    >
                                        <div>
                                            <span className="text-white block">{ing.name}</span>
                                            <span className="text-xs text-gray-500">
                                                {ing.category} • R$ {ing.current_price.toFixed(2)}/{ing.unit}
                                                {ing.yield_coefficient && ing.yield_coefficient !== 1 && ` • Fator: ${ing.yield_coefficient}`}
                                            </span>
                                        </div>
                                        <Plus size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Ingredients List */}
                    <div className="space-y-6">
                        {/* Food Ingredients */}
                        {groupedItems.food.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Ingredientes</h3>
                                <div className="space-y-2">
                                    {groupedItems.food.map((item) => (
                                        <ItemRow
                                            key={item.ingredient_id}
                                            item={item}
                                            index={items.indexOf(item)}
                                            onUpdate={updateItemQuantity}
                                            onRemove={removeItem}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Packaging */}
                        {groupedItems.packaging.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Embalagens</h3>
                                <div className="space-y-2">
                                    {groupedItems.packaging.map((item) => (
                                        <ItemRow
                                            key={item.ingredient_id}
                                            item={item}
                                            index={items.indexOf(item)}
                                            onUpdate={updateItemQuantity}
                                            onRemove={removeItem}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {items.length === 0 && (
                            <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg text-gray-500">
                                Nenhum ingrediente adicionado
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-gray-900 rounded-lg p-6 sticky top-6 border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calculator size={20} className="text-primary" />
                            Resumo de Custos
                        </h3>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Ingredientes:</span>
                                <span className="text-white">R$ {totalIngredientsCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Mão de Obra:</span>
                                <span className="text-white">R$ {laborCost.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-gray-700 my-2"></div>
                            <div className="flex justify-between text-lg font-bold">
                                <span className="text-gray-300">Custo Total:</span>
                                <span className="text-emerald-400">R$ {totalCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md mt-4">
                                <span className="text-gray-300">Custo Unitário:</span>
                                <span className="text-xl font-bold text-white">R$ {costPerUnit.toFixed(2)}</span>
                            </div>

                            <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-700">
                                <p>Peso Total Aprox.: {totalWeight.toFixed(3)} kg/unid</p>
                                <p>Rendimento: {yieldUnits} unidades</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ItemRow({ item, index, onUpdate, onRemove }: { item: RecipeItem, index: number, onUpdate: (i: number, q: number) => void, onRemove: (i: number) => void }) {
    return (
        <div className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-md border border-gray-800 hover:border-gray-700 transition-colors">
            <div className="flex-1">
                <div className="font-medium text-white">{item.name}</div>
                <div className="text-xs text-gray-500">
                    R$ {item.current_price.toFixed(2)} / {item.unit}
                    {item.yield_coefficient !== 1 && (
                        <span className="text-yellow-500 ml-2" title={`Preço Efetivo: R$ ${(item.current_price / item.yield_coefficient).toFixed(2)} (${item.yield_coefficient < 1 ? 'Perda/Rendimento' : 'Conversão'}: ${item.yield_coefficient})`}>
                            {item.yield_coefficient < 1 ? '⚠' : '🔄'} Fator: {item.yield_coefficient}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="w-24">
                    <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={e => onUpdate(index, Number(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-right text-white focus:border-primary focus:outline-none"
                        placeholder="Qtd"
                    />
                </div>
                <div className="text-sm text-gray-400 w-8">{item.unit}</div>
                <div className="w-24 text-right font-mono text-emerald-400">
                    R$ {(item.quantity * (item.yield_coefficient > 0 ? item.current_price / item.yield_coefficient : item.current_price)).toFixed(2)}
                </div>
                <button
                    onClick={() => onRemove(index)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
