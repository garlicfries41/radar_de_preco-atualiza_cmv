import React, { useState, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Plus, Trash2 } from 'lucide-react';
import { addExpense, deleteExpense, syncGatewayMonth, getGatewayHistory, type DREData, type ExpenseItem } from '../../api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface WizardField {
    label: string;
    catName: string;
    parentCatName?: string;
}

interface InfraWebItem {
    description: string;
    amount: string;
    /** suggestion (mês anterior) em número */
    suggestion: number;
    id: string;
}

interface WizardValues {
    [catName: string]: string; // valor digitado como string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const sumByCategory = (expenses: ExpenseItem[], catName: string) =>
    expenses.filter(e => e.category_name === catName).reduce((s, e) => s + e.amount, 0);

const parseVal = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? 0 : n;
};

// ─── Campo com sugestão via Tab ───────────────────────────────────────────────

function SuggestInput({
    label,
    value,
    onChange,
    suggestion,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    suggestion: number;
}) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' && value === '' && suggestion > 0) {
            e.preventDefault();
            onChange(suggestion.toFixed(2).replace('.', ','));
        }
    };

    return (
        <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
                type="text"
                inputMode="decimal"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={suggestion > 0 ? `Mês passado: ${fmt(suggestion)} — Tab para usar` : '0,00'}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
}

// ─── Definição dos steps ──────────────────────────────────────────────────────

const STEPS: Array<{
    title: string;
    fields?: WizardField[];
    isInfraWeb?: boolean;
    /** Se true, permite adicionar campos extras via + */
    isDynamic?: boolean;
    /** Categoria pai para itens dinâmicos */
    dynamicCatName?: string;
}> = [
        {
            title: 'Deduções',
            fields: [
                { label: 'DAS (Simples Nacional)', catName: 'DAS (Simples Nacional)' },
                { label: 'Devoluções', catName: 'Devoluções' },
            ],
        },
        {
            title: 'Funcionários',
            fields: [
                { label: 'Pró-labore', catName: 'Pró-labore' },
                { label: 'Empregados', catName: 'Empregados' },
            ],
        },
        {
            title: 'Despesas com Vendas',
            fields: [
                { label: 'Taxa Mercado Pago', catName: 'Taxa Mercado Pago' },
                { label: 'Taxa Stripe', catName: 'Taxa Stripe' },
                { label: 'Comissão Feiras', catName: 'Comissão Feiras' },
                { label: 'Alimentação Feira', catName: 'Alimentação Feira' },
            ],
            isDynamic: true,
            dynamicCatName: 'Despesas com Vendas',
        },
        {
            title: 'Estrutura (Fixas)',
            fields: [
                { label: 'Aluguel', catName: 'Aluguel' },
                { label: 'IPTU', catName: 'IPTU' },
                { label: 'Condomínio', catName: 'Condomínio' },
                { label: 'Água', catName: 'Água' },
                { label: 'Luz', catName: 'Luz' },
                { label: 'Internet', catName: 'Internet' },
                { label: 'Telefone', catName: 'Telefone' },
                { label: 'Gás', catName: 'Gás' },
            ],
        },
        {
            title: 'Marketing',
            fields: [
                { label: 'Venda Direta', catName: 'Venda Direta', parentCatName: 'Marketing' },
                { label: 'Revenda', catName: 'Revenda', parentCatName: 'Marketing' },
                { label: 'Food Service', catName: 'Food Service', parentCatName: 'Marketing' },
            ],
            isDynamic: true,
            dynamicCatName: 'Marketing',
        },
        {
            title: 'Logística & Frota',
            fields: [
                { label: 'Entregas: Venda Direta', catName: 'Venda Direta', parentCatName: 'Entregas' },
                { label: 'Entregas: Revenda', catName: 'Revenda', parentCatName: 'Entregas' },
                { label: 'Entregas: Food Service', catName: 'Food Service', parentCatName: 'Entregas' },
                { label: 'Carro: Feira', catName: 'Feira', parentCatName: 'Carro' },
                { label: 'Carro: Geral', catName: 'Geral', parentCatName: 'Carro' },
            ],
        },
        {
            title: 'Gestão & Outros',
            fields: [
                { label: 'Contabilidade', catName: 'Contabilidade' },
                { label: 'Infraweb: Exclusivo do site', catName: 'Exclusivo do site', parentCatName: 'Infra Web' },
                { label: 'Infraweb: Geral', catName: 'Geral', parentCatName: 'Infra Web' },
                { label: 'Material de Limpeza', catName: 'Material de Limpeza' },
                { label: 'Diarista', catName: 'Diarista' },
                { label: 'Outras', catName: 'Outras' },
            ],
            isDynamic: true,
            dynamicCatName: 'Outras Despesas',
        },
        {
            title: 'Inadimplência',
            fields: [
                { label: 'Chat', catName: 'Atendimento por chat', parentCatName: 'Inadimplência' },
                { label: 'Revenda', catName: 'Revenda', parentCatName: 'Inadimplência' },
                { label: 'Food Service', catName: 'Food Service', parentCatName: 'Inadimplência' },
            ],
        },
        {
            title: 'Pós-EBITDA',
            fields: [
                { label: 'Depreciação de maquinário', catName: 'Depreciação de maquinário' },
                { label: 'Juros de Empréstimos', catName: 'Juros de Empréstimos' },
                { label: 'Impostos sobre Lucro', catName: 'Impostos sobre Lucro' },
            ],
        },
        {
            title: 'Resumo',
        },
    ];

