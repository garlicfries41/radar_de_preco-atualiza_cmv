import requests
from datetime import datetime, timedelta
import time

# A URL do seu backend local
BASE_URL = "http://localhost:8000/api/financeiro/gateways/sync"

def sync_history(days_back=90):
    """Sincroniza os últimos X dias."""
    today = datetime.now()
    
    # Vamos sincronizar do dia anterior para trás
    for i in range(1, days_back + 1):
        target_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        print(f"Sincronizando {target_date}...")
        
        try:
            response = requests.post(f"{BASE_URL}?date={target_date}")
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                print(f"  OK! Resultados: {len(results)} gateways sincronizados.")
            else:
                print(f"  ERRO ao sincronizar {target_date}: {response.text}")
        except Exception as e:
            print(f"  FALHA na conexão: {e}")
        
        # Pequeno delay para evitar rate limit das APIs (opcional)
        time.sleep(0.5)

if __name__ == "__main__":
    print("Iniciando Sincronização Histórica (MP & Stripe)...")
    sync_history(90) # 3 meses aproximadamente
    print("Sincronização concluída!")
