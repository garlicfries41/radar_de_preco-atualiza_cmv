import type { ScannedItem } from '../../types';
import { IngredientSelector } from './IngredientSelector';
import { CategorySelector } from './CategorySelector';
import { Trash2 } from 'lucide-react';

interface ValidationRowProps {
    item: ScannedItem;
    onUpdate: (id: string, updates: Partial<ScannedItem>) => void;
    onRemove: (id: string) => void;
}

export function ValidationRow({ item, onUpdate, onRemove }: ValidationRowProps) {
    const handleIngredientChange = (ingredientId: string, _ingredientName: string) => {
        onUpdate(item.id, {
            matched_ingredient_id: ingredientId,
        });
    };

    const handleCategoryChange = (category: string) => {
        onUpdate(item.id, { category });
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-3 hover:border-gray-600 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-white flex-1 mr-2">{item.raw_name}</h3>
                <button
                    onClick={() => onRemove(item.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-1">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Preço</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1.5 text-gray-500 text-sm">R$</span>
                        <input
                            type="number"
                            value={item.parsed_price}
                            onChange={(e) => onUpdate(item.id, { parsed_price: e.target.valueAsNumber })}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 pl-7 py-2 text-sm text-white focus:outline-none focus:border-primary h-10"
                            step="0.01"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                    <CategorySelector
                        value={item.category || ''}
                        onChange={handleCategoryChange}
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Ingrediente</label>
                    <IngredientSelector
                        value={item.matched_ingredient_id}
                        onChange={handleIngredientChange}
                    />
                </div>
            </div>
            {item.suggested_ingredient && !item.matched_ingredient_id && (
                <div className="mt-1 text-xs text-yellow-500">
                    Sugestão: {item.suggested_ingredient.name}
                </div>
            )}
        </div>
    );
}
