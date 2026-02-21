import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, ArrowLeft, Search, Calculator, Package } from 'lucide-react';
import { getIngredients, createRecipe, updateRecipe, getRecipe, getProducts } from '../../services/api';
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
    const [products, setProducts] = useState<{ id: number, product: string, sku: string | null, status: string | null }[]>([]);

    // Form State
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [productId, setProductId] = useState('');
    const [yieldUnits, setYieldUnits] = useState(1);
    const [laborMinutes, setLaborMinutes] = useState(0);
    const [globalLaborRate, setGlobalLaborRate] = useState(0);
    const [items, setItems] = useState<RecipeItem[]>([]);

    // UI State
    const [search, setSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Product Search UI State
    const [productSearch, setProductSearch] = useState('');
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);

    useEffect(() => {
        const storedRate = parseFloat(localStorage.getItem('global_labor_rate') || '0');
        setGlobalLaborRate(storedRate);

        loadInitialData();
        if (recipeId) {
            loadRecipe(recipeId, storedRate);
        }
    }, [recipeId]);

    const loadInitialData = async () => {
        try {
            const [ingData, prodData] = await Promise.all([
                getIngredients(),
                getProducts()
            ]);
            setIngredients(ingData);
            setProducts(prodData);
        } catch (error) {
            toast.error('Erro ao carregar dados iniciais');
        }
    };

    const loadRecipe = async (id: string, rate: number) => {
        try {
            setLoading(true);
            const data = await getRecipe(id);
            setName(data.name);
            setSku(data.sku || '');
            setProductId(data.product_id ? String(data.product_id) : '');
            setProductSearch(data.name || '');
            setYieldUnits(data.yield_units);
            setLaborMinutes(rate > 0 ? Math.round((data.labor_cost / rate) * 60) : 0);

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

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products
            .filter(p => p.product.toLowerCase().includes(productSearch.toLowerCase()))
            .slice(0, 10);
    }, [productSearch, products]);

    const selectProduct = (p: { id: number, product: string, sku: string | null, status: string | null }) => {
        setProductId(p.id.toString());
        setName(p.product);
        setProductSearch(p.product);
        setSku(p.sku || '');
        setShowProductSuggestions(false);
    };

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

    // Helper for case-insensitive matching packaging category
    const isPackaging = (cat?: string) => {
        if (!cat) return false;
        const c = cat.toUpperCase();
        return c.includes('EMBALAGEM') || c.includes('EMBALAGENS');
    };

    const totalIngredientsCost = items.reduce((sum, item) => {
        if (isPackaging(item.category)) return sum;
        const effectivePrice = getEffectivePrice(item.current_price, item.yield_coefficient || 1);
        return sum + (effectivePrice * item.quantity);
    }, 0);

    const calculatedLaborCost = globalLaborRate > 0 ? (laborMinutes / 60) * globalLaborRate : 0;

    // totalBatchCost matches spreadsheet logic
    // We already multiplied by yieldUnits in totalPackagingUnitCost for unit pricing math on the backend, but wait:
    // If totalPackagingUnitCost is meant to be the unit cost of packaging, it shouldn't multiply by yieldUnits inside the reducer above. Let me correct the math logic here for clarity.

    // 1. Core Recipe Cost (Batch)
    const recipeFoodCost = totalIngredientsCost + calculatedLaborCost;

    // 2. Packaging Cost (Unit)
    const unitPackagingCost = items.reduce((sum, item) => {
        if (!isPackaging(item.category)) return sum;
        const effectivePrice = getEffectivePrice(item.current_price, item.yield_coefficient || 1);
        return sum + effectivePrice;
    }, 0);

    // 3. Batch Cost
    const totalBatchCost = recipeFoodCost + (unitPackagingCost * yieldUnits);

    // 4. Unit Cost Final
    const costPerUnit = yieldUnits > 0 ? totalBatchCost / yieldUnits : 0;

    const handleSave = async () => {
        if (!name) return toast.error('Nome é obrigatório');
        if (items.length === 0) return toast.error('Adicione pelo menos um ingrediente');

        const payload: RecipeInput = {
            name,
            sku: sku || undefined,
            product_id: productId ? Number(productId) : undefined,
            yield_units: Number(yieldUnits),
            labor_cost: Number(calculatedLaborCost.toFixed(2)),
            ingredients: items.map(i => ({
                ingredient_id: i.ingredient_id,
                quantity: isPackaging(i.category) ? Number(yieldUnits) : Number(i.quantity)
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
        const food = items.filter(i => !isPackaging(i.category));
        const packaging = items.filter(i => isPackaging(i.category));
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Produto (Receita)</label>
                            <div className="relative">
                                <Search className="absolute left-2 text-gray-500 top-1/2 -translate-y-1/2" size={18} />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={e => {
                                        setProductSearch(e.target.value);
                                        setShowProductSuggestions(true);
                                        if (e.target.value === '') {
                                            setProductId('');
                                            setName('');
                                            setSku('');
                                        }
                                    }}
                                    onFocus={() => setShowProductSuggestions(true)}
                                    // Delay blur to allow click on suggestion
                                    onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-8 text-white focus:border-primary focus:outline-none"
                                    placeholder="Buscar produto..."
                                />
                                {showProductSuggestions && productSearch && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg overflow-hidden z-20 max-h-48 overflow-y-auto">
                                        {filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onMouseDown={() => selectProduct(p)} // Use onMouseDown to prevent onBlur from firing first
                                                className="w-full text-left px-4 py-2 hover:bg-gray-700 flex justify-between items-center"
                                            >
                                                <span className="text-white truncate pr-2">{p.product}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'ativo' ? 'bg-emerald-900/50 text-emerald-400' : p.status === 'inativo' ? 'bg-orange-900/50 text-orange-400' : 'bg-red-900/50 text-red-400'}`}>
                                                    {p.status || 'desconhecido'}
                                                </span>
                                            </button>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <div className="px-4 py-3 text-gray-500 text-sm">Nenhum produto encontrado.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">SKU (Automático)</label>
                            <input
                                type="text"
                                value={sku}
                                disabled
                                className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-2 text-gray-500 focus:outline-none cursor-not-allowed"
                                placeholder="Vinculado ao produto"
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
                            <label className="block text-sm text-gray-400 mb-1">Tempo de Produção (Minutos)</label>
                            <input
                                type="number"
                                min="0"
                                value={laborMinutes}
                                onChange={e => setLaborMinutes(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none"
                            />
                            {globalLaborRate === 0 && (
                                <p className="text-xs text-yellow-500 mt-1">Configurações: Custo de mão de obra não definido.</p>
                            )}
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
                            <div className="mt-8 pt-6 border-t border-gray-700">
                                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Package size={18} />
                                    Embalagens (Qtd = Rendimento)
                                </h3>
                                <div className="space-y-2">
                                    {groupedItems.packaging.map((item) => (
                                        <ItemRow
                                            key={item.ingredient_id}
                                            item={{ ...item, quantity: yieldUnits }}
                                            index={items.indexOf(item)}
                                            onUpdate={updateItemQuantity}
                                            onRemove={removeItem}
                                            isPackaging={true}
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

                        <div className="text-sm">
                            {/* Lote */}
                            <div className="flex justify-between">
                                <span className="text-gray-400">Ingredientes (Lote):</span>
                                <span className="text-white">R$ {totalIngredientsCost.toFixed(2)}</span>
                            </div>

                            <div className="h-px bg-gray-700 my-3"></div>

                            {/* Unitários */}
                            <div className="flex justify-between">
                                <span className="text-gray-400">Ingredientes (Unitário):</span>
                                <span className="text-white">R$ {(yieldUnits > 0 ? totalIngredientsCost / yieldUnits : 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-gray-400">+ Mão de Obra (Unitário):</span>
                                <span className="text-white">R$ {(yieldUnits > 0 ? calculatedLaborCost / yieldUnits : 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-gray-400">+ Embalagem (Unitário):</span>
                                <span className="text-white">R$ {unitPackagingCost.toFixed(2)}</span>
                            </div>

                            <div className="h-px bg-gray-700 my-3"></div>

                            {/* Totais */}
                            <div className="flex justify-between text-lg">
                                <span className="text-gray-300 font-bold">Custo total (Lote):</span>
                                <span className="text-emerald-400 font-bold">R$ {totalBatchCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md mt-4 mb-2">
                                <span className="text-gray-300">Custo unitário final:</span>
                                <span className="text-xl font-bold text-white">R$ {costPerUnit.toFixed(2)}</span>
                            </div>

                            <div className="h-px bg-gray-700 my-3"></div>

                            {/* Info Adicional */}
                            <div className="text-gray-400 mt-2">
                                Rendimento: {yieldUnits} unidades
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ItemRow({ item, index, onUpdate, onRemove, isPackaging = false }: { item: RecipeItem, index: number, onUpdate: (i: number, q: number) => void, onRemove: (i: number) => void, isPackaging?: boolean }) {
    return (
        <div className={`flex items-center gap-4 p-3 rounded-md border transition-colors ${isPackaging ? 'bg-blue-900/10 border-blue-900/30 hover:border-blue-900/50' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}>
            <div className="flex-1">
                <div className={`font-medium ${isPackaging ? 'text-blue-200' : 'text-white'}`}>{item.name}</div>
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
                        readOnly={isPackaging}
                        className={`w-full border rounded px-2 py-1 text-right text-white focus:outline-none ${isPackaging ? 'bg-gray-800/50 border-gray-700 text-gray-400 cursor-not-allowed hidden md:block' : 'bg-gray-800 border-gray-700 focus:border-primary'}`}
                        placeholder="Qtd"
                        title={isPackaging ? "A quantidade de embalagem acompanha automaticamente o rendimento da receita." : ""}
                    />
                    {isPackaging && <div className="text-right text-sm text-gray-400 md:hidden">{item.quantity}</div>}
                </div>
                <div className="text-sm text-gray-400 w-8">{item.unit === 'UN' || item.unit === 'un' || isPackaging ? 'un' : item.unit}</div>
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
