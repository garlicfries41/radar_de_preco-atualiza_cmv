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
                    <h2 className="text-xl font-semibold text-[#111827] whitespace-nowrap">Ingredientes</h2>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[#e5e7eb] rounded-lg pl-9 pr-3 py-1.5 text-[#111827] text-sm focus:ring-1 focus:ring-[#16a34a] outline-none placeholder-[#9ca3af] transition-shadow"
                        />
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={() => setShowPendingOnly(!showPendingOnly)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${showPendingOnly
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-white text-[#6b7280] hover:text-[#111827] border border-[#e5e7eb]'
                            }`}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">{showPendingOnly ? 'Apenas Pendentes' : 'Filtrar Pendências'}</span>
                        <span className="sm:hidden">{showPendingOnly ? 'Pendentes' : 'Filtrar'}</span>
                    </button>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 bg-[#15803d] text-white px-4 py-2 rounded-lg hover:bg-[#166534] transition-colors whitespace-nowrap shadow-sm"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Novo Ingrediente</span>
                        <span className="sm:hidden">Novo</span>
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-[#f0fdf4] p-4 rounded-xl border border-[#bbf7d0]">
                    <h3 className="text-[#111827] font-semibold mb-3">Novo Ingrediente</h3>
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-1">
                            <input
                                type="text"
                                placeholder="Nome"
                                value={newIngredient.name}
                                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                                className="bg-white border border-[#d1d5db] rounded-lg px-3 py-2 text-[#111827] w-full focus:ring-2 focus:ring-[#16a34a] outline-none"
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
                            className="bg-white border border-[#d1d5db] rounded-lg px-3 py-2 text-[#111827] focus:ring-2 focus:ring-[#16a34a] outline-none"
                            step="0.01"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Fator (ex: 0.95 ou 19.44)"
                                value={newIngredient.yield_coefficient}
                                onChange={(e) => setNewIngredient({ ...newIngredient, yield_coefficient: parseFloat(e.target.value) })}
                                className="bg-white border border-[#d1d5db] rounded-lg px-3 py-2 text-[#111827] w-2/3 focus:ring-2 focus:ring-[#16a34a] outline-none"
                                step="0.01"
                                min="0.0001"
                                title="Fator de Rendimento ou Conversão (ex: 0.95 = 95%, 19.44 = cx 360 ovos)"
                            />
                            <select
                                value={newIngredient.unit}
                                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                className="bg-white border border-[#d1d5db] rounded-lg px-3 py-2 text-[#111827] w-1/3 focus:ring-2 focus:ring-[#16a34a] outline-none"
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={createIngredient}
                            className="bg-[#15803d] text-white px-4 py-2 rounded-lg hover:bg-[#166534] font-medium transition-colors"
                        >
                            Salvar
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="bg-white text-[#374151] border border-[#d1d5db] px-4 py-2 rounded-lg hover:bg-[#f9fafb] font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white shadow-sm border border-[#e5e7eb] rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                        <tr>
                            <th className="text-left px-4 py-3 text-[#6b7280] text-sm font-semibold">Nome</th>
                            <th className="text-left px-4 py-3 text-[#6b7280] text-sm font-semibold">Categoria</th>
                            <th className="text-left px-4 py-3 text-[#6b7280] text-sm font-semibold">Preço</th>
                            <th className="text-left px-4 py-3 text-[#6b7280] text-sm font-semibold" title="Fator de Rendimento">Rend.</th>
                            <th className="text-left px-4 py-3 text-[#6b7280] text-sm font-semibold">Unidade</th>
                            <th className="text-center px-4 py-3 text-[#6b7280] text-sm font-semibold w-24">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredIngredients.map((ing) => (
                            <tr key={ing.id} className="border-t border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors">
                                {editingId === ing.id ? (
                                    <>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={editData.name || ''}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                className="w-full bg-white border border-[#d1d5db] rounded px-2 py-1.5 text-[#111827] text-sm focus:ring-1 focus:ring-[#16a34a] outline-none"
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
                                                className="w-full bg-white border border-[#d1d5db] rounded px-2 py-1.5 text-[#111827] text-sm focus:ring-1 focus:ring-[#16a34a] outline-none"
                                                step="0.01"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                value={editData.yield_coefficient ?? 1}
                                                onChange={(e) => setEditData({ ...editData, yield_coefficient: parseFloat(e.target.value) })}
                                                className="w-full bg-white border border-[#d1d5db] rounded px-2 py-1.5 text-[#111827] text-sm focus:ring-1 focus:ring-[#16a34a] outline-none"
                                                step="0.01"
                                                min="0.0001"
                                                title="Fator de Rendimento ou Conversão"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={editData.unit || ''}
                                                onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                                                className="w-full bg-white border border-[#d1d5db] rounded px-2 py-1.5 text-[#111827] text-sm focus:ring-1 focus:ring-[#16a34a] outline-none"
                                            >
                                                <option value="">Selecione</option>
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={saveEdit}
                                                className="text-[#15803d] hover:text-[#166534] p-1 transition-colors"
                                                title="Salvar"
                                            >
                                                <Save size={18} />
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="text-[#9ca3af] hover:text-[#374151] p-1 ml-1 transition-colors"
                                                title="Cancelar"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3 text-[#111827] font-medium">
                                            {ing.name}
                                            {isPending(ing) && (
                                                <span title="Dados incompletos">
                                                    <AlertTriangle size={14} className="inline ml-2 text-amber-500" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[#4b5563]">{ing.category || '-'}</td>
                                        <td className="px-4 py-3 text-[#111827]">R$ {ing.current_price?.toFixed(2) || '0.00'}</td>
                                        <td className="px-4 py-3 text-[#4b5563]">{ing.yield_coefficient || '1.0'}</td>
                                        <td className="px-4 py-3 text-[#4b5563]">{ing.unit || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => startEdit(ing)}
                                                className="text-[#9ca3af] hover:text-[#15803d] p-1 transition-colors"
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
                    <div className="text-center py-12 text-[#6b7280]">
                        Nenhum ingrediente cadastrado.
                    </div>
                )}
            </div>
        </div>
    );
}
