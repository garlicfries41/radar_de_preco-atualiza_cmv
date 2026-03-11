import React, { useState } from 'react';
import { Calendar, Calculator, FileText } from 'lucide-react';

// Views
import { AgendaView } from './components/agenda/AgendaView';
import { CalculatorView } from './components/calculator/CalculatorView';
import { CatalogoView } from './components/catalogo/CatalogoView';

type TabType = 'agenda' | 'calculator' | 'catalogo';

const ProducaoModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('agenda');

    return (
        <div className="flex flex-col h-full bg-[#f9fafb]">
            {/* Sub-Navigation (Module Tabs) */}
            <div className="bg-white border-b border-[#E5E7EB] px-4 md:px-6 pt-4 flex space-x-6 sticky top-0 z-20 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('agenda')}
                    className={`pb-3 border-b-2 font-medium text-sm flex items-center transition-colors whitespace-nowrap ${activeTab === 'agenda'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Calendar size={18} className="mr-2" />
                    Agenda Semanal
                </button>
                <button
                    onClick={() => setActiveTab('catalogo')}
                    className={`pb-3 border-b-2 font-medium text-sm flex items-center transition-colors whitespace-nowrap ${activeTab === 'catalogo'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <FileText size={18} className="mr-2" />
                    Catálogo de Processos
                </button>
                <button
                    onClick={() => setActiveTab('calculator')}
                    className={`pb-3 border-b-2 font-medium text-sm flex items-center transition-colors whitespace-nowrap ${activeTab === 'calculator'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Calculator size={18} className="mr-2" />
                    Calculadora de Lote
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'agenda' && <AgendaView />}
                {activeTab === 'calculator' && <CalculatorView />}
                {activeTab === 'catalogo' && <CatalogoView />}
            </div>
        </div>
    );
};

export default ProducaoModule;
