import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Save, ArrowLeft, Search, Calculator, Package, AlertTriangle } from 'lucide-react';
import { getIngredients, createRecipe, updateRecipe, getRecipe, getProducts, getRecipeCategories, getAnvisaLabel, getSettings } from '../../services/api';
import { AnvisaLabel } from './AnvisaLabel';
import { normalizeText } from '../../utils/text';
import type { Ingredient, RecipeInput, RecipeCategory } from '../../types';
import toast from 'react-hot-toast';

interface RecipeFormProps {
    recipeId?: string | null;
    onClose: () => void;
    onSuccess: () => void;
    isPrePreparo?: boolean;
    defaultStatus?: string;
    highlightProduct?: boolean;
}

interface RecipeItem {
    ingredient_id: string;
    name: string;
    quantity: number;
    unit: string;
    current_price: number;
    yield_coefficient: number;
    category: string;
    nutritional_ref_id?: string | null;
}

export function RecipeForm({ recipeId, onClose, onSuccess, isPrePreparo = false, defaultStatus = 'ativo', highlightProduct = false }: RecipeFormProps) {
    const [loading, setLoading] = useState(false);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [products, setProducts] = useState<{ id: number, product: string, sku: string | null, status: string | null }[]>([]);
    const [categories, setCategories] = useState<RecipeCategory[]>([]);
    const [showAnvisa, setShowAnvisa] = useState(false);
    const [anvisaData, setAnvisaData] = useState<any>(null);

    // Form State
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [productId, setProductId] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [yieldUnits, setYieldUnits] = useState(1);
    const [productionUnit, setProductionUnit] = useState('KG');
    const [laborMinutes, setLaborMinutes] = useState(0);
    const [globalLaborRate, setGlobalLaborRate] = useState(0);
    const [loadedLaborCost, setLoadedLaborCost] = useState(0);
    const [netWeight, setNetWeight] = useState<number | ''>('');
    const [items, setItems] = useState<RecipeItem[]>([]);
    const [recipeStatus, setRecipeStatus] = useState<string>(defaultStatus);
    const productInputRef = useRef<HTMLInputElement>(null);

    // UI State
    const [search, setSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Product Search UI State
    const [productSearch, setProductSearch] = useState('');
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const foodQtyRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusedSuggestIndex, setFocusedSuggestIndex] = useState(-1);

    useEffect(() => {
        const init = async () => {
            let rate = 0;
            try {
                const settings = await getSettings();
                // Use API value only if it's > 0, otherwise stick to localStorage or default
                if (settings && settings.global_labor_rate > 0) {
                    rate = settings.global_labor_rate;
                    localStorage.setItem('global_labor_rate', rate.toString());
                } else {
                    const stored = localStorage.getItem('global_labor_rate');
                    rate = stored ? parseFloat(stored) : 0;
                }
            } catch (error) {
                const stored = localStorage.getItem('global_labor_rate');
                rate = stored ? parseFloat(stored) : 0;
            }
            setGlobalLaborRate(rate);

            loadInitialData();
            if (recipeId) {
                loadRecipe(recipeId, rate);
            }
        };
        init();
    }, [recipeId]);

    const loadInitialData = async () => {
        try {
            const [ingData, prodData, catData] = await Promise.all([
                getIngredients(),
                getProducts(),
                getRecipeCategories()
            ]);
            setIngredients(ingData);
            setProducts(prodData);
            setCategories(catData);
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
            setCategoryId(data.category_id ? String(data.category_id) : '');
            setProductSearch(data.name || '');
            setYieldUnits(data.yield_units);
            if (data.production_unit) setProductionUnit(data.production_unit);
            setLoadedLaborCost(data.labor_cost || 0);
            setLaborMinutes(rate > 0 ? Math.round((data.labor_cost / rate) * 60) : 0);
            setNetWeight(data.net_weight !== undefined && data.net_weight !== null ? data.net_weight : '');

            if (data.ingredients) {
                const mappedItems = data.ingredients.map(i => ({
                    ingredient_id: i.ingredient_id,
                    name: i.ingredients?.name || 'Desconhecido',
                    quantity: i.quantity,
                    unit: i.ingredients?.unit || 'UN',
                    current_price: i.ingredients?.current_price || 0,
                    yield_coefficient: i.ingredients?.yield_coefficient || 1,
                    category: i.ingredients?.category || 'OUTROS',
                    nutritional_ref_id: i.ingredients?.nutritional_ref_id || null
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
        const normalizedSearch = normalizeText(search);
        return ingredients
            .filter(i =>
                normalizeText(i.name).includes(normalizedSearch) &&
                !items.some(item => item.ingredient_id === i.id)
            )
            .slice(0, 5);
    }, [search, ingredients, items]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        const normalizedSearch = normalizeText(productSearch);
        return products
            .filter(p => normalizeText(p.product).includes(normalizedSearch))
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
            category: ingredient.category,
            nutritional_ref_id: ingredient.nutritional_ref_id
        }]);
        setSearch('');
        setShowSuggestions(false);
        setFocusedSuggestIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 10);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || filteredIngredients.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedSuggestIndex(i => Math.min(i + 1, filteredIngredients.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedSuggestIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedSuggestIndex >= 0 && focusedSuggestIndex < filteredIngredients.length) {
                addItem(filteredIngredients[focusedSuggestIndex]);
            } else {
                addItem(filteredIngredients[0]);
            }
        }
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
        const c = cat.trim().toUpperCase();
        return c.includes('EMBALAGEM') || c.includes('EMBALAGENS') || c === 'PACKAGING';
    };

    const isB2B = name.toUpperCase().includes('B2B') || name.toUpperCase().includes('[B2B]');

    const totalIngredientsCost = items.reduce((sum, item) => {
        if (isPackaging(item.category)) return sum;
        const effectivePrice = getEffectivePrice(item.current_price, item.yield_coefficient || 1);
        return sum + (effectivePrice * item.quantity);
    }, 0);

    const calculatedLaborCost = globalLaborRate > 0 ? (laborMinutes / 60) * globalLaborRate : loadedLaborCost;

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
    const packagingMultiplier = isB2B ? (yieldUnits / 2.5) : yieldUnits;
    const totalBatchCost = recipeFoodCost + (unitPackagingCost * packagingMultiplier);

    // 4. Unit Cost Final
    const costPerUnit = yieldUnits > 0 ? totalBatchCost / yieldUnits : 0;

    const handleSave = async () => {
        if (!name) return toast.error('Nome é obrigatório');
        if (items.length === 0) return toast.error('Adicione pelo menos um ingrediente');

        const payload: RecipeInput = {
            name: isPrePreparo ? name : (productId ? name : name), // Product name or typed
            sku: isPrePreparo ? undefined : (sku || undefined),
            product_id: isPrePreparo ? undefined : (productId ? productId : undefined),
            category_id: categoryId ? categoryId : undefined,
            yield_units: Number(yieldUnits),
            labor_minutes: Number(laborMinutes),
            labor_cost: Number(calculatedLaborCost.toFixed(2)),
            is_pre_preparo: isPrePreparo,
            production_unit: productionUnit,
            net_weight: netWeight === '' ? undefined : Number(netWeight),
            status: recipeStatus,
            ingredients: items.map(i => ({
                ingredient_id: i.ingredient_id,
                quantity: isPackaging(i.category) ? (isB2B ? Number((yieldUnits / 2.5).toFixed(3)) : Number(yieldUnits)) : Number(i.quantity)
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

    const handleGenerateAnvisa = async () => {
        if (!recipeId) return;
        try {
            setLoading(true);
            const data = await getAnvisaLabel(recipeId);
            setAnvisaData(data);
            setShowAnvisa(true);
        } catch (error) {
            toast.error('Erro ao gerar rótulo ANVISA');
        } finally {
            setLoading(false);
        }
    };

    const groupedItems = useMemo(() => {
        const food = items.filter(i => !isPackaging(i.category));
        const packaging = items.filter(i => isPackaging(i.category));
        return { food, packaging };
    }, [items]);

    const missingNutritionIngredients = useMemo(() => {
        return items.filter(i => {
            if (isPackaging(i.category)) return false;
            const cat = i.category?.trim().toUpperCase() || '';
            // Skip checks for pre-preparo items as they usually have nutrition materialized elsewhere or calculated on the fly
            if (cat.includes('PRÉ-PREPARO') || cat.includes('PRE-PREPARO')) return false;

            // If the item has a nutritional_ref_id, it is NOT missing
            if (i.nutritional_ref_id) return false;

            return true;
        });
    }, [items]);

    useEffect(() => {
        if (highlightProduct && productInputRef.current) {
            setTimeout(() => {
                productInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                productInputRef.current?.focus();
            }, 300);
        }
    }, [highlightProduct]);

    if (loading && recipeId && !name) { // Only show full loader on initial fetch
        return <div className="p-8 text-center text-text-secondary">Carregando...</div>;
    }

    return (
        <div className="bg-surface rounded-lg border border-border p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                <button onClick={onClose} className="text-text-secondary hover:text-text-primary flex items-center gap-2">
                    <ArrowLeft size={20} />
                    Voltar
                </button>
                <h2 className="text-xl font-bold text-text-primary font-serif">
                    {recipeId ? (isPrePreparo ? 'Editar Pré-preparo' : 'Editar Receita') : (isPrePreparo ? 'Novo Pré-preparo' : 'Nova Receita')}
                </h2>
                <button
                    data-save-btn
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-accent hover:opacity-90 text-text-primary font-medium border border-border px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={20} />
                    Salvar
                </button>
            </div>

            {showAnvisa && anvisaData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-surface z-10">
                            <h3 className="text-lg font-bold text-text-primary">Rótulo Nutricional ANVISA</h3>
                            <button onClick={() => setShowAnvisa(false)} className="text-text-secondary hover:text-text-primary">
                                <ArrowLeft size={20} className="rotate-90 md:rotate-0" />
                            </button>
                        </div>
                        <div className="p-6">
                            <AnvisaLabel data={anvisaData} />
                        </div>
                    </div>
                </div>
            )}

            {highlightProduct && (
                <div className="mb-4 p-4 rounded-lg bg-amber-900/40 border border-amber-600/50 flex items-start gap-3 animate-pulse">
                    <span className="text-amber-600 text-xl">⚗️</span>
                    <div>
                        <p className="text-amber-800 font-bold text-sm">Receita promovida!</p>
                        <p className="text-amber-700 text-sm">Selecione o <strong>Produto</strong> que esta receita representa para completar o vínculo com o sistema.</p>
                    </div>
                </div>
            )}

            {missingNutritionIngredients.length > 0 && (
                <div className="mb-6 p-4 rounded-lg bg-orange-900/40 border border-orange-700/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-orange-600 font-bold">
                        <AlertTriangle size={20} />
                        Atenção: Impacto na Tabela Nutricional
                    </div>
                    <p className="text-orange-700 text-sm">
                        Esta receita contém <strong>{missingNutritionIngredients.map(i => i.name).join(', ')}</strong>, que ainda {missingNutritionIngredients.length > 1 ? 'não possuem' : 'não possui'} dados nutricionais vinculados.
                        A porcentagem final e o valor energético do seu rótulo poderão ficar incorretos até que você vincule {missingNutritionIngredients.length > 1 ? 'os ingredientes-base' : 'o ingrediente-base'}.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                        {isPrePreparo ? (
                            <div className="md:col-span-2">
                                <label className="block text-sm text-text-secondary mb-1">Nome do Pré-preparo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                                    placeholder="Ex: Molho Bechamel"
                                />
                            </div>
                        ) : (
                            <>
                                {/* Campo de nome manual: aparece quando não há produto vinculado */}
                                {!productId && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm text-text-secondary mb-1">Nome da Receita</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                                            placeholder="Digite o nome da receita..."
                                        />
                                        <p className="text-xs text-text-tertiary mt-1">Vincule um produto abaixo para promover esta receita.</p>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm mb-1 font-medium transition-colors" style={{ color: highlightProduct ? '#f59e0b' : '#9ca3af' }}>Produto (Receita){highlightProduct && ' ← Vincule aqui'}</label>
                                    <div className={`relative rounded-md transition-all ${highlightProduct ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-surface' : ''}`}>
                                        <Search className="absolute left-2 text-text-tertiary top-1/2 -translate-y-1/2" size={18} />
                                        <input
                                            ref={productInputRef}
                                            type="text"
                                            value={productSearch}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setProductSearch(val);
                                                setShowProductSuggestions(true);
                                                if (val === '') {
                                                    setProductId('');
                                                    setSku('');
                                                }
                                            }}
                                            onFocus={() => setShowProductSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                                            className="w-full bg-background border border-border rounded-md py-2 px-8 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                                            placeholder="Buscar produto..."
                                        />
                                        {showProductSuggestions && productSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-20 max-h-48 overflow-y-auto">
                                                {filteredProducts.map(p => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onMouseDown={() => selectProduct(p)}
                                                        className="w-full text-left px-4 py-2 hover:bg-surface-alt flex justify-between items-start gap-4"
                                                    >
                                                        <span className="text-text-primary whitespace-normal break-words text-sm leading-tight">{p.product}</span>
                                                        <span className={`text-xs px-2 py-0.5 whitespace-nowrap rounded-full shrink-0 ${p.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : p.status === 'inativo' ? 'bg-orange-900/50 text-orange-600' : 'bg-red-100 text-red-800'}`}>
                                                            {p.status || 'desconhecido'}
                                                        </span>
                                                    </button>
                                                ))}
                                                {filteredProducts.length === 0 && (
                                                    <div className="px-4 py-3 text-text-tertiary text-sm">Nenhum produto encontrado.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-1">SKU (Automático)</label>
                                    <input
                                        type="text"
                                        value={sku}
                                        disabled
                                        className="w-full bg-surface border border-border rounded-md p-2 text-text-tertiary focus:outline-none cursor-not-allowed"
                                        placeholder="Vinculado ao produto"
                                    />
                                </div>
                            </>
                        )}
                        {!isPrePreparo && (
                            <div className="md:col-span-2">
                                <label className="block text-sm text-text-secondary mb-1">Categoria de Produto (ANVISA)</label>
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                                >
                                    <option value="">Selecione uma categoria...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.anvisa_portion_g}g)</option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-tertiary mt-1">A categoria define a porção padrão para o rótulo nutricional.</p>
                            </div>
                        )}
                    </div>

                    {/* Portion, Weight and Production Unit */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">
                                Rendimento ({isPrePreparo ? 'Qtd.' : 'Unidades'})
                            </label>
                            <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={yieldUnits}
                                onChange={(e) => setYieldUnits(Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1">
                                Peso Líquido (kg)
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                value={netWeight}
                                onChange={(e) => setNetWeight(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="Ex: 0.500"
                                className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                            />
                            <p className="text-xs text-text-tertiary mt-1 italic">
                                O CMV continuará usando o peso bruto.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1">
                                Unidade de Produção
                            </label>
                            <select
                                value={productionUnit}
                                onChange={(e) => setProductionUnit(e.target.value)}
                                className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none"
                            >
                                <option value="KG">Kilograma (kg)</option>
                                <option value="UN">Unidade (un)</option>
                                <option value="L">Litro (L)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1">
                                Tempo de Produção (min)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={laborMinutes}
                                onChange={(e) => setLaborMinutes(Number(e.target.value))}
                                disabled={globalLaborRate === 0}
                                className="w-full bg-background border border-border rounded-md p-2 text-text-primary focus:border-border focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {globalLaborRate === 0 && (
                                <p className="text-xs text-yellow-500 mt-1">Configure o valor da mão de obra nas configurações primeiro.</p>
                            )}
                        </div>
                    </div>



                    {/* Ingredient Search */}
                    <div className="relative z-10">
                        <label className="block text-sm text-text-secondary mb-1">Adicionar Ingrediente / Embalagem</label>
                        <div className="flex items-center bg-background border border-border rounded-md px-3">
                            <Search className="text-text-tertiary" size={18} />
                            <input
                                type="text"
                                ref={searchInputRef}
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setShowSuggestions(true);
                                    setFocusedSuggestIndex(-1);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onKeyDown={handleSearchKeyDown}
                                className="w-full bg-transparent border-none p-2 text-text-primary focus:outline-none"
                                placeholder="Busque por nome..."
                            />
                        </div>

                        {showSuggestions && search && filteredIngredients.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-lg overflow-hidden">
                                {filteredIngredients.map((ing, index) => (
                                    <button
                                        key={ing.id}
                                        onClick={() => addItem(ing)}
                                        className={`w-full text-left px-4 py-3 hover:bg-surface-alt flex justify-between items-center group ${focusedSuggestIndex === index ? 'bg-gray-700' : ''}`}
                                    >
                                        <div>
                                            <span className="text-text-primary block">{ing.name || 'Desconhecido'}</span>
                                            <span className="text-xs text-text-tertiary">
                                                {ing.category || 'OUTROS'} • R$ {(ing.current_price || 0).toFixed(2)}/{ing.unit || 'UN'}
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
                                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Ingredientes</h3>
                                <div className="space-y-2">
                                    {groupedItems.food.map((item, localIndex) => (
                                        <ItemRow
                                            key={item.ingredient_id}
                                            item={item}
                                            index={items.indexOf(item)}
                                            onUpdate={updateItemQuantity}
                                            onRemove={removeItem}
                                            inputRef={el => { foodQtyRefs.current[localIndex] = el; }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const next = foodQtyRefs.current[localIndex + 1];
                                                    if (next) {
                                                        next.focus();
                                                        next.select();
                                                    }
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Packaging */}
                        {groupedItems.packaging.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-border">
                                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Package size={18} />
                                    Embalagens {isB2B ? '(Qtd = Rend / 2.5)' : '(Qtd = Rendimento)'}
                                </h3>
                                <div className="space-y-2">
                                    {groupedItems.packaging.map((item) => (
                                        <ItemRow
                                            key={item.ingredient_id}
                                            item={{ ...item, quantity: isB2B ? Number((yieldUnits / 2.5).toFixed(3)) : yieldUnits }}
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
                            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg text-text-tertiary">
                                Nenhum ingrediente adicionado
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-background rounded-lg p-6 sticky top-6 border border-border">
                        <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                            <Calculator size={20} className="text-primary" />
                            Resumo de Custos
                        </h3>

                        <div className="text-sm">
                            {/* Lote */}
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Ingredientes (Lote):</span>
                                <span className="text-text-primary">R$ {totalIngredientsCost.toFixed(2)}</span>
                            </div>

                            <div className="h-px bg-gray-700 my-3"></div>

                            {/* Unitários */}
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Ingredientes (Unitário):</span>
                                <span className="text-text-primary">R$ {(yieldUnits > 0 ? totalIngredientsCost / yieldUnits : 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-text-secondary">+ Mão de Obra (Unitário):</span>
                                <span className="text-text-primary">R$ {(yieldUnits > 0 ? calculatedLaborCost / yieldUnits : 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <div className="flex flex-col">
                                    <span className="text-text-secondary">+ Embalagem (Unitário):</span>
                                    {isB2B && (
                                        <span className="text-[10px] text-emerald-500 font-medium">B2B: 1 un / 2.5 rend.</span>
                                    )}
                                </div>
                                <span className="text-text-primary">R$ {(isB2B ? unitPackagingCost / 2.5 : unitPackagingCost).toFixed(2)}</span>
                            </div>

                            <div className="h-px bg-gray-700 my-3"></div>

                            {/* Totais */}
                            <div className="flex justify-between text-lg">
                                <span className="text-text-secondary font-bold">Custo total (Lote):</span>
                                <span className="text-emerald-400 font-bold">R$ {totalBatchCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-surface p-3 rounded-md mt-4 mb-2">
                                <span className="text-text-secondary">Custo final ({isPrePreparo ? productionUnit : 'UN'}):</span>
                                <span className="text-xl font-bold text-text-primary font-serif">R$ {costPerUnit.toFixed(2)}</span>
                            </div>

                            <div className="h-px bg-gray-700 my-3"></div>

                            {/* Info Adicional */}
                            <div className="text-text-secondary mt-2">
                                Rendimento: {yieldUnits} unidades
                            </div>
                        </div>

                        {recipeId && !isPrePreparo && (
                            <div className="mt-6 space-y-2">
                                <button
                                    onClick={handleGenerateAnvisa}
                                    disabled={!categoryId}
                                    className={`w-full text-text-primary px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold ${categoryId
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-gray-700 cursor-not-allowed opacity-50'
                                        }`}
                                >
                                    <Calculator size={20} />
                                    Gerar Rótulo ANVISA
                                </button>
                                {!categoryId && (
                                    <p className="text-xs text-orange-600 text-center">
                                        Selecione uma categoria acima para habilitar o rótulo.
                                    </p>
                                )}

                                {/* Inativar – botão discreto, apenas em edição */}
                                <button
                                    onClick={() => {
                                        if (confirm('Inativar esta receita? Ela deixará de aparecer no painel principal.')) {
                                            setRecipeStatus('inativo');
                                            // trigger save with inativo status
                                            setTimeout(() => {
                                                (document.querySelector('[data-save-btn]') as HTMLButtonElement)?.click();
                                            }, 50);
                                        }
                                    }}
                                    type="button"
                                    className="w-full mt-2 text-text-tertiary hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-800 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                                >
                                    Inativar receita
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ItemRow({ item, index, onUpdate, onRemove, isPackaging = false, inputRef, onKeyDown }: { item: RecipeItem, index: number, onUpdate: (i: number, q: number) => void, onRemove: (i: number) => void, isPackaging?: boolean, inputRef?: React.Ref<HTMLInputElement>, onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
    return (
        <div className={`flex items-center gap-4 p-3 rounded-md border transition-colors ${isPackaging ? 'bg-blue-900/10 border-blue-900/30 hover:border-blue-900/50' : 'bg-surface border border-border-light hover:border-border'}`}>
            <div className="flex-1">
                <div className={`font-medium ${isPackaging ? 'text-blue-200' : 'text-text-primary'}`}>{item.name || 'Desconhecido'}</div>
                <div className="text-xs text-text-tertiary">
                    R$ {(item.current_price || 0).toFixed(2)} / {item.unit || 'UN'}
                    {item.yield_coefficient !== 1 && (
                        <span className="text-yellow-500 ml-2" title={`Preço Efetivo: R$ ${((item.current_price || 0) / (item.yield_coefficient || 1)).toFixed(2)} (${item.yield_coefficient < 1 ? 'Perda/Rendimento' : 'Conversão'}: ${item.yield_coefficient})`}>
                            {item.yield_coefficient < 1 ? '⚠' : '🔄'} Fator: {item.yield_coefficient}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="w-24">
                    <input
                        ref={inputRef}
                        onKeyDown={onKeyDown}
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={e => onUpdate(index, Number(e.target.value))}
                        readOnly={isPackaging}
                        className={`w-full border rounded px-2 py-1 text-right text-text-primary focus:outline-none ${isPackaging ? 'bg-surface/50 border-border text-text-secondary cursor-not-allowed hidden md:block' : 'bg-surface border-border focus:border-border focus:ring-1 focus:ring-primary'}`}
                        placeholder="Qtd"
                        title={isPackaging ? "A quantidade de embalagem acompanha automaticamente o rendimento da receita." : ""}
                    />
                    {isPackaging && <div className="text-right text-sm text-text-secondary md:hidden">{item.quantity}</div>}
                </div>
                <div className="text-sm text-text-secondary w-8">{item.unit === 'UN' || item.unit === 'un' || isPackaging ? 'un' : item.unit}</div>
                <div className="w-24 text-right font-mono text-emerald-400">
                    R$ {(Number(item.quantity || 0) * (item.yield_coefficient > 0 ? (item.current_price || 0) / item.yield_coefficient : (item.current_price || 0))).toFixed(2)}
                </div>
                <button
                    onClick={() => onRemove(index)}
                    className="p-1.5 text-text-tertiary hover:text-red-400 hover:bg-surface rounded transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
