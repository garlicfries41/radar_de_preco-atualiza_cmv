
import { clsx } from 'clsx';
import { LayoutDashboard, ShoppingBasket, ChefHat, Upload, Settings, Apple } from 'lucide-react';

type Tab = 'upload' | 'ingredients' | 'pre_preparos' | 'recipes' | 'nutritional_table' | 'settings';

interface DashboardProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    children: React.ReactNode;
    pendingCount?: number;
}

export function DashboardLayout({ activeTab, onTabChange, children, pendingCount = 0 }: DashboardProps) {
    const tabs = [
        { id: 'upload', label: 'Upload', icon: Upload },
        { id: 'ingredients', label: 'Ingredientes', icon: ShoppingBasket, badge: pendingCount },
        { id: 'pre_preparos', label: 'Pré-preparos', icon: ChefHat },
        { id: 'recipes', label: 'Receitas', icon: ChefHat },
        { id: 'nutritional_table', label: 'Nutrição', icon: Apple },
        { id: 'settings', label: 'Configurações', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-background text-text-primary pb-20 md:pb-0 md:pl-64">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border fixed top-0 left-0 bottom-0 z-20">
                <div className="p-6 border-b border-border">
                    <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                        <LayoutDashboard size={24} />
                        Radar de Preço
                    </h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id as Tab)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium relative",
                                activeTab === tab.id
                                    ? "bg-primary/20 text-primary"
                                    : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                            )}
                        >
                            <tab.icon size={20} />
                            {tab.label}
                            {(tab.badge || 0) > 0 && (
                                <span className="absolute right-3 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 bg-surface border-b border-border p-4 z-20 flex items-center justify-between">
                <h1 className="text-lg font-bold text-primary flex items-center gap-2">
                    <LayoutDashboard size={20} />
                    Radar de Preço
                </h1>
            </div>

            {/* Main Content */}
            <main className="p-4 md:p-8 max-w-5xl mx-auto">
                {children}
            </main>

            {/* Bottom Nav (Mobile) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-20 px-2 py-2 flex overflow-x-auto no-scrollbar items-center gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as Tab)}
                        className={clsx(
                            "flex flex-col items-center gap-1 p-2 rounded-xl transition-colors text-[10px] min-w-[64px] font-medium relative",
                            activeTab === tab.id
                                ? "text-primary"
                                : "text-text-tertiary hover:text-text-primary"
                        )}
                    >
                        <tab.icon size={22} />
                        {tab.label}
                        {(tab.badge || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 bg-yellow-500 text-gray-900 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>
        </div>
    );
}
