import { useState, useEffect } from 'react';
import { AlertTriangle, Pencil, Save } from 'lucide-react';
import { CategorySelector } from './CategorySelector';
import toast from 'react-hot-toast';

interface PendingIngredient {
    id: string;
    name: string;
    category: string | null;
    current_price: number;
    unit: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || '';
const UNITS = ['KG', 'G', 'L', 'ML', 'UN', 'PCT', 'CX'];

export function PendingTab({ onIngredientUpdate }: { onIngredientUpdate?: () => void }) {
    const [pending, setPending] = useState<PendingIngredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<PendingIngredient>>({});

    useEffect(() => {
        fetchPending();

        // Auto-refresh every 5 seconds to catch resolved pending items
        const interval = setInterval(fetchPending, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/ingredients/pending`);
            const data = await res.json();
            setPending(data);
        } catch (err) {
            toast.error('Erro ao carregar pendências');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (ing: PendingIngredient) => {
        setEditingId(ing.id);
        setEditData({ ...ing });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const saveEdit = async () => {
        if (!editingId) return;

        try {
            // Find the original ingredient to merge with editData
            const original = pending.find(i => i.id === editingId);
            if (!original) return;

            // Merge editData with original to preserve untouched fields
            // Use || instead of ?? to treat empty strings as falsy
            const payload = {
                name: editData.name || original.name,
                category: editData.category || original.category,
                current_price: editData.current_price ?? original.current_price,
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
            fetchPending();
            onIngredientUpdate?.(); // Notify parent to refresh pending count
        } catch (err) {
            toast.error('Erro ao atualizar');
        }
    };

    if (loading) {
        return <div className="text-gray-400 text-center py-8">Carregando...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <AlertTriangle className="text-yellow-500" size={24} />
                <h2 className="text-xl font-semibold text-white">
                    Pendências ({pending.length})
                </h2>
            </div>

            {pending.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                    <div className="text-green-500 text-lg mb-2">✓ Tudo em dia!</div>
                    <p className="text-gray-400">Nenhum ingrediente com dados incompletos.</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <div className="bg-yellow-900/30 border-b border-yellow-600/50 px-4 py-2">
                        <p className="text-yellow-400 text-sm">
                            Estes ingredientes precisam de categoria ou unidade para funcionarem corretamente.
                        </p>
                    </div>
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Nome</th>
                                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Categoria</th>
                                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Preço</th>
                                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Unidade</th>
                                <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pending.map((ing) => (
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
                                                <button onClick={saveEdit} className="text-primary hover:text-primary/80 p-1">
                                                    <Save size={18} />
                                                </button>
                                                <button onClick={cancelEdit} className="text-gray-400 hover:text-white p-1 ml-1">
                                                    ✕
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-3 text-white">{ing.name}</td>
                                            <td className="px-4 py-3">
                                                {ing.category ? (
                                                    <span className="text-gray-300">{ing.category}</span>
                                                ) : (
                                                    <span className="text-yellow-500">⚠ Faltando</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">R$ {ing.current_price?.toFixed(2) || '0.00'}</td>
                                            <td className="px-4 py-3">
                                                {ing.unit ? (
                                                    <span className="text-gray-300">{ing.unit}</span>
                                                ) : (
                                                    <span className="text-yellow-500">⚠ Faltando</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => startEdit(ing)} className="text-gray-400 hover:text-primary p-1">
                                                    <Pencil size={16} />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
