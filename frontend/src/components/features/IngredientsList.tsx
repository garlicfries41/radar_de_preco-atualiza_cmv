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
                        className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-700/50 text-gray-400">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nome</th>
                                <th className="px-4 py-3 font-medium">Categoria</th>
                                <th className="px-4 py-3 font-medium text-right">Preço Atual</th>
                                <th className="px-4 py-3 font-medium text-center">Unidade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {ingredients.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-700/30">
                                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                                    <td className="px-4 py-3 text-gray-400">{item.category}</td>
                                    <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                                        R$ {item.current_price?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-500">{item.unit}</td>
                                </tr>
                            ))}
                            {ingredients.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
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
