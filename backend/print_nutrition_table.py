import sys
import os
from decimal import Decimal

# Add the backend path to sys.path
backend_path = r'c:\Users\Alisson\Documents\Projects\Aplicações\Radar de Preço_Atualiza CMV\backend'
sys.path.append(backend_path)

from main import get_nutrition_report

def format_table():
    try:
        report = get_nutrition_report()
        
        # Headers specifically requested (and some core ones)
        # Produto | Energia (kcal) | Carboidratos (g) | Açúcares Tot. (g) | Açúcares Adic. (g) | Proteína (g) | Sódio (mg)
        
        print("| Produto | Energia (kcal) | Carbo (g) | Açúcar Tot (g) | Açúcar Adic (g) | Proteína (g) | Sódio (mg) |")
        print("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")
        
        for item in report:
            name = item.get("name", "Receita Desconhecida")
            energy = round(item.get("energy_kcal", 0), 1)
            carbs = round(item.get("carbs_g", 0), 1)
            sugars_t = round(item.get("sugars_total_g", 0), 1)
            sugars_a = round(item.get("sugars_added_g", 0), 1)
            protein = round(item.get("protein_g", 0), 1)
            sodium = round(item.get("sodium_mg", 0), 1)
            
            print(f"| {name} | {energy} | {carbs} | {sugars_t} | {sugars_a} | {protein} | {sodium} |")
            
    except Exception as e:
        print(f"Erro ao gerar tabela: {e}")

if __name__ == "__main__":
    format_table()
