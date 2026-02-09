import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Category {
    id: string;
    name: string;
}

interface CategorySelectorProps {
    value: string;
    onChange: (category: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch categories on search change
    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            try {
                const url = search
                    ? `${API_URL}/api/categories?search=${encodeURIComponent(search)}`
                    : `${API_URL}/api/categories`;
                const res = await fetch(url);
                const data = await res.json();
                setCategories(data);
            } catch (err) {
                console.error('Failed to fetch categories:', err);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(fetchCategories, 200);
        return () => clearTimeout(debounce);
    }, [search]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (categoryName: string) => {
        setSearch(categoryName);
        onChange(categoryName);
        setIsOpen(false);
    };

    const handleCreateNew = async () => {
        if (!search.trim()) return;

        const confirmed = window.confirm(`Criar nova categoria "${search}"?`);
        if (!confirmed) return;

        try {
            const res = await fetch(`${API_URL}/api/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: search.trim() }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to create category');
            }

            const newCategory = await res.json();
            toast.success(`Categoria "${newCategory.name}" criada!`);
            handleSelect(newCategory.name);
        } catch (err) {
            toast.error(`Erro: ${err}`);
        }
    };

    const showAddOption = search.trim() && !categories.some(
        c => c.name.toLowerCase() === search.trim().toLowerCase()
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Categoria..."
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary h-10 pr-8"
                />
                <ChevronDown
                    size={16}
                    className="absolute right-2 top-3 text-gray-500 pointer-events-none"
                />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {loading && (
                        <div className="px-3 py-2 text-gray-400 text-sm">Carregando...</div>
                    )}

                    {!loading && categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => handleSelect(cat.name)}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                        >
                            {cat.name}
                        </button>
                    ))}

                    {!loading && showAddOption && (
                        <button
                            onClick={handleCreateNew}
                            className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-gray-700 transition-colors flex items-center gap-2 border-t border-gray-700"
                        >
                            <Plus size={14} />
                            Criar "{search}"
                        </button>
                    )}

                    {!loading && categories.length === 0 && !showAddOption && (
                        <div className="px-3 py-2 text-gray-400 text-sm">
                            Nenhuma categoria encontrada
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