// ─── Componente principal ─────────────────────────────────────────────────────

export function FechamentoWizard({
    year,
    month,
    prevData,
    currentExpenses,
    onClose,
    onSaved,
}: {
    year: number;
    month: number;
    prevData: DREData | null;
    currentExpenses: ExpenseItem[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [step, setStep] = useState(0);
    const [values, setValues] = useState<WizardValues>({});
    const [dynamicItems, setDynamicItems] = useState<Record<string, InfraWebItem[]>>({});
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [confirmReplace, setConfirmReplace] = useState(false);
    const idCounter = useRef(0);

    const recordDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const hasExisting = currentExpenses.length > 0;

    const prevExpenses = prevData?.expenses ?? [];

    const getSuggestion = (catName: string, parentName?: string) => {
        if (!parentName) return sumByCategory(prevExpenses, catName);
        return prevExpenses
            .filter(e => e.category_name === catName && e.parent_category_name === parentName)
            .reduce((s, e) => s + e.amount, 0);
    };

    const setField = (key: string, v: string) =>
        setValues(prev => ({ ...prev, [key]: v }));


    const addDynamicItem = (stepTitle: string) => {
        idCounter.current += 1;
        setDynamicItems(prev => ({
            ...prev,
            [stepTitle]: [
                ...(prev[stepTitle] || []),
                { description: '', amount: '', suggestion: 0, id: String(idCounter.current) }
            ]
        }));
    };

    const updateDynamicItem = (stepTitle: string, id: string, patch: Partial<InfraWebItem>) =>
        setDynamicItems(prev => ({
            ...prev,
            [stepTitle]: (prev[stepTitle] || []).map(it => it.id === id ? { ...it, ...patch } : it)
        }));

    const removeDynamicItem = (stepTitle: string, id: string) =>
        setDynamicItems(prev => ({
            ...prev,
            [stepTitle]: (prev[stepTitle] || []).filter(it => it.id !== id)
        }));

    const handleSyncGateways = async () => {
        setSyncing(true);
        try {
            // 1. Tenta buscar histórico já sincronizado para o mês
            let history = await getGatewayHistory(year, month);

            // 2. Se for o mês atual ou histórico vazio, dispara sync
            const isCurrentMonth = year === new Date().getFullYear() && month === (new Date().getMonth() + 1);
            if (isCurrentMonth || history.length === 0) {
                await syncGatewayMonth(year, month);
                history = await getGatewayHistory(year, month);
            }

            // Agrupar por gateway
            const mp = history.filter(h => h.gateway === 'mercadopago');
            const st = history.filter(h => h.gateway === 'stripe');

            const mpFees = mp.reduce((s, h) => s + Number(h.fee_amount), 0);
            const stFees = st.reduce((s, h) => s + Number(h.fee_amount), 0);

            if (mpFees > 0) setField('Taxa Mercado Pago', mpFees.toFixed(2).replace('.', ','));
            if (stFees > 0) setField('Taxa Stripe', stFees.toFixed(2).replace('.', ','));

            console.log("Sincronização concluída", { mpFees, stFees });
        } catch (err) {
            console.error("Erro ao sincronizar gateways:", err);
            alert("Erro ao sincronizar com as APIs. Verifique as credenciais no servidor.");
        } finally {
            setSyncing(false);
        }
    };

    // Coleta todos os lançamentos a salvar
    const buildPayloads = () => {
        const items: Array<Parameters<typeof addExpense>[0]> = [];

        // Campos normais
        for (const s of STEPS) {
            if (!s.fields) continue;
            for (const f of s.fields) {
                const key = f.parentCatName ? `${f.parentCatName}:${f.catName}` : f.catName;
                const raw = values[key];
                const val = parseVal(raw || '');
                if (val > 0) {
                    items.push({
                        description: f.label,
                        amount: val,
                        category_name: f.catName,
                        parent_category_name: f.parentCatName,
                        record_date: recordDate
                    });
                }
            }
        }

        // Itens dinâmicos por categoria
        for (const [stepTitle, dynamicList] of Object.entries(dynamicItems)) {
            const step = STEPS.find(s => s.title === stepTitle);
            const catName = step?.dynamicCatName ?? step?.fields?.[0]?.catName ?? stepTitle;

            for (const it of dynamicList) {
                const val = parseVal(it.amount);
                if (val > 0 && it.description.trim()) {
                    items.push({ description: it.description.trim(), amount: val, category_name: catName, record_date: recordDate });
                }
            }
        }

        return items;
    };

    const handleConfirm = async () => {
        if (hasExisting && !confirmReplace) {
            setConfirmReplace(true);
            return;
        }

        setSaving(true);
        try {
            // Se substituição: apagar existentes primeiro
            if (hasExisting && confirmReplace) {
                await Promise.all(currentExpenses.map(e => deleteExpense(e.id)));
            }

            const payloads = buildPayloads();
            await Promise.all(payloads.map(p => addExpense(p)));
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const currentStep = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const isFirst = step === 0;

    // ── Step: campos normais ──────────────────────────────────────────────────

    const renderFields = (fields: WizardField[]) => (
        <div className="space-y-1">
            {fields.map(f => {
                const key = f.parentCatName ? `${f.parentCatName}:${f.catName}` : f.catName;
                return (
                    <SuggestInput
                        key={key}
                        label={f.label}
                        value={values[key] ?? ''}
                        onChange={v => setField(key, v)}
                        suggestion={getSuggestion(f.catName, f.parentCatName)}
                    />
                );
            })}
        </div>
    );

    const renderDynamicFields = (fields: WizardField[], stepTitle: string) => (
        <div className="space-y-1">
            {fields.map(f => {
                const key = f.parentCatName ? `${f.parentCatName}:${f.catName}` : f.catName;
                return (
                    <SuggestInput
                        key={key}
                        label={f.label}
                        value={values[key] || ''}
                        onChange={v => setField(key, v)}
                        suggestion={getSuggestion(f.catName, f.parentCatName)}
                    />
                );
            })}

            {/* Itens extras */}
            <div className="mt-4 space-y-2">
                {(dynamicItems[stepTitle] || []).map(it => (
                    <div key={it.id} className="flex gap-2 items-center">
                        <input
                            type="text"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Outra despesa..."
                            value={it.description}
                            onChange={e => updateDynamicItem(stepTitle, it.id, { description: e.target.value })}
                        />
                        <input
                            type="text"
                            inputMode="decimal"
                            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="0,00"
                            value={it.amount}
                            onChange={e => updateDynamicItem(stepTitle, it.id, { amount: e.target.value })}
                        />
                        <button
                            onClick={() => removeDynamicItem(stepTitle, it.id)}
                            className="text-gray-300 hover:text-red-500"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => addDynamicItem(stepTitle)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                    <Plus size={12} /> Adicionar outro campo
                </button>
            </div>
        </div>
    );

    // ── Step: Resumo ──────────────────────────────────────────────────────────

    const renderResumo = () => {
        const payloads = buildPayloads();

        if (payloads.length === 0) {
            return (
                <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum valor informado. Avance para encerrar sem lançamentos.
                </p>
            );
        }

        return (
            <div className="space-y-1 max-h-80 overflow-y-auto">
                {payloads.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 text-sm">
                        <span className="text-gray-700 truncate max-w-[65%]">
                            {p.description !== p.category_name
                                ? <><span className="text-gray-400">{p.category_name} / </span>{p.description}</>
                                : p.description}
                        </span>
                        <span className="font-medium tabular-nums">{fmt(p.amount)}</span>
                    </div>
                ))}
                <div className="flex justify-between items-center pt-2 font-semibold text-sm">
                    <span>Total</span>
                    <span>{fmt(payloads.reduce((s, p) => s + p.amount, 0))}</span>
                </div>
            </div>
        );
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
                            Fechamento Mensal · {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][month - 1]} de {year}
                        </p>
                        <h3 className="text-base font-semibold text-gray-900">{currentStep.title} (Step {step + 1}/{STEPS.length})</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-gray-100">
                    <div
                        className="h-1 bg-primary transition-all duration-300"
                        style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {currentStep.fields && !currentStep.isDynamic && renderFields(currentStep.fields)}
                    {currentStep.fields && currentStep.isDynamic && renderDynamicFields(currentStep.fields, currentStep.title)}

                    {/* Botão de Sync em 'Despesas com Vendas' */}
                    {currentStep.title === 'Despesas com Vendas' && (
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-100">
                            <button
                                onClick={handleSyncGateways}
                                disabled={syncing}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                                {syncing ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-indigo-700/30 border-t-indigo-700 rounded-full animate-spin" />
                                        Sincronizando APIs...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={14} className="rotate-45" />
                                        Sincronizar Mercado Pago & Stripe
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-gray-400 text-center mt-2">
                                Busca automática de taxas e vendas registradas nos dashboards.
                            </p>
                        </div>
                    )}

                    {isLast && renderResumo()}

                    {/* Aviso de substituição */}
                    {isLast && hasExisting && (
                        <div className={`mt-4 rounded-lg p-3 text-sm ${confirmReplace ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                            {confirmReplace
                                ? 'Clique em "Confirmar Fechamento" para apagar os lançamentos existentes e salvar os novos.'
                                : `Já existem ${currentExpenses.length} lançamentos para este mês. Confirmar irá substituí-los.`}
                        </div>
                    )}

                    {/* Dica Tab */}
                    {!isLast && (
                        <p className="text-xs text-gray-400 mt-4">
                            Deixe em branco para pular. Pressione <kbd className="bg-gray-100 px-1 rounded text-xs">Tab</kbd> num campo vazio para usar o valor do mês anterior.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
                    <button
                        onClick={() => setStep(s => s - 1)}
                        disabled={isFirst}
                        className="flex items-center gap-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    >
                        <ChevronLeft size={15} /> Voltar
                    </button>

                    {!isLast && (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            className="flex-1 flex items-center justify-center gap-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90"
                        >
                            Próximo <ChevronRight size={15} />
                        </button>
                    )}

                    {isLast && (
                        <button
                            onClick={handleConfirm}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : (
                                <><Check size={15} /> Confirmar Fechamento</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
