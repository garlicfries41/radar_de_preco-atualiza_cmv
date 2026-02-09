import type { ScannedItem } from '../../types';
import { IngredientSelector } from './IngredientSelector';
import { Trash2 } from 'lucide-react';

interface ValidationRowProps {
    item: ScannedItem;
    onUpdate: (id: string, updates: Partial<ScannedItem>) => void;
    onRemove: (id: string) => void;
}

export function ValidationRow({ item, onUpdate, onRemove }: ValidationRowProps) {
    const handleIngredientChange = (ingredientId: string, ingredientName: string) => {
        onUpdate(item.id, {
            matched_ingredient_id: ingredientId,
            suggested_ingredient: {
                ...item.suggested_ingredient,
                id: ingredientId,
                name: ingredientName
            } as any // quick fix to store display name
        });
    };

    // Determine the name to display in the selector
    // Priority: Explicitly matched (from user selection) > Suggested (from backend) > Empty
    const displayIngredientName = item.suggested_ingredient?.name;

    return (
        <div className="bg-surface border border-border p-4 rounded-xl mb-3 hover:border-gray-600 transition-all shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-base font-semibold text-white flex-1 mr-4 break-words leading-tight">
                    {item.raw_name}
                </h3>
                <button
                    onClick={() => onRemove(item.id)}
                    className="text-gray-500 hover:text-red-500 transition-colors p-1.5 hover:bg-white/5 rounded-md"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <div className="flex gap-3 items-end">
                {/* Price Input */}
                <div className="w-1/3">
                    <label className="block text-xs font-medium text-textData mb-1.5 uppercase tracking-wide">Preço</label>
                    <div className="relative group">
                        <span className="absolute left-3 top-3 text-gray-500 text-sm font-medium">R$</span>
                        <input
                            type="number"
                            value={item.parsed_price}
                            onChange={(e) => onUpdate(item.id, { parsed_price: parseFloat(e.target.value) })}
                            className="w-full bg-surfaceHighlight border border-border rounded-lg pl-9 pr-3 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono transition-all"
                            step="0.01"
                        />
                    </div>
                </div>

                {/* Ingredient Selector */}
                <div className="flex-1">
                    <label className="block text-xs font-medium text-textData mb-1.5 uppercase tracking-wide">
                        Vincular Ingrediente
                    </label>
                    <IngredientSelector
                        selectedId={item.matched_ingredient_id}
                        selectedName={displayIngredientName}
                        onChange={handleIngredientChange}
                    />
                </div>
            </div>

            {/* Show suggestion hint only if strictly necessary, but usually selector handles it */}
            {!item.matched_ingredient_id && item.suggested_ingredient && (
                <div className="mt-2 text-xs text-primary/80 flex items-center gap-1">
                    <span>✨ Sugestão: {item.suggested_ingredient.name}</span>
                </div>
            )}
        </div>
    );
}
