import { useState, useEffect } from 'react';
import { Plus, Save, AlertTriangle, Pencil, Filter, Search } from 'lucide-react';
import { CategorySelector } from './CategorySelector';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/text';

interface Ingredient {
    id: string;
    name: string;
    category: string | null;
    current_price: number;
    yield_coefficient: number;
    unit: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const UNITS = ['KG', 'G', 'L', 'ML', 'UN', 'PCT', 'CX'];

export function IngredientsTable({ onIngredientUpdate }: { onIngredientUpdate?: () => void }) {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<Ingredient>>({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [newIngredient, setNewIngredient] = useState({ name: '', category: '', current_price: 0, yield_coefficient: 1, unit: 'KG' });
    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchIngredients();
    }, []);

    const fetchIngredients = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/ingredients`);
            const data = await res.json();
            setIngredients(data);
        } catch (err) {
            toast.error('Erro ao carregar ingredientes');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (ingredient: Ingredient) => {
        setEditingId(ingredient.id);
        setEditData({ ...ingredient });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const saveEdit = async () => {
        if (!editingId) return;

        try {
            const original = ingredients.find(i => i.id === editingId);
            if (!original) return;

            const payload = {
                name: editData.name || original.name,
                category: editData.category || original.category,
                current_price: editData.current_price ?? original.current_price,
                yield_coefficient: editData.yield_coefficient ?? original.yield_coefficient ?? 1,
                unit: editData.unit || original.unit,
            };

            const res = await fetch(`${API_URL}/api/ingredients/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to update');

            toast.success('Ingrediente atualizado!');
            setEditingId(null);
            setEditData({});
            fetchIngredients();
            onIngredientUpdate?.();
        } catch (err) {
            toast.error('Erro ao atualizar ingrediente');
        }
    };

    const createIngredient = async () => {
        if (!newIngredient.name.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newIngredient),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to create');
            }

            toast.success('Ingrediente criado!');
            setShowAddForm(false);
            setNewIngredient({ name: '', category: '', current_price: 0, yield_coefficient: 1, unit: 'KG' });
            fetchIngredients();
            onIngredientUpdate?.();
        } catch (err) {
            toast.error(`Erro: ${err}`);
        }
    };

    const isPending = (ing: Ingredient) => !ing.category || !ing.unit;

    const filteredIngredients = ingredients
        .filter(ing => showPendingOnly ? isPending(ing) : true)
        .filter(ing => normalizeText(ing.name).includes(normalizeText(searchTerm)));

    if (loading) {
        return <div className="text-gray-400 text-center py-8">Carregando...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                    <h2 className="text-2xl font-semibold text-text-primary whitespace-nowrap font-serif">Ingredientes</h2>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-text-primary text-sm focus:ring-1 focus:ring-primary outline-none placeholder:text-text-tertiary transition-shadow"
                        />
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={() => setShowPendingOnly(!showPendingOnly)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${showPendingOnly
                            ? 'bg-[#ffe4e6] text-[#be123c] border-[#be123c]' /* A light red for active 'pendencies' */
                            : 'bg-background text-text-primary border-border hover:bg-surface'
                            }`}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">{showPendingOnly ? 'Apenas Pendentes' : 'Filtrar Pendências'}</span>
                        <span className="sm:hidden">{showPendingOnly ? 'Pendentes' : 'Filtrar'}</span>
                    </button>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 bg-accent text-text-primary border border-border px-4 py-2 rounded-xl hover:opacity-90 font-medium transition-opacity whitespace-nowrap"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Novo Ingrediente</span>
                        <span className="sm:hidden">Novo</span>
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-surface p-4 rounded-xl border border-border">
                    <h3 className="text-text-primary font-semibold mb-3 font-serif text-lg">Novo Ingrediente</h3>
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-1">
                            <input
                                type="text"
                                placeholder="Nome"
                                value={newIngredient.name}
                                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                                className="bg-surface border border-border-light rounded-xl px-3 py-2 text-text-primary w-full focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            />
                        </div>
                        <CategorySelector
                            value={newIngredient.category}
                            onChange={(cat) => setNewIngredient({ ...newIngredient, category: cat })}
                        />
                        <input
                            type="number"
                            placeholder="Preço"
                            value={newIngredient.current_price}
                            onChange={(e) => setNewIngredient({ ...newIngredient, current_price: parseFloat(e.target.value) })}
                            className="bg-surface border border-border-light rounded-xl px-3 py-2 text-text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            step="0.01"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Fator (ex: 0.95 ou 19.44)"
                                value={newIngredient.yield_coefficient}
                                onChange={(e) => setNewIngredient({ ...newIngredient, yield_coefficient: parseFloat(e.target.value) })}
                                className="bg-surface border border-border-light rounded-xl px-3 py-2 text-text-primary w-2/3 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                step="0.01"
                                min="0.0001"
                                title="Fator de Rendimento ou Conversão (ex: 0.95 = 95%, 19.44 = cx 360 ovos)"
                            />
                            <select
                                value={newIngredient.unit}
                                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                className="bg-surface border border-border-light rounded-xl px-3 py-2 text-text-primary w-1/3 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={createIngredient}
                            className="bg-accent text-text-primary border border-border px-4 py-2 rounded-xl hover:opacity-90 font-medium transition-opacity"
                        >
                            Salvar
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="bg-background text-text-primary border border-border px-4 py-2 rounded-xl hover:bg-surface font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-surface shadow-md border-2 border-border rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[#034F46] border-b-2 border-border">
                        <tr>
                            <th className="text-left px-4 py-3 text-white text-sm font-semibold">Nome</th>
                            <th className="text-left px-4 py-3 text-white text-sm font-semibold">Categoria</th>
                            <th className="text-left px-4 py-3 text-white text-sm font-semibold">Preço</th>
                            <th className="text-left px-4 py-3 text-white text-sm font-semibold" title="Fator de Rendimento">Rend.</th>
                            <th className="text-left px-4 py-3 text-white text-sm font-semibold">Unidade</th>
                            <th className="text-center px-4 py-3 text-white text-sm font-semibold w-24">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredIngredients.map((ing) => (
                            <tr key={ing.id} className="border-t border-border-light hover:bg-background transition-colors">
                                {editingId === ing.id ? (
                                    <>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={editData.name || ''}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                className="w-full bg-surface border border-border-light rounded-md px-2 py-1.5 text-text-primary text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <CategorySelector
                                                value={editData.category || ''}
                                                onChange={(cat) => setEditData({ ...editData, category: cat })}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                value={editData.current_price || 0}
                                                onChange={(e) => setEditData({ ...editData, current_price: parseFloat(e.target.value) })}
                                                className="w-full bg-surface border border-border-light rounded-md px-2 py-1.5 text-text-primary text-sm focus:ring-1 focus:ring-primary outline-none"
                                                step="0.01"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                value={editData.yield_coefficient ?? 1}
                                                onChange={(e) => setEditData({ ...editData, yield_coefficient: parseFloat(e.target.value) })}
                                                className="w-full bg-surface border border-border-light rounded-md px-2 py-1.5 text-text-primary text-sm focus:ring-1 focus:ring-primary outline-none"
                                                step="0.01"
                                                min="0.0001"
                                                title="Fator de Rendimento ou Conversão"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={editData.unit || ''}
                                                onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                                                className="w-full bg-surface border border-border-light rounded-md px-2 py-1.5 text-text-primary text-sm focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                <option value="">Selecione</option>
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={saveEdit}
                                                className="text-primary hover:text-opacity-80 p-1 transition-colors"
                                                title="Salvar"
                                            >
                                                <Save size={18} />
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="text-text-tertiary hover:text-text-primary p-1 ml-1 transition-colors"
                                                title="Cancelar"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3 text-text-primary font-medium">
                                            {ing.name}
                                            {isPending(ing) && (
                                                <span title="Dados incompletos">
                                                    <AlertTriangle size={14} className="inline ml-2 text-amber-500" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary">{ing.category || '-'}</td>
                                        <td className="px-4 py-3 text-text-primary">R$ {ing.current_price?.toFixed(2) || '0.00'}</td>
                                        <td className="px-4 py-3 text-text-secondary">{ing.yield_coefficient || '1.0'}</td>
                                        <td className="px-4 py-3 text-text-secondary">{ing.unit || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => startEdit(ing)}
                                                className="text-text-tertiary hover:text-primary p-1 transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {ingredients.length === 0 && (
                    <div className="text-center py-12 text-text-tertiary">
                        Nenhum ingrediente cadastrado.
                    </div>
                )}
            </div>
        </div>
    );
}
