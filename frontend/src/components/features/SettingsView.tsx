import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, saveSettings } from '../../services/api';

export function SettingsView() {
    const [laborRate, setLaborRate] = useState<string>('0.00');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getSettings();
                if (settings && settings.global_labor_rate !== undefined) {
                    setLaborRate(settings.global_labor_rate.toString());
                    localStorage.setItem('global_labor_rate', settings.global_labor_rate.toString());
                } else {
                    // Fallback to localStorage if no settings found on server
                    const storedRate = localStorage.getItem('global_labor_rate');
                    if (storedRate) {
                        setLaborRate(storedRate);
                    }
                }
            } catch (error) {
                console.error("Error loading settings:", error);
                const storedRate = localStorage.getItem('global_labor_rate');
                if (storedRate) setLaborRate(storedRate);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        const rate = parseFloat(laborRate);
        if (isNaN(rate) || rate < 0) {
            toast.error('Valor inválido');
            return;
        }

        try {
            setLoading(true);
            await saveSettings({ global_labor_rate: rate });
            localStorage.setItem('global_labor_rate', rate.toString());
            toast.success('Configurações salvas!');
        } catch (error) {
            toast.error('Erro ao salvar no servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gray-800 rounded-lg shadow border border-gray-700 p-6">
                <h2 className="text-xl font-bold text-white mb-6">Configurações Globais</h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custo de Mão de Obra por Hora (R$)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={laborRate}
                                onChange={(e) => setLaborRate(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-9 pr-4 text-white focus:border-primary focus:outline-none"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            Este valor será usado para calcular o custo de produção de todas as receitas baseado no tempo (em minutos) que você informar em cada uma.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 bg-primary text-gray-900 px-4 py-2 rounded font-medium hover:bg-primary-dark transition-colors"
                        >
                            <Save size={18} />
                            Salvar Configurações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
