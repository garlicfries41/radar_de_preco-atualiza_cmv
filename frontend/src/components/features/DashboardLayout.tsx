
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
        <div className="min-h-screen bg-gray-900 text-white pb-20 md:pb-0 md:pl-64">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-gray-800 border-r border-gray-700 fixed top-0 left-0 bottom-0 z-20">
                <div className="p-6 border-b border-gray-700">
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
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                                activeTab === tab.id
                                    ? "bg-primary/20 text-primary"
                                    : "text-gray-400 hover:bg-gray-700 hover:text-white"
                            )}
                        >
                            <tab.icon size={20} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 bg-gray-800 border-b border-gray-700 p-4 z-20 flex items-center justify-between">
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
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-20 px-6 py-2 flex justify-between items-center">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as Tab)}
                        className={clsx(
                            "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs font-medium",
                            activeTab === tab.id
                                ? "text-primary"
                                : "text-gray-500 hover:text-white"
                        )}
                    >
                        <tab.icon size={24} />
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
