import { useState, useEffect } from 'react';
import { getNutritionReport } from '../../services/api';
import { Loader2, Table, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/text';

interface NutritionData {
    id: string;
    name: string;
    energy_kcal: number;
    protein_g: number;
    fiber_g: number;
    sugars_added_g: number;
}

export function NutritionalTableView() {
    const [data, setData] = useState<NutritionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const report = await getNutritionReport();
            setData(report);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar relatório nutricional');
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        const headers = ['Produto', 'Energia (kcal/100g)', 'Proteína (g/100g)', 'Fibra (g/100g)', 'Açúcar Adicionado (g/100g)'];
        const rows = data.map(item => [
            item.name,
            item.energy_kcal.toString().replace('.', ','),
            item.protein_g.toString().replace('.', ','),
            item.fiber_g.toString().replace('.', ','),
            item.sugars_added_g.toString().replace('.', ',')
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `tabela_nutricional_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredData = data.filter(item =>
        normalizeText(item.name).includes(normalizeText(searchTerm))
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin text-primary mb-4" size={48} />
                <p className="text-gray-400">Gerando consolidado nutricional...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 text-primary rounded-lg">
                        <Table size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Tabela Nutricional Consolidada (100g)</h2>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary outline-none text-sm"
                        />
                    </div>
                    <button
                        onClick={exportCSV}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-gray-700 text-sm"
                    >
                        <Download size={18} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-700">
                                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Produto</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-300 text-right">Energia (kcal)</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-300 text-right">Proteína (g)</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-300 text-right">Fibra (g)</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-300 text-right">Açúcar Adici. (g)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 text-sm text-white font-medium">{item.name}</td>
                                    <td className="px-6 py-4 text-sm text-emerald-400 font-mono text-right">{item.energy_kcal.toFixed(1)}</td>
                                    <td className="px-6 py-4 text-sm text-blue-400 font-mono text-right">{item.protein_g.toFixed(1)}</td>
                                    <td className="px-6 py-4 text-sm text-orange-400 font-mono text-right">{item.fiber_g.toFixed(1)}</td>
                                    <td className="px-6 py-4 text-sm text-red-400 font-mono text-right">{item.sugars_added_g.toFixed(1)}</td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum produto encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-xs text-gray-500 italic text-center">
                * Todos os valores são calculados proporcionalmente para **100g** do produto final acabado.
            </p>
        </div>
    );
}
