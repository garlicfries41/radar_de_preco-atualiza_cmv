import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
    LayoutDashboard,
    ChevronDown,
    Package,
    Factory,
} from 'lucide-react';

const MODULES = [
    { id: 'catalogo', label: 'Catálogo de Custos', href: '/catalogo', icon: Package },
    { id: 'producao', label: 'Gestão de Produção', href: '/producao', icon: Factory },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    const activeModule =
        MODULES.find((m) => location.pathname.startsWith(m.href)) ?? MODULES[0];

    return (
        <div className="min-h-svh bg-[#f9fafb] text-[#111827]">
            {/* ─── Top Header (Mobile & Desktop) ─── */}
            <header className="sticky top-0 z-30 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-4 h-14 md:h-16">
                {/* Logo */}
                <div className="flex items-center gap-2.5 font-semibold text-[#111827]">
                    <div className="w-7 h-7 bg-[#16a34a] rounded-lg flex items-center justify-center">
                        <LayoutDashboard size={15} className="text-white" />
                    </div>
                    <span className="text-sm font-bold tracking-tight hidden sm:block">Pastaz ERP</span>
                </div>

                {/* Module Switcher — Dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-1.5 text-sm font-medium text-[#111827] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-3 py-1.5 hover:bg-[#f0fdf4] hover:border-[#bbf7d0] transition-all">
                        <activeModule.icon size={15} className="text-[#16a34a]" />
                        {activeModule.label}
                        <ChevronDown size={13} className="text-[#9ca3af] ml-0.5" />
                    </button>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-1 w-52 bg-white border border-[#e5e7eb] rounded-xl shadow-lg shadow-black/5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 overflow-hidden">
                        {MODULES.map((mod) => (
                            <Link
                                key={mod.id}
                                to={mod.href}
                                className={clsx(
                                    'flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors',
                                    location.pathname.startsWith(mod.href)
                                        ? 'bg-[#f0fdf4] text-[#16a34a]'
                                        : 'text-[#374151] hover:bg-[#f9fafb]'
                                )}
                            >
                                <mod.icon size={16} />
                                {mod.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </header>

            {/* ─── Main Content ─── */}
            <main className="max-w-5xl mx-auto px-4 py-6 md:px-8 pb-24 md:pb-8">
                {children}
            </main>
        </div>
    );
}
