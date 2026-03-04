import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

sql = """
CREATE OR REPLACE FUNCTION public.recalculate_recipe_nutrition(p_recipe_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_recipe_g NUMERIC;
    
    v_energy_kcal NUMERIC := 0;
    v_energy_kj NUMERIC := 0;
    v_protein NUMERIC := 0;
    v_carbs NUMERIC := 0;
    v_lipid NUMERIC := 0;
    v_saturated_fat NUMERIC := 0;
    v_trans_fat NUMERIC := 0;
    v_fiber NUMERIC := 0;
    v_sodium NUMERIC := 0;
    v_sugars_total NUMERIC := 0;
    v_sugars_added NUMERIC := 0;

    v_portion_g NUMERIC := NULL;
    v_household_measure TEXT := NULL;
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            ri.quantity, i.unit,
            nr.energy_kcal, nr.energy_kj, nr.protein_g, nr.carbs_g,
            nr.lipid_g, nr.saturated_fat_g, nr.trans_fat_g, nr.fiber_g, nr.sodium_mg,
            nr.sugars_total_g, nr.sugars_added_g,
            nr.base_qty_g
        FROM public.recipe_ingredients ri
        JOIN public.ingredients i ON i.id = ri.ingredient_id
        JOIN public.nutritional_ref nr ON nr.id = i.nutritional_ref_id
        WHERE ri.recipe_id = p_recipe_id
    LOOP
        DECLARE
            qty_g NUMERIC;
        BEGIN
            IF upper(r.unit) IN ('KG', 'L') THEN
                qty_g := r.quantity * 1000;
            ELSIF upper(r.unit) IN ('G', 'ML') THEN
                qty_g := r.quantity;
            ELSE 
                qty_g := r.quantity * 100; 
            END IF;

            -- Convert using base_qty_g from reference
            DECLARE
                ratio NUMERIC := qty_g / NULLIF(r.base_qty_g, 0);
            BEGIN
                IF ratio IS NOT NULL THEN
                    v_energy_kcal := v_energy_kcal + COALESCE(r.energy_kcal * ratio, 0);
                    v_energy_kj := v_energy_kj + COALESCE(r.energy_kj * ratio, 0);
                    v_protein := v_protein + COALESCE(r.protein_g * ratio, 0);
                    v_carbs := v_carbs + COALESCE(r.carbs_g * ratio, 0);
                    v_lipid := v_lipid + COALESCE(r.lipid_g * ratio, 0);
                    v_saturated_fat := v_saturated_fat + COALESCE(r.saturated_fat_g * ratio, 0);
                    v_trans_fat := v_trans_fat + COALESCE(r.trans_fat_g * ratio, 0);
                    v_fiber := v_fiber + COALESCE(r.fiber_g * ratio, 0);
                    v_sodium := v_sodium + COALESCE(r.sodium_mg * ratio, 0);
                    v_sugars_total := v_sugars_total + COALESCE(r.sugars_total_g * ratio, 0);
                    v_sugars_added := v_sugars_added + COALESCE(r.sugars_added_g * ratio, 0);
                END IF;
            END;
        END;
    END LOOP;

    -- Use FINISHED PRODUCT weight (yield), NOT input ingredients weight
    -- Priority: yield_units * net_weight (UN) or yield_units (KG), fallback to total_weight_kg
    SELECT 
        CASE 
            WHEN UPPER(COALESCE(production_unit, 'KG')) = 'KG' AND COALESCE(yield_units, 0) > 0 
                THEN yield_units * 1000
            WHEN COALESCE(yield_units, 0) > 0 AND COALESCE(net_weight, 0) > 0 
                THEN yield_units * net_weight * 1000
            ELSE COALESCE(total_weight_kg * 1000, 1000)
        END
    INTO v_total_recipe_g
    FROM public.recipes WHERE id = p_recipe_id;

    IF v_total_recipe_g <= 0 THEN v_total_recipe_g := 1000; END IF;

    SELECT rc.anvisa_portion_g, '1 Porção' 
    INTO v_portion_g, v_household_measure
    FROM public.recipes rec
    LEFT JOIN public.recipe_categories rc ON rc.id = rec.category_id
    WHERE rec.id = p_recipe_id LIMIT 1;

    DECLARE
        f_100g NUMERIC := 100.0 / v_total_recipe_g;
        f_portion NUMERIC := COALESCE(v_portion_g, 100.0) / v_total_recipe_g;
    BEGIN
        INSERT INTO public.recipe_nutrition (
            recipe_id,
            energy_kcal_100g, energy_kj_100g, protein_g_100g, carbs_g_100g,
            lipid_g_100g, saturated_fat_g_100g, trans_fat_g_100g, fiber_g_100g, sodium_mg_100g,
            sugars_total_g_100g, sugars_added_g_100g,
            portion_g, household_measure,
            energy_kcal_portion, energy_kj_portion, protein_g_portion, carbs_g_portion,
            lipid_g_portion, saturated_fat_g_portion, trans_fat_g_portion, fiber_g_portion, sodium_mg_portion,
            sugars_total_g_portion, sugars_added_g_portion,
            calculated_at
        ) VALUES (
            p_recipe_id,
            v_energy_kcal * f_100g, v_energy_kj * f_100g, v_protein * f_100g, v_carbs * f_100g,
            v_lipid * f_100g, v_saturated_fat * f_100g, v_trans_fat * f_100g, v_fiber * f_100g, v_sodium * f_100g,
            v_sugars_total * f_100g, v_sugars_added * f_100g,
            COALESCE(v_portion_g, 100), COALESCE(v_household_measure, '100g'),
            v_energy_kcal * f_portion, v_energy_kj * f_portion, v_protein * f_portion, v_carbs * f_portion,
            v_lipid * f_portion, v_saturated_fat * f_portion, v_trans_fat * f_portion, v_fiber * f_portion, v_sodium * f_portion,
            v_sugars_total * f_portion, v_sugars_added * f_portion,
            NOW()
        )
        ON CONFLICT (recipe_id) DO UPDATE SET
            energy_kcal_100g = EXCLUDED.energy_kcal_100g,
            energy_kj_100g = EXCLUDED.energy_kj_100g,
            protein_g_100g = EXCLUDED.protein_g_100g,
            carbs_g_100g = EXCLUDED.carbs_g_100g,
            lipid_g_100g = EXCLUDED.lipid_g_100g,
            saturated_fat_g_100g = EXCLUDED.saturated_fat_g_100g,
            trans_fat_g_100g = EXCLUDED.trans_fat_g_100g,
            fiber_g_100g = EXCLUDED.fiber_g_100g,
            sodium_mg_100g = EXCLUDED.sodium_mg_100g,
            sugars_total_g_100g = EXCLUDED.sugars_total_g_100g,
            sugars_added_g_100g = EXCLUDED.sugars_added_g_100g,
            
            portion_g = EXCLUDED.portion_g,
            household_measure = EXCLUDED.household_measure,

            energy_kcal_portion = EXCLUDED.energy_kcal_portion,
            energy_kj_portion = EXCLUDED.energy_kj_portion,
            protein_g_portion = EXCLUDED.protein_g_portion,
            carbs_g_portion = EXCLUDED.carbs_g_portion,
            lipid_g_portion = EXCLUDED.lipid_g_portion,
            saturated_fat_g_portion = EXCLUDED.saturated_fat_g_portion,
            trans_fat_g_portion = EXCLUDED.trans_fat_g_portion,
            fiber_g_portion = EXCLUDED.fiber_g_portion,
            sodium_mg_portion = EXCLUDED.sodium_mg_portion,
            sugars_total_g_portion = EXCLUDED.sugars_total_g_portion,
            sugars_added_g_portion = EXCLUDED.sugars_added_g_portion,

            calculated_at = NOW();
    END;
END;
$function$;
"""
import requests
# Using REST API to execute SQL query via a custom endpoint if any, but since we have mcp server, I will execute it via MCP tool instead of this script!
