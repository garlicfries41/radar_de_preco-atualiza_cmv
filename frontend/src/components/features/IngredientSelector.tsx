import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { getIngredients } from '../../services/api';
import type { Ingredient } from '../../types';
import { clsx } from 'clsx';

interface IngredientSelectorProps {
    value: string | null;
    onChange: (ingredientId: string, ingredientName: string) => void;
    className?: string;
}

export function IngredientSelector({ value, onChange, className }: IngredientSelectorProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

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
            if (query.length >= 2) {
                setLoading(true);
                try {
                    const data = await getIngredients(query);
                    setResults(data);
                } catch (error) {
                    console.error("Failed to fetch ingredients", error);
                } finally {
                    setLoading(false);
                }
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

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
                    onFocus={() => setIsOpen(true)}
                    placeholder="Buscar ingrediente..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </div>
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {results.map((ingredient) => (
                        <button
                            key={ingredient.id}
                            onClick={() => handleSelect(ingredient)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-200 flex items-center justify-between group"
                        >
                            <span>{ingredient.name}</span>
                            {value === ingredient.id && <Check size={16} className="text-primary" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
