import { useState, useEffect } from 'react';
import { getIngredients } from '../../services/api';
import type { Ingredient } from '../../types';
import { Search, Loader2 } from 'lucide-react';

export function IngredientsList() {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const data = await getIngredients(query);
                setIngredients(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(fetch, 500);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Pesquisar ingredientes..."
                        className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Search className="absolute left-3 top-2.5 text-text-secondary" size={18} />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : (
                <div className="bg-surface rounded-xl overflow-hidden border border-border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-alt/50 text-text-secondary">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nome</th>
                                <th className="px-4 py-3 font-medium">Categoria</th>
                                <th className="px-4 py-3 font-medium text-right">Preço Atual</th>
                                <th className="px-4 py-3 font-medium text-center">Unidade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {ingredients.map((item) => (
                                <tr key={item.id} className="hover:bg-surface-alt/30">
                                    <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                                    <td className="px-4 py-3 text-text-secondary">{item.category}</td>
                                    <td className="px-4 py-3 text-right text-primary font-mono">
                                        R$ {item.current_price?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-text-tertiary">{item.unit}</td>
                                </tr>
                            ))}
                            {ingredients.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-text-tertiary">
                                        Nenhum ingrediente encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
