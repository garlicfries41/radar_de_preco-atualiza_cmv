import { DREView } from '../../modules/FinanceiroModule/components/dre/DREView';
import { BarChart2 } from 'lucide-react';
import { useState } from 'react';

type TabType = 'dre';

export function FinanceiroModule() {
    const [activeTab] = useState<TabType>('dre');

    return (
        <div className="flex flex-col h-full bg-[#f9fafb]">
            {/* Sub-Navigation */}
            <div className="bg-white px-4 md:px-6 pt-3 flex space-x-6 shadow-sm z-20">
                <button
                    className="pb-3 border-b-2 border-primary text-primary font-medium text-sm flex items-center"
                >
                    <BarChart2 size={18} className="mr-2" />
                    DRE
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-[#f9fafb] px-4 md:px-6 py-6">
                {activeTab === 'dre' && <DREView />}
            </div>
        </div>
    );
}
