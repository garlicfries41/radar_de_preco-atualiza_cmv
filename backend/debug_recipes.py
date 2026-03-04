from main import supabase

res = supabase.table('recipes') \
    .select('id, name, yield_units, net_weight, production_unit, total_weight_kg') \
    .ilike('name', '%Talharim%Tremo%') \
    .execute()

for r in res.data:
    name = r['name']
    yield_u = r['yield_units']
    net_wt = r['net_weight']
    prod_unit = r['production_unit']
    total_wt = r['total_weight_kg']
    print(f"NAME: {name}")
    print(f"  yield_units={yield_u}, net_weight={net_wt}, production_unit={prod_unit}, total_weight_kg={total_wt}")
    print()    
