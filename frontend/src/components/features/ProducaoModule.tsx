import { useState } from 'react';
import { Calendar, Calculator } from 'lucide-react';

// Views
import { AgendaView } from '../../modules/ProducaoModule/components/agenda/AgendaView';
import { CalculatorView } from '../../modules/ProducaoModule/components/calculator/CalculatorView';

type TabType = 'agenda' | 'calculator';

export function ProducaoModule() {
    const [activeTab, setActiveTab] = useState<TabType>('agenda');

    return (
        <div className="flex flex-col h-full bg-[#f9fafb]">
            {/* Sub-Navigation (Module Tabs) - Fixed cleanly below the Main Header */}
            <div className="bg-white px-4 md:px-6 pt-3 flex space-x-6 shadow-sm z-20">
                <button
                    onClick={() => setActiveTab('agenda')}
                    className={`pb-3 border-b-2 font-medium text-sm flex items-center transition-colors ${activeTab === 'agenda'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Calendar size={18} className="mr-2" />
                    Agenda Semanal
                </button>
                <button
                    onClick={() => setActiveTab('calculator')}
                    className={`pb-3 border-b-2 font-medium text-sm flex items-center transition-colors ${activeTab === 'calculator'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Calculator size={18} className="mr-2" />
                    Calculadora de Lote
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-[#f9fafb]">
                {activeTab === 'agenda' ? (
                    <AgendaView />
                ) : (
                    <CalculatorView />
                )}
            </div>
        </div>
    );
}
