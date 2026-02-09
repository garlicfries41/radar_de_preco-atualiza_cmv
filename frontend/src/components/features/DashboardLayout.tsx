
import { clsx } from 'clsx';
import { LayoutDashboard, ShoppingBasket, ChefHat, Upload } from 'lucide-react';

type Tab = 'upload' | 'ingredients' | 'recipes';

interface DashboardProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    children: React.ReactNode;
}

export function DashboardLayout({ activeTab, onTabChange, children }: DashboardProps) {
    const tabs = [
        { id: 'upload', label: 'Upload', icon: Upload },
        { id: 'ingredients', label: 'Ingredientes', icon: ShoppingBasket },
        { id: 'recipes', label: 'Receitas', icon: ChefHat },
    ];

    return (
        <div className="min-h-screen bg-background text-secondary pb-20 md:pb-0 md:pl-64 transition-colors duration-200">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border fixed top-0 left-0 bottom-0 z-50 shadow-sm">
                <div className="p-6 border-b border-border">
                    <h1 className="text-xl font-bold text-primary flex items-center gap-2 tracking-tight">
                        <LayoutDashboard size={24} />
                        Radar de Preço
                    </h1>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {tabs.map((tab: any) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id as Tab)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all font-medium text-sm",
                                    isActive
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent"
                                )}
                            >
                                <Icon size={20} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 bg-white/90 backdrop-blur-md border-b border-border p-4 z-40 flex items-center justify-between shadow-sm">
                <h1 className="text-lg font-bold text-primary flex items-center gap-2">
                    <LayoutDashboard size={20} />
                    Radar de Preço
                </h1>
            </div>

            {/* Main Content */}
            <main className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen">
                {children}
            </main>

            {/* Bottom Nav (Mobile) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-border z-40 px-6 py-2 flex justify-between items-center safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
                {tabs.map((tab: any) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id as Tab)}
                            className={clsx(
                                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs font-medium",
                                isActive
                                    ? "text-primary"
                                    : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Icon size={24} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
