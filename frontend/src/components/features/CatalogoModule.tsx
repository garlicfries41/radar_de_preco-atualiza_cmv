import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
    Upload,
    ShoppingBasket,
    ChefHat,
    Apple,
    Settings,
} from 'lucide-react';
import { CameraUpload } from './CameraUpload';
import { ValidationInterface } from './ValidationInterface';
import { IngredientsTable } from './IngredientsTable';
import { RecipesList } from './RecipesList';
import { PrePreparosList } from './PrePreparosList';
import { NutritionalTableView } from './NutritionalTableView';
import { SettingsView } from './SettingsView';
import type { UploadResponse } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || '';

const NAV_ITEMS = [
    { path: '/catalogo/upload', label: 'Upload', icon: Upload },
    { path: '/catalogo/ingredientes', label: 'Ingredientes', icon: ShoppingBasket },
    { path: '/catalogo/pre-preparos', label: 'Pré-preparos', icon: ChefHat },
    { path: '/catalogo/receitas', label: 'Receitas', icon: ChefHat },
    { path: '/catalogo/nutricao', label: 'Nutrição', icon: Apple },
    { path: '/catalogo/configuracoes', label: 'Config.', icon: Settings },
];

export function CatalogoModule() {
    const [pendingCount, setPendingCount] = useState(0);
    const [receiptData, setReceiptData] = useState<UploadResponse | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchPendingCount();
    }, []);

    const fetchPendingCount = async () => {
        try {
            const res = await fetch(`${API_URL}/api/ingredients/pending`);
            const data = await res.json();
            setPendingCount(data.length);
        } catch {
            // ignore
        }
    };

    const handleUploadSuccess = (data: UploadResponse) => {
        setReceiptData(data);
        setShowValidation(true);
    };

    const handleValidationSuccess = () => {
        setShowValidation(false);
        setReceiptData(null);
        fetchPendingCount();
        navigate('/catalogo/ingredientes');
    };

    return (
        <div>
            {/* Sub Navigation */}
            <nav className="flex gap-1 overflow-x-auto no-scrollbar mb-6 border-b border-[#e5e7eb]">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap border-b-2 -mb-px transition-colors',
                                isActive
                                    ? 'border-[#16a34a] text-[#16a34a] bg-[#f0fdf4]'
                                    : 'border-transparent text-[#6b7280] hover:text-[#374151] hover:bg-[#f9fafb]'
                            )
                        }
                    >
                        <item.icon size={15} strokeWidth={1.75} />
                        {item.label}
                        {item.path === '/catalogo/ingredientes' && pendingCount > 0 && (
                            <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {pendingCount}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Sub-routes */}
            <Routes>
                <Route
                    path="upload"
                    element={
                        showValidation && receiptData ? (
                            <ValidationInterface
                                data={receiptData}
                                onBack={() => setShowValidation(false)}
                                onSuccess={handleValidationSuccess}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
                                <div className="mb-6 max-w-sm">
                                    <h2 className="text-xl font-semibold text-[#111827] mb-1.5">
                                        Enviar Notas Fiscais
                                    </h2>
                                    <p className="text-sm text-[#6b7280]">
                                        Tire fotos ou faça upload para atualizar os preços dos
                                        ingredientes automaticamente.
                                    </p>
                                </div>
                                <CameraUpload onUploadSuccess={handleUploadSuccess} />
                            </div>
                        )
                    }
                />
                <Route
                    path="ingredientes"
                    element={<IngredientsTable onIngredientUpdate={fetchPendingCount} />}
                />
                <Route path="pre-preparos" element={<PrePreparosList />} />
                <Route path="receitas/*" element={<RecipesList />} />
                <Route path="nutricao" element={<NutritionalTableView />} />
                <Route path="configuracoes" element={<SettingsView />} />
                {/* Redirect any unknown sub-path to upload */}
                <Route path="*" element={<Navigate to="/catalogo/upload" replace />} />
            </Routes>
        </div>
    );
}
