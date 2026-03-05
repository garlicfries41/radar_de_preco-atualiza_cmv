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
        <div className="min-h-svh bg-background text-text-primary font-sans">
            {/* ─── Top Header (Mobile & Desktop) ─── */}
            <header className="sticky top-0 z-30 bg-surface border-b border-border flex items-center justify-between px-4 h-14 md:h-16">
                {/* Logo */}
                <div className="flex items-center gap-2.5 font-semibold text-text-primary">
                    <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm border border-border">
                        <LayoutDashboard size={18} className="text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold tracking-tight hidden sm:block font-serif">Pastaz ERP</span>
                </div>

                {/* Module Switcher — Dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-2 text-sm font-semibold text-text-primary bg-surface hover:bg-accent border border-border rounded-xl px-4 py-2 hover:bg-accent hover:border-border transition-all shadow-sm">
                        <activeModule.icon size={16} className="text-primary" />
                        {activeModule.label}
                        <ChevronDown size={14} className="text-text-secondary ml-1" />
                    </button>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 overflow-hidden">
                        {MODULES.map((mod) => (
                            <Link
                                key={mod.id}
                                to={mod.href}
                                className={clsx(
                                    'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-border-light last:border-0',
                                    location.pathname.startsWith(mod.href)
                                        ? 'bg-accent text-text-primary'
                                        : 'text-text-secondary hover:bg-accent hover:text-text-primary'
                                )}
                            >
                                <mod.icon size={16} className={location.pathname.startsWith(mod.href) ? 'text-primary' : 'text-text-tertiary'} />
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
