import React from 'react';
import { Download, Printer } from 'lucide-react';

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
        daily_values: {
            energetic_value: number;
            carbohydrates: number;
            proteins: number;
            fats_total: number;
            fats_saturated: number;
            fibers: number;
            sodium: number;
        };
    };
}

export function AnvisaLabel({ data }: AnvisaLabelProps) {
    const formatValue = (val: number) => {
        if (val === 0) return '0';
        return val < 1 ? val.toFixed(1).replace('.', ',') : Math.round(val).toString();
    };

    const formatDV = (val: number) => {
        return Math.round(val).toString();
    };

    return (
        <div className="bg-white p-4 text-black font-sans max-w-sm mx-auto border-2 border-black" id="anvisa-label-printable">
            <h2 className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2 uppercase">Informação Nutricional</h2>
            <p className="text-sm mb-1 italic">Porções por embalagem: Variável</p>
            <p className="text-sm mb-2 font-bold">Porção: {data.anvisa_portion_g}g</p>

            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr className="border-y-2 border-black">
                        <th className="text-left py-1"></th>
                        <th className="text-right py-1 w-20">{data.anvisa_portion_g}g</th>
                        <th className="text-right py-1 w-16">%VD*</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                    <tr>
                        <td className="py-1">Valor energético (kcal)</td>
                        <td className="text-right">{formatValue(data.nutrients.energetic_value_kcal)}</td>
                        <td className="text-right">{formatDV(data.daily_values.energetic_value)}</td>
                    </tr>
                    <tr>
                        <td className="py-1">Carboidratos (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.carbohydrates_g)}</td>
                        <td className="text-right">{formatDV(data.daily_values.carbohydrates)}</td>
                    </tr>
                    <tr>
                        <td className="py-1 pl-4">Açúcares totais (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.sugars_total_g)}</td>
                        <td className="text-right text-gray-400">-</td>
                    </tr>
                    <tr>
                        <td className="py-1 pl-4">Açúcares adicionados (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.sugars_added_g)}</td>
                        <td className="text-right">-</td>
                    </tr>
                    <tr>
                        <td className="py-1">Proteínas (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.proteins_g)}</td>
                        <td className="text-right">{formatDV(data.daily_values.proteins)}</td>
                    </tr>
                    <tr>
                        <td className="py-1">Gorduras totais (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.fats_total_g)}</td>
                        <td className="text-right">{formatDV(data.daily_values.fats_total)}</td>
                    </tr>
                    <tr>
                        <td className="py-1 pl-4">Gorduras saturadas (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.fats_saturated_g)}</td>
                        <td className="text-right">{formatDV(data.daily_values.fats_saturated)}</td>
                    </tr>
                    <tr>
                        <td className="py-1 pl-4">Gorduras trans (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.fats_trans_g)}</td>
                        <td className="text-right">-</td>
                    </tr>
                    <tr>
                        <td className="py-1">Fibra alimentar (g)</td>
                        <td className="text-right">{formatValue(data.nutrients.fibers_g)}</td>
                        <td className="text-right">{formatDV(data.daily_values.fibers)}</td>
                    </tr>
                    <tr className="border-b-2 border-black">
                        <td className="py-1">Sódio (mg)</td>
                        <td className="text-right">{formatValue(data.nutrients.sodium_mg)}</td>
                        <td className="text-right">{formatDV(data.daily_values.sodium)}</td>
                    </tr>
                </tbody>
            </table>

            <p className="text-[10px] mt-2 leading-tight">
                * Percentual de valores diários fornecidos pela porção.
            </p>

            <div className="mt-4 flex gap-2 no-print">
                <button
                    onClick={() => window.print()}
                    className="flex-1 bg-black text-white p-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-gray-800 transition-colors"
                >
                    <Printer size={16} />
                    Imprimir
                </button>
            </div>
        </div>
    );
}
