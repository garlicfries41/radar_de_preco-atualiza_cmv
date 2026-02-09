import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { UploadResponse, ScannedItem, ValidationPayload } from '../../types';
import { Button } from '../ui/Button';
import { ValidationRow } from './ValidationRow';
import { validateReceipt } from '../../services/api';

interface ValidationInterfaceProps {
    data: UploadResponse;
    onBack: () => void;
    onSuccess: () => void;
}

export function ValidationInterface({ data, onBack, onSuccess }: ValidationInterfaceProps) {
    const [items, setItems] = useState<ScannedItem[]>(data.items);
    const [saving, setSaving] = useState(false);

    // Filter linked items
    const linkedCount = items.filter(i => i.matched_ingredient_id).length;
    const progress = items.length > 0 ? Math.round((linkedCount / items.length) * 100) : 0;

    const handleUpdateItem = (id: string, updates: Partial<ScannedItem>) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: ValidationPayload = {
                receipt_id: data.receipt_id,
                items: items
                    .filter(item => item.matched_ingredient_id) // Only send linked items
                    .map(item => ({
                        receipt_item_id: item.id,
                        ingredient_id: item.matched_ingredient_id!,
                        category: item.category_suggestion || 'Outros', // Fallback
                        price: item.parsed_price
                    }))
            };

            await validateReceipt(data.receipt_id, payload);
            // alert('Validação salva com sucesso!'); // Removed alert for smoother UX
            onSuccess();
        } catch (error) {
            console.error("Save failed", error);
            alert("Erro ao salvar validação.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto pb-28">
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-md z-20 pb-4 pt-4 border-b border-border mb-4">
                <div className="flex items-center px-4 mb-3">
                    <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold ml-2 text-white">Validar Itens</h2>
                    <span className="ml-auto text-sm font-medium text-textData bg-surface px-3 py-1 rounded-full border border-border">
                        {linkedCount} / {items.length}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-surface w-full">
                    <div
                        className="h-full bg-primary shadow-[0_0_10px_rgba(212,255,0,0.5)] transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* List */}
            <div className="space-y-1 px-4">
                {items.map(item => (
                    <ValidationRow
                        key={item.id}
                        item={item}
                        onUpdate={handleUpdateItem}
                        onRemove={handleRemoveItem}
                    />
                ))}

                {items.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-lg">Nenhum item para validar.</p>
                        <p className="text-sm text-gray-700 mt-2">Tente escanear outra nota.</p>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border z-30">
                <div className="max-w-lg mx-auto">
                    <Button
                        fullWidth
                        onClick={handleSave}
                        disabled={saving || linkedCount === 0}
                        size="lg"
                        className={clsx(
                            "font-bold text-black transition-all transform active:scale-95",
                            linkedCount > 0 ? "bg-primary hover:bg-primaryHover shadow-[0_0_20px_rgba(212,255,0,0.3)]" : "bg-surface border border-border text-gray-500"
                        )}
                    >
                        {saving ? 'Processando...' : `Confirmar Atualização (${linkedCount})`}
                    </Button>
                </div>
            </div>
        </div>
    );
}
