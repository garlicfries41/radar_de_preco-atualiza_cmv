import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { getIngredients } from '../../services/api';
import type { Ingredient } from '../../types';
import { clsx } from 'clsx';

interface IngredientSelectorProps {
    selectedId: string | null;
    selectedName?: string;
    onChange: (ingredientId: string, ingredientName: string) => void;
    className?: string;
}

export function IngredientSelector({ selectedId, selectedName, onChange, className }: IngredientSelectorProps) {
    // If we have a selected match, use its name. Otherwise empty.
    const [query, setQuery] = useState(selectedName || '');
    const [results, setResults] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync query if selectedName changes externaly (e.g. initial load)
    useEffect(() => {
        if (selectedName && query === '') {
            setQuery(selectedName);
        }
    }, [selectedName]);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Only search if query changed and is not the already selected one
            if (query.length >= 2 && query !== selectedName) {
                setLoading(true);
                try {
                    const data = await getIngredients(query);
                    setResults(data);
                } catch (error) {
                    console.error("Failed to fetch ingredients", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, selectedName]);

    const handleSelect = (ingredient: Ingredient) => {
        onChange(ingredient.id, ingredient.name);
        setQuery(ingredient.name);
        setIsOpen(false);
    };

    return (
        <div className={clsx("relative", className)} ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        // Trigger search if empty? No, wait for typing.
                    }}
                    placeholder="Buscar ingrediente..."
                    className={clsx(
                        "w-full pl-9 pr-4 py-3 rounded-lg text-sm transition-all outline-none",
                        "bg-surfaceHighlight border border-border text-white placeholder-gray-500",
                        "focus:border-primary focus:ring-1 focus:ring-primary",
                        selectedId ? "text-primary font-medium" : ""
                    )}
                />
                <div className="absolute left-3 top-3.5 text-gray-500">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </div>
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-surfaceHighlight border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {results.map((ingredient) => (
                        <button
                            key={ingredient.id}
                            onClick={() => handleSelect(ingredient)}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm text-gray-200 flex items-center justify-between group transition-colors"
                        >
                            <span>{ingredient.name}</span>
                            {selectedId === ingredient.id && <Check size={16} className="text-primary" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
