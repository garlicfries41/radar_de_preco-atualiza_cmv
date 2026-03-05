import { useState, useEffect } from 'react';
import { getNutritionReport } from '../../services/api';
import { Loader2, Table, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/text';

interface NutritionData {
    id: string;
    name: string;
    energy_kcal: number;
    carbs_g: number;
    sugars_total_g: number;
    sugars_added_g: number;
    protein_g: number;
    lipid_g: number;
    saturated_fat_g: number;
    trans_fat_g: number;
    fiber_g: number;
    sodium_mg: number;
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
        const headers = [
            'Produto', 'Energia (kcal/100g)', 'Carboidratos (g/100g)', 'Açúcares Totais (g/100g)',
            'Açúcares Adicionados (g/100g)', 'Proteínas (g/100g)', 'Gorduras Totais (g/100g)',
            'Gorduras Saturadas (g/100g)', 'Gorduras Trans (g/100g)', 'Fibras (g/100g)', 'Sódio (mg/100g)'
        ];
        const rows = data.map(item => [
            item.name,
            item.energy_kcal.toString().replace('.', ','),
            item.carbs_g.toString().replace('.', ','),
            item.sugars_total_g.toString().replace('.', ','),
            item.sugars_added_g.toString().replace('.', ','),
            item.protein_g.toString().replace('.', ','),
            item.lipid_g.toString().replace('.', ','),
            item.saturated_fat_g.toString().replace('.', ','),
            item.trans_fat_g.toString().replace('.', ','),
            item.fiber_g.toString().replace('.', ','),
            item.sodium_mg.toString().replace('.', ',')
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
                <p className="text-text-secondary">Gerando consolidado nutricional...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 text-primary rounded-xl">
                        <Table size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-text-primary font-serif">Tabela Nutricional Consolidada (100g)</h2>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2 text-text-primary focus:ring-2 focus:ring-primary outline-none text-sm"
                        />
                    </div>
                    <button
                        onClick={exportCSV}
                        className="bg-surface hover:bg-surface-alt text-text-primary font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-border text-sm"
                    >
                        <Download size={18} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background border-b border-border">
                                <th className="px-6 py-4 text-sm font-semibold text-text-secondary">Produto</th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Energia<br /><span className="text-[10px] text-text-tertiary">(kcal)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Carbos.<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Açúcar Tot.<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Açúcar Adic.<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Proteína<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Gord. Tot.<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Gord. Sat.<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Gord. Trans<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Fibra<br /><span className="text-[10px] text-text-tertiary">(g)</span></th>
                                <th className="px-4 py-4 text-sm font-semibold text-text-secondary text-right">Sódio<br /><span className="text-[10px] text-text-tertiary">(mg)</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-surface-alt transition-colors whitespace-nowrap">
                                    <td className="px-6 py-4 text-sm text-text-primary font-medium w-48 truncate max-w-xs">{item.name}</td>
                                    <td className="px-4 py-4 text-sm text-primary font-mono text-right">{item.energy_kcal.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-blue-300 font-mono text-right">{item.carbs_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-purple-400 font-mono text-right">{item.sugars_total_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-red-400 font-mono text-right">{item.sugars_added_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-blue-500 font-mono text-right">{item.protein_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-yellow-500 font-mono text-right">{item.lipid_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-yellow-600 font-mono text-right">{item.saturated_fat_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-orange-600 font-mono text-right">{item.trans_fat_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-emerald-600 font-mono text-right">{item.fiber_g.toFixed(1)}</td>
                                    <td className="px-4 py-4 text-sm text-red-500 font-mono text-right">{item.sodium_mg.toFixed(1)}</td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="px-6 py-12 text-center text-text-tertiary">
                                        Nenhum produto encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-xs text-text-tertiary italic text-center">
                * Todos os valores são calculados proporcionalmente para **100g** do produto final acabado.
            </p>
        </div>
    );
}
