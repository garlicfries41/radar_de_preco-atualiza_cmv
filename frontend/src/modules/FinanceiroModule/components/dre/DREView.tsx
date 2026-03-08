import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, AlertTriangle, X, ClipboardList } from 'lucide-react';
import { FechamentoWizard } from './FechamentoWizard';
import {
    getDRE, addExpense, deleteExpense, getInadimplencia, confirmInadimplencia,
    type DREData, type ExpenseItem, type FlaggedOrder
} from '../../api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CHANNELS = ['Site', 'Atendimento por chat', 'Feira', 'Revenda', 'Catering/Restaurante'];

const fmt = (v: number | null | undefined) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number | null | undefined) =>
    `${(v ?? 0).toFixed(2).replace('.', ',')}%`;

const prevMonth = (y: number, m: number): [number, number] =>
    m === 1 ? [y - 1, 12] : [y, m - 1];

const nextMonth = (y: number, m: number): [number, number] =>
    m === 12 ? [y + 1, 1] : [y, m + 1];

const sumByCategory = (expenses: ExpenseItem[], catName: string) =>
    expenses.filter(e => e.category_name === catName).reduce((s, e) => s + e.amount, 0);

const sumByParent = (expenses: ExpenseItem[], parentName: string) =>
    expenses.filter(e => e.parent_category_name === parentName).reduce((s, e) => s + e.amount, 0);

const itemsByCategory = (expenses: ExpenseItem[], catName: string) =>
    expenses.filter(e => e.category_name === catName);

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddModalState {
    open: boolean;
    categoryName: string;
    withDescription: boolean;
    year: number;
    month: number;
}

interface PeriodData {
    data: DREData | null;
    loading: boolean;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AddExpenseModal({
    state,
    onClose,
    onSaved,
}: {
    state: AddModalState;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (state.open) { setDescription(''); setAmount(''); }
    }, [state.open]);

