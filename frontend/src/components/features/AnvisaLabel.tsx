import { Printer, Search } from 'lucide-react';

interface AnvisaLabelProps {
    data: {
        recipe_name: string;
        anvisa_portion_g: number;
        nutrients: {
            energetic_value_kcal: number;
            energetic_value_kj: number;
            carbohydrates_g: number;
            sugars_total_g: number;
            sugars_added_g: number;
            proteins_g: number;
            fats_total_g: number;
            fats_saturated_g: number;
            fats_trans_g: number;
            fibers_g: number;
            sodium_mg: number;
        };
        nutrients_100g?: {
            energetic_value_kcal: number;
            energetic_value_kj: number;
            carbohydrates_g: number;
            sugars_total_g: number;
            sugars_added_g: number;
            proteins_g: number;
            fats_total_g: number;
            fats_saturated_g: number;
            fats_trans_g: number;
            fibers_g: number;
            sodium_mg: number;
        };
        daily_values: {
            energetic_value: number;
            carbohydrates: number;
            sugars_added: number;
            proteins: number;
            fats_total: number;
            fats_saturated: number;
            fibers: number;
            sodium: number;
        };
        high_in?: {
            sugars_added: boolean;
            saturated_fat: boolean;
            sodium: boolean;
        };
    };
}

export function AnvisaLabel({ data }: AnvisaLabelProps) {
    const formatValue = (val: number) => {
        if (val === 0) return '0';
        return val < 1 ? val.toFixed(1).replace('.', ',') : Math.round(val).toString();
    };

    const formatDV = (val: number | undefined) => {
        if (val === undefined) return '-';
        return Math.round(val).toString();
    };

    const hasAnyHighIn = data.high_in && (data.high_in.sugars_added || data.high_in.saturated_fat || data.high_in.sodium);
    const has100g = !!data.nutrients_100g;
    const n = data.nutrients;
    const n100 = data.nutrients_100g || data.nutrients;

    const rows: { label: string; indent?: boolean; portionKey: keyof typeof n; dvKey?: keyof typeof data.daily_values; dvDash?: boolean }[] = [
        { label: 'Valor energético (kcal)', portionKey: 'energetic_value_kcal', dvKey: 'energetic_value' },
        { label: 'Carboidratos (g)', portionKey: 'carbohydrates_g', dvKey: 'carbohydrates' },
        { label: 'Açúcares totais (g)', portionKey: 'sugars_total_g', indent: true, dvDash: true },
        { label: 'Açúcares adicionados (g)', portionKey: 'sugars_added_g', indent: true, dvKey: 'sugars_added' },
        { label: 'Proteínas (g)', portionKey: 'proteins_g', dvKey: 'proteins' },
        { label: 'Gorduras totais (g)', portionKey: 'fats_total_g', dvKey: 'fats_total' },
        { label: 'Gorduras saturadas (g)', portionKey: 'fats_saturated_g', indent: true, dvKey: 'fats_saturated' },
        { label: 'Gorduras trans (g)', portionKey: 'fats_trans_g', indent: true, dvDash: true },
        { label: 'Fibra alimentar (g)', portionKey: 'fibers_g', dvKey: 'fibers' },
        { label: 'Sódio (mg)', portionKey: 'sodium_mg', dvKey: 'sodium' },
    ];

    return (
        <div className="bg-white p-4 text-black font-sans max-w-sm mx-auto border-2 border-black" id="anvisa-label-printable">
            {/* Selo de Lupa (ANVISA 2022) */}
            {hasAnyHighIn && (
                <div className="border-2 border-black mb-4 p-2 flex items-center gap-3">
                    <Search size={32} strokeWidth={3} />
                    <div>
                        <div className="text-[10px] font-bold uppercase leading-none">Alto em</div>
                        <div className="flex flex-col text-[12px] font-black uppercase leading-tight">
                            {data.high_in?.sugars_added && <span>Açúcar Adicionado</span>}
                            {data.high_in?.saturated_fat && <span>Gordura Saturada</span>}
                            {data.high_in?.sodium && <span>Sódio</span>}
                        </div>
                    </div>
                </div>
            )}
            <h2 className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2 uppercase">Informação Nutricional</h2>
            <p className="text-sm mb-1 italic">Porções por embalagem: Variável</p>
            <p className="text-sm mb-2 font-bold">Porção: {data.anvisa_portion_g}g</p>

            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr className="border-y-2 border-black">
                        <th className="text-left py-1"></th>
                        {has100g && <th className="text-right py-1 w-16">100g</th>}
                        <th className="text-right py-1 w-20">{data.anvisa_portion_g}g</th>
                        <th className="text-right py-1 w-14">%VD*</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                    {rows.map((row, idx) => (
                        <tr key={idx} className={idx === rows.length - 1 ? 'border-b-2 border-black' : ''}>
                            <td className={`py-1 ${row.indent ? 'pl-4' : ''}`}>{row.label}</td>
                            {has100g && <td className="text-right">{formatValue(n100[row.portionKey])}</td>}
                            <td className="text-right">{formatValue(n[row.portionKey])}</td>
                            <td className="text-right">
                                {row.dvDash ? '-' : formatDV(row.dvKey ? data.daily_values[row.dvKey] : undefined)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <p className="text-[10px] mt-2 leading-tight">
                * Percentual de valores diários fornecidos pela porção.
            </p>

            <div className="mt-4 flex gap-2 no-print">
                <button
                    onClick={() => window.print()}
                    className="flex-1 bg-black text-text-primary p-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-surface transition-colors"
                >
                    <Printer size={16} />
                    Imprimir
                </button>
            </div>
        </div>
    );
}
