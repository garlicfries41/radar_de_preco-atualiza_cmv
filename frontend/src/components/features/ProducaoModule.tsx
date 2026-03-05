import {
    Factory,
    ClipboardList,
    PlusCircle,
    Timer,
} from 'lucide-react';
import { NavLink, Routes, Route } from 'react-router-dom';
import { clsx } from 'clsx';

const NAV_ITEMS = [
    { path: 'lotes', label: 'Lotes do Dia', icon: ClipboardList },
    { path: 'novo', label: 'Novo Lote', icon: PlusCircle },
    { path: 'tempo', label: 'Cronômetro', icon: Timer },
];

export function ProducaoModule() {
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
                    </NavLink>
                ))}
            </nav>

            {/* Placeholder Content */}
            <Routes>
                <Route path="*" element={<ProducaoPlaceholder />} />
            </Routes>
        </div>
    );
}

function ProducaoPlaceholder() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
            <div className="w-16 h-16 bg-[#f0fdf4] rounded-2xl flex items-center justify-center mb-5">
                <Factory size={32} className="text-[#16a34a]" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold text-[#111827] mb-2">
                Gestão de Produção
            </h2>
            <p className="text-sm text-[#6b7280] max-w-sm">
                Este módulo está sendo construído. Em breve você poderá registrar lotes
                de produção, cronometrar etapas e calcular o custo real por receita.
            </p>
        </div>
    );
}