    const handleSave = async () => {
        const val = parseFloat(amount.replace(',', '.'));
        if (isNaN(val) || val <= 0) return;
        setSaving(true);
        try {
            await addExpense({
                description: state.withDescription ? description : state.categoryName,
                amount: val,
                category_name: state.categoryName,
                record_date: `${state.year}-${String(state.month).padStart(2, '0')}-01`,
            });
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!state.open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900 text-base">
                        Lançar: {state.categoryName}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>

                {state.withDescription && (
                    <div className="mb-3">
                        <label className="text-xs text-gray-500 font-medium block mb-1">Descrição</label>
                        <input
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Ex: Shopify, Vercel, Hostinger..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                )}

                <div className="mb-4">
                    <label className="text-xs text-gray-500 font-medium block mb-1">Valor (R$)</label>
                    <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0,00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        type="text"
                        inputMode="decimal"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function InadimplenciaModal({
    orders,
    currentYear,
    currentMonth,
    onClose,
    onConfirmed,
}: {
    orders: FlaggedOrder[];
    currentYear: number;
    currentMonth: number;
    onClose: () => void;
    onConfirmed: () => void;
}) {
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);

    const toggle = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleConfirm = async () => {
        if (selected.size === 0) return;
        setSaving(true);
        try {
            const month = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            await Promise.all([...selected].map(id => confirmInadimplencia(id, month)));
            onConfirmed();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-gray-900">Pedidos em aberto há mais de 60 dias</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Selecione os pedidos que devem ser registrados como inadimplência no mês atual.
                        </p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg mb-4">
                    {orders.map(o => (
                        <label
                            key={o.order_id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                className="accent-primary"
                                checked={selected.has(o.order_id)}
                                onChange={() => toggle(o.order_id)}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800">
                                    #{o.order_number} — {o.customer_name || 'Cliente desconhecido'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {new Date(o.order_date).toLocaleDateString('pt-BR')} · {fmt(o.order_total)}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        Ignorar por agora
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selected.size === 0 || saving}
                        className="flex-1 bg-amber-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-40"
                    >
                        {saving ? 'Registrando...' : `Registrar ${selected.size > 0 ? `(${selected.size})` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Grid Cell Styles ────────────────────────────────────────────────────────

const VAL_CLASSES = 'px-4 py-1.5 text-right tabular-nums';

function ValCell({ value, pct, negative }: { value: number; pct?: boolean; negative?: boolean }) {
    const isNeg = negative || value < 0;
    return (
        <td className={`${VAL_CLASSES} ${isNeg ? 'text-red-600' : 'text-gray-900'}`}>
            {pct ? fmtPct(value) : fmt(value)}
        </td>
    );
}

function EmptyCell() {
    return <td className={`${VAL_CLASSES} text-gray-400`}>—</td>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DREView() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    const [cur, setCur] = useState<PeriodData>({ data: null, loading: false });
    const [prev, setPrev] = useState<PeriodData>({ data: null, loading: false });
    const [flagged, setFlagged] = useState<FlaggedOrder[]>([]);
    const [showInadModal, setShowInadModal] = useState(false);

    const [addModal, setAddModal] = useState<AddModalState>({
        open: false, categoryName: '', withDescription: false, year, month,
    });
    const [showWizard, setShowWizard] = useState(false);

    const [py, pm] = prevMonth(year, month);

    const fetchAll = useCallback(async () => {
        setCur(s => ({ ...s, loading: true }));
        setPrev(s => ({ ...s, loading: true }));
        try {
            const [curData, prevData, inadData] = await Promise.all([
                getDRE(year, month),
                getDRE(py, pm),
                getInadimplencia(),
            ]);
            setCur({ data: curData, loading: false });
            setPrev({ data: prevData, loading: false });
            if (inadData.flagged_orders?.length > 0) {
                setFlagged(inadData.flagged_orders);
                setShowInadModal(true);
            }
        } catch {
            setCur(s => ({ ...s, loading: false }));
            setPrev(s => ({ ...s, loading: false }));
        }
    }, [year, month, py, pm]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const navigate = (dir: 'prev' | 'next') => {
        const [ny, nm] = dir === 'prev' ? prevMonth(year, month) : nextMonth(year, month);
        setYear(ny); setMonth(nm);
    };

    const openAdd = (categoryName: string, withDescription = false) => {
        setAddModal({ open: true, categoryName, withDescription, year, month });
    };

    const canEdit = (expenses: ExpenseItem[], catName: string) =>
        itemsByCategory(expenses, catName);

    // ─── Row renderers ────────────────────────────────────────────────────────

    const cd = cur.data;
    const pd = prev.data;

    const getChannel = (d: DREData | null, nome: string) =>
        d?.canais.find(c => c.nome === nome);

    // Helper: render an editable single-value expense row
    const EditableRow = ({
        label,
        catName,
        indent = 1,
        overrideValueCur,
        overrideValuePrev,
    }: {
        label: string;
        catName: string;
        indent?: number;
        overrideValueCur?: number;
        overrideValuePrev?: number;
    }) => {
        const curVal = overrideValueCur !== undefined ? overrideValueCur : sumByCategory(cd?.expenses ?? [], catName);
        const prevVal = overrideValuePrev !== undefined ? overrideValuePrev : sumByCategory(pd?.expenses ?? [], catName);
        const curItems = canEdit(cd?.expenses ?? [], catName);

        return (
            <tr className="border-b border-gray-100 hover:bg-gray-50 group">
                <td className="px-4 py-1.5 text-sm text-gray-700" style={{ paddingLeft: `${indent * 20 + 16}px` }}>
                    <span>{label}</span>
                    <button
                        onClick={() => openAdd(catName)}
                        className="ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                        title={`Lançar ${label}`}
                    >
                        <Plus size={13} />
                    </button>
                    {curItems.map(item => (
                        <span key={item.id} className="ml-1 inline-flex items-center gap-1">
                            <button
                                onClick={() => deleteExpense(item.id).then(fetchAll)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                                title="Remover"
                            >
                                <Trash2 size={11} />
                            </button>
                        </span>
                    ))}
                </td>
                {prevVal ? <ValCell value={prevVal} /> : <EmptyCell />}
                {curVal ? <ValCell value={curVal} /> : <EmptyCell />}
            </tr>
        );
    };

    // Helper: render a dynamic (Infra Web) section row
    const InfraWebRow = () => {
        const catName = 'Infra Web';
        const curItems = itemsByCategory(cd?.expenses ?? [], catName);
        const prevItems = itemsByCategory(pd?.expenses ?? [], catName);
        const curTotal = curItems.reduce((s, e) => s + e.amount, 0);
        const prevTotal = prevItems.reduce((s, e) => s + e.amount, 0);

        return (
            <>
                {/* Section header */}
                <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-1.5 text-sm font-medium text-gray-700 pl-12">
                        <span>Infra Web</span>
                        <button
                            onClick={() => openAdd(catName, true)}
                            className="ml-2 text-gray-400 hover:text-primary"
                            title="Adicionar item Infra Web"
                        >
                            <Plus size={13} />
                        </button>
                    </td>
                    {prevTotal ? <ValCell value={prevTotal} /> : <EmptyCell />}
                    {curTotal ? <ValCell value={curTotal} /> : <EmptyCell />}
                </tr>
                {/* Dynamic items (current month) */}
                {curItems.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 group bg-white">
                        <td className="px-4 py-1 text-xs text-gray-500 pl-16">
                            {item.description}
                            <button
                                onClick={() => deleteExpense(item.id).then(fetchAll)}
                                className="ml-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                            >
                                <Trash2 size={10} />
                            </button>
                        </td>
                        <EmptyCell />
                        <ValCell value={item.amount} />
                    </tr>
                ))}
            </>
        );
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const isLoading = cur.loading || prev.loading;

    return (
        <div className="pb-12">
            {/* Modals */}
            {showWizard && (
                <FechamentoWizard
                    year={year}
                    month={month}
                    prevData={prev.data}
                    currentExpenses={cd?.expenses ?? []}
                    onClose={() => setShowWizard(false)}
                    onSaved={fetchAll}
                />
            )}
            <AddExpenseModal
                state={addModal}
                onClose={() => setAddModal(s => ({ ...s, open: false }))}
                onSaved={fetchAll}
            />
            {showInadModal && (
                <InadimplenciaModal
                    orders={flagged}
                    currentYear={year}
                    currentMonth={month}
                    onClose={() => setShowInadModal(false)}
                    onConfirmed={fetchAll}
                />
            )}

            {/* Month Navigator */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                    Demonstração de Resultado (DRE)
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowWizard(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
                        title="Iniciar Fechamento Mensal"
                    >
                        <ClipboardList size={15} />
                        Fechamento
                    </button>
                    <button
                        onClick={() => navigate('prev')}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
                        {MONTHS_PT[pm - 1]} / {py} · {MONTHS_PT[month - 1]} / {year}
                    </span>
                    <button
                        onClick={() => navigate('next')}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {isLoading && (
                <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
            )}

            {!isLoading && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                    <table className="w-full border-collapse text-sm min-w-[600px]">
                        {/* Header */}
                        <thead>
                            <tr className="bg-gray-700 text-white text-xs font-semibold uppercase tracking-wide">
                                <th className="px-4 py-3 text-left w-[55%]">Categoria</th>
                                <th className="px-4 py-3 text-right">{MONTHS_PT[pm - 1]}/{py}</th>
                                <th className="px-4 py-3 text-right">{MONTHS_PT[month - 1]}/{year}</th>
                            </tr>
                        </thead>

                        <tbody>
                            {/* ── RECEITA BRUTA TOTAL ── */}
                            <tr className="bg-[#FFC000] border-b border-yellow-300">
                                <td className="px-4 py-2 font-bold text-gray-900 text-sm">RECEITA BRUTA TOTAL</td>
                                <ValCell value={pd?.summary.receita_bruta_total ?? 0} />
                                <ValCell value={cd?.summary.receita_bruta_total ?? 0} />
                            </tr>

                            {CHANNELS.map(canal => {
                                const c = getChannel(cd, canal);
                                const p = getChannel(pd, canal);
                                return (
                                    <React.Fragment key={canal}>
                                        <tr className="border-b border-gray-100 bg-white">
                                            <td className="px-4 py-1.5 font-medium text-gray-800 pl-8">{canal}</td>
                                            {p ? <ValCell value={p.receita_bruta} /> : <EmptyCell />}
                                            {c ? <ValCell value={c.receita_bruta} /> : <EmptyCell />}
                                        </tr>
                                        <tr className="border-b border-gray-50 bg-gray-50/60">
                                            <td className="px-4 py-1 text-xs text-gray-500 pl-14">QTD PEDIDOS</td>
                                            <td className="px-4 py-1 text-right text-xs text-gray-600 tabular-nums">{p?.qtd_pedidos ?? '—'}</td>
                                            <td className="px-4 py-1 text-right text-xs text-gray-600 tabular-nums">{c?.qtd_pedidos ?? '—'}</td>
                                        </tr>
                                        <tr className="border-b border-gray-50 bg-gray-50/60">
                                            <td className="px-4 py-1 text-xs text-gray-500 pl-14">TICKET MÉDIO</td>
                                            <td className="px-4 py-1 text-right text-xs text-gray-600 tabular-nums">{p ? fmt(p.ticket_medio) : '—'}</td>
                                            <td className="px-4 py-1 text-right text-xs text-gray-600 tabular-nums">{c ? fmt(c.ticket_medio) : '—'}</td>
                                        </tr>
                                        <tr className="border-b border-gray-100 bg-gray-50/60">
                                            <td className="px-4 py-1 text-xs text-gray-500 pl-14">QUANTIDADE DE PRODUTOS</td>
                                            <td className="px-4 py-1 text-right text-xs text-gray-600 tabular-nums">{p?.qtd_itens ?? '—'}</td>
                                            <td className="px-4 py-1 text-right text-xs text-gray-600 tabular-nums">{c?.qtd_itens ?? '—'}</td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}

                            {/* ── DEDUÇÕES ── */}
                            <tr className="bg-gray-200 border-b border-gray-300">
                                <td className="px-4 py-2 font-bold text-gray-700 text-xs uppercase tracking-wide">DEDUÇÕES</td>
                                <ValCell value={pd?.summary.deducoes.total ?? 0} />
                                <ValCell value={cd?.summary.deducoes.total ?? 0} />
                            </tr>
                            <EditableRow
                                label="PROMOÇÕES"
                                catName="Promoções"
                                overrideValueCur={cd?.summary.deducoes.promocoes}
                                overrideValuePrev={pd?.summary.deducoes.promocoes}
                            />
                            <EditableRow
                                label="DAS (Impostos)"
                                catName="DAS (Simples Nacional)"
                                overrideValueCur={cd?.summary.deducoes.das}
                                overrideValuePrev={pd?.summary.deducoes.das}
                            />
                            <EditableRow
                                label="DEVOLUÇÕES"
                                catName="Devoluções"
                                overrideValueCur={cd?.summary.deducoes.devolucoes}
                                overrideValuePrev={pd?.summary.deducoes.devolucoes}
                            />

                            {/* ── RECEITA OPERACIONAL LÍQUIDA ── */}
                            <tr className="h-2 bg-gray-50"><td colSpan={3} /></tr>
                            <tr className="bg-[#FFE699] border-b border-yellow-200">
                                <td className="px-4 py-2 font-bold text-gray-900">RECEITA OPERACIONAL LÍQUIDA</td>
                                <ValCell value={pd?.summary.receita_liquida ?? 0} />
                                <ValCell value={cd?.summary.receita_liquida ?? 0} />
                            </tr>
                            <tr className="h-2 bg-gray-50"><td colSpan={3} /></tr>

                            {/* ── CMV ── */}
                            <tr className="border-b border-gray-100">
                                <td className="px-4 py-1.5 text-gray-700">CMV (custo das mercadorias vendidas)</td>
                                <ValCell value={pd?.summary.cmv_total ?? 0} />
                                <ValCell value={cd?.summary.cmv_total ?? 0} />
                            </tr>
                            <tr className="border-b border-gray-100 bg-gray-50/60">
                                <td className="px-4 py-1 text-xs text-gray-500 pl-8 italic">%</td>
                                <td className="px-4 py-1 text-right text-xs text-gray-500 italic tabular-nums">{fmtPct(pd?.summary.cmv_percentual ?? 0)}</td>
                                <td className="px-4 py-1 text-right text-xs text-gray-500 italic tabular-nums">{fmtPct(cd?.summary.cmv_percentual ?? 0)}</td>
                            </tr>
                            <tr className="h-2 bg-gray-50"><td colSpan={3} /></tr>

                            {/* ── RESULTADO OPERACIONAL BRUTO ── */}
                            <tr className="bg-[#FFE699] border-b border-yellow-200">
                                <td className="px-4 py-2 font-bold text-gray-900">RESULTADO OPERACIONAL BRUTO</td>
                                <ValCell value={pd?.summary.resultado_bruto ?? 0} />
                                <ValCell value={cd?.summary.resultado_bruto ?? 0} />
                            </tr>
                            <tr className="border-b border-gray-100 bg-gray-50/60">
                                <td className="px-4 py-1 text-xs text-gray-500 pl-8 italic">MARGEM BRUTA</td>
                                <td className="px-4 py-1 text-right text-xs text-gray-500 italic tabular-nums">{fmtPct(pd?.summary.margem_bruta ?? 0)}</td>
                                <td className="px-4 py-1 text-right text-xs text-gray-500 italic tabular-nums">{fmtPct(cd?.summary.margem_bruta ?? 0)}</td>
                            </tr>
                            <tr className="h-2 bg-gray-50"><td colSpan={3} /></tr>

                            {/* ── DESPESAS ── */}
                            <tr className="bg-gray-200 border-b border-gray-300">
                                <td className="px-4 py-2 font-bold text-gray-700 text-xs uppercase tracking-wide">DESPESAS</td>
                                <ValCell value={pd?.summary.total_despesas ?? 0} />
                                <ValCell value={cd?.summary.total_despesas ?? 0} />
                            </tr>

                            {/* Funcionários */}
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <td className="px-4 py-1.5 font-semibold text-gray-700 pl-8">FUNCIONÁRIOS</td>
                                <ValCell value={sumByParent(pd?.expenses ?? [], 'Funcionários')} />
                                <ValCell value={sumByParent(cd?.expenses ?? [], 'Funcionários')} />
                            </tr>
                            <EditableRow label="Pró-labore" catName="Pró-labore" indent={2} />
                            <EditableRow label="Empregados" catName="Empregados" indent={2} />

                            {/* Despesas com Vendas */}
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <td className="px-4 py-1.5 font-semibold text-gray-700 pl-8">DESPESAS COM VENDAS</td>
                                <ValCell value={sumByParent(pd?.expenses ?? [], 'Despesas com Vendas')} />
                                <ValCell value={sumByParent(cd?.expenses ?? [], 'Despesas com Vendas')} />
                            </tr>
                            <EditableRow label="Taxa Mercado Pago" catName="Taxa Mercado Pago" indent={2} />
                            <EditableRow label="Comissão Feiras" catName="Comissão Feiras" indent={2} />
                            <EditableRow label="Aluguel Feira" catName="Aluguel Feira" indent={2} />

                            {/* Despesas Fixas */}
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <td className="px-4 py-1.5 font-semibold text-gray-700 pl-8">DESPESAS FIXAS</td>
                                <ValCell value={sumByParent(pd?.expenses ?? [], 'Despesas Fixas')} />
                                <ValCell value={sumByParent(cd?.expenses ?? [], 'Despesas Fixas')} />
                            </tr>
                            <EditableRow label="Condomínio (taxas e manutenção)" catName="Condomínio (taxas e manutenção)" indent={2} />
                            <EditableRow label="Internet e Telefone" catName="Internet e Telefone" indent={2} />
                            <EditableRow label="Gás" catName="Gás" indent={2} />

                            {/* Outras Despesas */}
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <td className="px-4 py-1.5 font-semibold text-gray-700 pl-8">OUTRAS DESPESAS</td>
                                <ValCell value={sumByParent(pd?.expenses ?? [], 'Outras Despesas')} />
                                <ValCell value={sumByParent(cd?.expenses ?? [], 'Outras Despesas')} />
                            </tr>
                            <EditableRow label="Contabilidade" catName="Contabilidade" indent={2} />
                            <InfraWebRow />

                            {/* Entregas por canal */}
                            {[
                                { label: 'Entregas - Feira', items: ['Uber Direct (Feira)', '99 Empresas (Feira)', 'Lalamove (Feira)'] },
                                { label: 'Entregas - Site', items: ['Uber Direct (Site)', '99 Empresas (Site)', 'Lalamove (Site)'] },
                                { label: 'Entregas - Catering/Restaurante', items: ['Uber Direct (Catering)', '99 Empresas (Catering)', 'Lalamove (Catering)'] },
                            ].map(({ label, items }) => (
                                <React.Fragment key={label}>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <td className="px-4 py-1.5 text-sm font-medium text-gray-600 pl-12">{label}</td>
                                        <ValCell value={items.reduce((s, n) => s + sumByCategory(pd?.expenses ?? [], n), 0)} />
                                        <ValCell value={items.reduce((s, n) => s + sumByCategory(cd?.expenses ?? [], n), 0)} />
                                    </tr>
                                    {items.map(cat => (
                                        <EditableRow key={cat} label={cat.replace(/ \(.*\)/, '')} catName={cat} indent={3} />
                                    ))}
                                </React.Fragment>
                            ))}

                            <EditableRow label="Diarista" catName="Diarista" indent={2} />
                            <EditableRow label="Material de Limpeza" catName="Material de Limpeza" indent={2} />
                            <EditableRow label="Inadimplência" catName="Inadimplência" indent={2} />

                            {/* ── PÓS-EBITDA ── */}
                            <tr className="h-2 bg-gray-50"><td colSpan={3} /></tr>
                            <tr className="border-b border-gray-100">
                                <td className="px-4 py-1.5 text-gray-700">Depreciação de maquinário</td>
                                <ValCell value={pd?.depreciacao ?? 0} />
                                <ValCell value={cd?.depreciacao ?? 0} />
                            </tr>
                            <EditableRow label="Juros de empréstimos" catName="Juros de Empréstimos" indent={0} />
                            <EditableRow label="Impostos sobre lucro" catName="Impostos sobre Lucro" indent={0} />
                            <tr className="h-2 bg-gray-50"><td colSpan={3} /></tr>

                            {/* ── RESULTADO LÍQUIDO ── */}
                            <tr className="bg-[#FFC000] border-b border-yellow-300">
                                <td className="px-4 py-2 font-bold text-gray-900">RESULTADO LÍQUIDO</td>
                                <td className={`px-4 py-2 text-right font-bold tabular-nums ${(pd?.summary.resultado_liquido ?? 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                    {fmt(pd?.summary.resultado_liquido ?? 0)}
                                </td>
                                <td className={`px-4 py-2 text-right font-bold tabular-nums ${(cd?.summary.resultado_liquido ?? 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                    {fmt(cd?.summary.resultado_liquido ?? 0)}
                                </td>
                            </tr>
                            <tr className="border-b border-gray-100 bg-gray-50/60">
                                <td className="px-4 py-1 text-xs text-gray-500 pl-8 italic">MARGEM LÍQUIDA</td>
                                <td className={`px-4 py-1 text-right text-xs italic tabular-nums ${(pd?.summary.margem_liquida ?? 0) < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {fmtPct(pd?.summary.margem_liquida ?? 0)}
                                </td>
                                <td className={`px-4 py-1 text-right text-xs italic tabular-nums ${(cd?.summary.margem_liquida ?? 0) < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {fmtPct(cd?.summary.margem_liquida ?? 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
