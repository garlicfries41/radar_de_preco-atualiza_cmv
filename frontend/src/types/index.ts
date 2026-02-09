
export interface Ingredient {
    id: string;
    name: string;
    category: string;
    current_price: number;
    unit: string;
}

export interface Suggestion {
    id: string;
    name: string;
    category: string;
}

export interface ScannedItem {
    id: string;
    raw_name: string;
    parsed_price: number;
    quantity: number;
    matched_ingredient_id: string | null;
    matched_ingredient_name?: string;
    suggested_ingredient?: Suggestion | null;
    category?: string;
}

export interface Receipt {
    receipt_id: string;
    market_name: string;
    total_amount: number;
    items: ScannedItem[];
}

export interface ValidationPayload {
    receipt_id: string;
    items: Array<{
        receipt_item_id: string;
        ingredient_id: string;
        price: number;
    }>;
}


export interface RecipeIngredient {
    ingredient_name: string;
    quantity: number;
    cost: number;
    unit: string;
}

export interface Recipe {
    id: string;
    name: string;
    total_cost: number;
    yield_units: number;
    cost_per_unit: number;
    ingredients: RecipeIngredient[];
}

export type UploadResponse = Receipt;
