import api from '../../services/api';

export interface CanalDRE {
    nome: string;
    receita_bruta: number;
    qtd_pedidos: number;
    ticket_medio: number;
    qtd_itens: number;
    cmv_total: number;
}

export interface ExpenseItem {
    id: string;
    description: string;
    amount: number;
    record_date: string;
    category_id: string;
    category_name: string;
    category_type: string;
    parent_category_name: string;
}

export interface SummaryDRE {
    receita_bruta_total: number;
    deducoes: { total: number; promocoes: number; das: number; devolucoes: number };
    receita_liquida: number;
    cmv_total: number;
    cmv_percentual: number;
    resultado_bruto: number;
    margem_bruta: number;
    total_despesas: number;
    ebitda: number;
    depreciacao: number;
    resultado_liquido: number;
    margem_liquida: number;
}

export interface DREData {
    year: number;
    month: number;
    canais: CanalDRE[];
    expenses: ExpenseItem[];
    depreciacao: number;
    summary: SummaryDRE;
}

export interface FlaggedOrder {
    order_id: number;
    order_number: number;
    order_date: string;
    order_total: number;
    store_number: string;
    customer_name: string;
}

export interface AddExpensePayload {
    description: string;
    amount: number;
    category_name: string;
    parent_category_name?: string;
    record_date: string;
}

export const getDRE = async (year: number, month: number): Promise<DREData> => {
    const res = await api.get('/api/financeiro/dre', { params: { year, month } });
    return res.data;
};

export const addExpense = async (payload: AddExpensePayload): Promise<ExpenseItem> => {
    const res = await api.post('/api/financeiro/expenses', payload);
    return res.data;
};

export const deleteExpense = async (id: string): Promise<void> => {
    await api.delete(`/api/financeiro/expenses/${id}`);
};

export const getInadimplencia = async (): Promise<{ flagged_orders: FlaggedOrder[]; total: number }> => {
    const res = await api.get('/api/financeiro/inadimplencia');
    return res.data;
};

export const confirmInadimplencia = async (
    orderId: number,
    month: string
): Promise<void> => {
    await api.post(`/api/financeiro/inadimplencia/${orderId}/confirmar`, { month });
};

export interface GatewayRecord {
    date: string;
    gateway: string;
    gross_amount: number;
    fee_amount: number;
    net_amount: number;
    transaction_count: number;
}

export const getGatewayHistory = async (year: number, month: number): Promise<GatewayRecord[]> => {
    const res = await api.get('/api/financeiro/gateways/history', { params: { year, month } });
    return res.data;
};

export const syncGatewayData = async (date?: string): Promise<{ success: boolean; date: string; results: GatewayRecord[] }> => {
    const res = await api.post('/api/financeiro/gateways/sync', null, { params: { date } });
    return res.data;
};

export const syncGatewayMonth = async (year: number, month: number): Promise<{ success: boolean; year: number; month: number; days_synced: number; errors: { gateway: string; date: string; error: string }[] }> => {
    const res = await api.post('/api/financeiro/gateways/sync-month', null, { params: { year, month } });
    return res.data;
};
