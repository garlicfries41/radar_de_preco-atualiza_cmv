import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
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
    const progress = Math.round((linkedCount / items.length) * 100);

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
        const loadingToast = toast.loading('Salvando validação...');

        try {
            const payload: ValidationPayload = {
                receipt_id: data.receipt_id,
                items: items
                    .filter(item => item.matched_ingredient_id) // Only send linked items
                    .map(item => ({
                        receipt_item_id: item.id,
                        ingredient_id: item.matched_ingredient_id!,
                        price: item.parsed_price
                    }))
            };

            await validateReceipt(data.receipt_id, payload);
            toast.success('Itens validados e preços atualizados!', { id: loadingToast });
            onSuccess();
        } catch (error) {
            console.error("Save failed", error);
            toast.error("Erro ao salvar validação. Tente novamente.", { id: loadingToast });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-gray-900 z-10 pb-4 pt-2">
                <div className="flex items-center mb-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold ml-2">Validar Itens</h2>
                    <span className="ml-auto text-sm text-gray-400">
                        {linkedCount}/{items.length}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* List */}
            <div className="space-y-1">
                {items.map(item => (
                    <ValidationRow
                        key={item.id}
                        item={item}
                        onUpdate={handleUpdateItem}
                        onRemove={handleRemoveItem}
                    />
                ))}

                {items.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        Nenhum item para validar.
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800">
                <div className="max-w-lg mx-auto flex gap-3">
                    <Button
                        fullWidth
                        onClick={handleSave}
                        disabled={saving || linkedCount === 0}
                        size="lg"
                    >
                        {saving ? 'Salvando...' : `Confirmar (${linkedCount})`}
                    </Button>
                </div>
            </div>
        </div>
    );
}
