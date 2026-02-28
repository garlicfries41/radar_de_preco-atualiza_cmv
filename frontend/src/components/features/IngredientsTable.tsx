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
                    <h2 className="text-xl font-semibold text-white whitespace-nowrap">Ingredientes</h2>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={() => setShowPendingOnly(!showPendingOnly)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${showPendingOnly
                            ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50'
                            : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">{showPendingOnly ? 'Apenas Pendentes' : 'Filtrar Pendências'}</span>
                        <span className="sm:hidden">{showPendingOnly ? 'Pendentes' : 'Filtrar'}</span>
                    </button>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 transition-colors whitespace-nowrap"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Novo Ingrediente</span>
                        <span className="sm:hidden">Novo</span>
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-gray-800 p-4 rounded-lg border border-primary">
                    <h3 className="text-white font-medium mb-3">Novo Ingrediente</h3>
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-1">
                            <input
                                type="text"
                                placeholder="Nome"
                                value={newIngredient.name}
                                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white w-full"
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
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                            step="0.01"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Fator (ex: 0.95 ou 19.44)"
                                value={newIngredient.yield_coefficient}
                                onChange={(e) => setNewIngredient({ ...newIngredient, yield_coefficient: parseFloat(e.target.value) })}
                                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white w-2/3"
                                step="0.01"
                                min="0.0001"
                                title="Fator de Rendimento ou Conversão (ex: 0.95 = 95%, 19.44 = cx 360 ovos)"
                            />
                            <select
                                value={newIngredient.unit}
                                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white w-1/3"
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={createIngredient}
                            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/80"
                        >
                            Salvar
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-900">
                        <tr>
                            <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Nome</th>
                            <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Categoria</th>
                            <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Preço</th>
                            <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium" title="Fator de Rendimento">Rend.</th>
                            <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Unidade</th>
                            <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium w-24">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredIngredients.map((ing) => (
                            <tr key={ing.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                                {editingId === ing.id ? (
                                    <>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={editData.name || ''}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
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
                                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                step="0.01"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                value={editData.yield_coefficient ?? 1}
                                                onChange={(e) => setEditData({ ...editData, yield_coefficient: parseFloat(e.target.value) })}
                                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                step="0.01"
                                                min="0.0001"
                                                title="Fator de Rendimento ou Conversão"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={editData.unit || ''}
                                                onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                            >
                                                <option value="">Selecione</option>
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={saveEdit}
                                                className="text-primary hover:text-primary/80 p-1"
                                                title="Salvar"
                                            >
                                                <Save size={18} />
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="text-gray-400 hover:text-white p-1 ml-1"
                                                title="Cancelar"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3 text-white">
                                            {ing.name}
                                            {isPending(ing) && (
                                                <span title="Dados incompletos">
                                                    <AlertTriangle size={14} className="inline ml-2 text-yellow-500" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">{ing.category || '-'}</td>
                                        <td className="px-4 py-3 text-gray-300">R$ {ing.current_price?.toFixed(2) || '0.00'}</td>
                                        <td className="px-4 py-3 text-gray-300">{ing.yield_coefficient || '1.0'}</td>
                                        <td className="px-4 py-3 text-gray-300">{ing.unit || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => startEdit(ing)}
                                                className="text-gray-400 hover:text-primary p-1"
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
                    <div className="text-center py-8 text-gray-400">
                        Nenhum ingrediente cadastrado
                    </div>
                )}
            </div>
        </div>
    );
}
