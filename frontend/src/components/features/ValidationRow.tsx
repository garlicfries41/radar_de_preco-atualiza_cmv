import type { ScannedItem } from '../../types';
import { IngredientSelector } from './IngredientSelector';
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

    return (
        <div className="bg-surface p-4 rounded-xl border border-border mb-3 hover:border-border transition-colors">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-text-primary flex-1 mr-2">{item.raw_name}</h3>
                <button
                    onClick={() => onRemove(item.id)}
                    className="text-text-tertiary hover:text-red-400 transition-colors p-1"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex gap-3 mb-1 items-end">
                <div className="w-1/3">
                    <label className="block text-xs text-text-secondary mb-1">Preço</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1.5 text-text-tertiary text-sm">R$</span>
                        <input
                            type="number"
                            value={item.parsed_price}
                            onChange={(e) => onUpdate(item.id, { parsed_price: e.target.valueAsNumber })}
                            className="w-full bg-background border border-border rounded px-2 pl-7 py-2 text-sm text-text-primary focus:outline-none focus:border-border focus:ring-1 focus:ring-primary h-10"
                            step="0.01"
                        />
                    </div>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-text-secondary mb-1">Vincular Ingrediente</label>
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
