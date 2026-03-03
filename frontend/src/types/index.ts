
export interface Ingredient {
    id: string;
    name: string;
    category: string;
    current_price: number;
    yield_coefficient: number;
    unit: string;
}

export interface RecipeCategory {
    id: string;
    name: string;
    anvisa_portion_g: number;
    default_net_weight?: number;
    created_at: string;
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
    ingredient_id: string;
    quantity: number;
    // Joined fields from backend
    ingredients?: {
        name: string;
        unit: string;
        current_price: number;
        yield_coefficient: number;
        category: string;
        nutritional_ref_id?: string | null;
    };
}

export interface Recipe {
    id: string;
    product_id?: number;
    category_id?: number;
    name: string;
    yield_units: number;
    labor_minutes: number;
    labor_cost: number;
    ingredients_cost: number;
    packaging_cost: number;
    sku?: string;
    current_cost: number;
    total_weight_kg: number;
    cmv_per_unit: number;
    cmv_per_kg: number;
    is_pre_preparo?: boolean;
    derived_ingredient_id?: string;
    production_unit: string;
    net_weight?: number;
    created_at: string;
    last_calculated: string;
    ingredients?: RecipeIngredient[];
}

export interface RecipeInput {
    product_id?: number;
    category_id?: number;
    name: string;
    yield_units: number;
    labor_minutes: number;
    labor_cost: number;
    sku?: string;
    is_pre_preparo?: boolean;
    production_unit?: string;
    net_weight?: number;
    update_category_default?: boolean;
    cascade_update?: boolean;
    ingredients: {
        ingredient_id: string;
        quantity: number;
    }[];
}

export type UploadResponse = Receipt;

