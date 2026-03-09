import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class MercadoPagoClient:
    def __init__(self):
        self.access_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
        self.base_url = "https://api.mercadopago.com"

    def get_daily_summary(self, target_date: str):
        """
        Busca pagamentos de um dia específico (YYYY-MM-DD).
        """
        # Formatar datas para o padrão ISO8601 exigido pelo MP
        # Ex: 2026-03-08T00:00:00.000-03:00
        begin_date = f"{target_date}T00:00:00.000-03:00"
        end_date = f"{target_date}T23:59:59.999-03:00"

        headers = {
            "Authorization": f"Bearer {self.access_token}"
        }

        # Parâmetros de busca: apenas pagamentos aprovados no intervalo
        params = {
            "status": "approved",
            "range": "date_created",
            "begin_date": begin_date,
            "end_date": end_date,
            "limit": 100
        }

        response = requests.get(f"{self.base_url}/v1/payments/search", headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

        gross = 0
        fees = 0
        net = 0
        count = len(data.get("results", []))

        for payment in data.get("results", []):
            # gross_amount: Valor total pago
            # net_received_amount: Valor que cai na conta após taxas
            g = float(payment.get("transaction_amount", 0))
            n = float(payment.get("net_received_amount", 0))
            
            gross += g
            net += n
            fees += (g - n)

        return {
            "date": target_date,
            "gateway": "mercadopago",
            "gross_amount": round(gross, 2),
            "fee_amount": round(fees, 2),
            "net_amount": round(net, 2),
            "transaction_count": count
        }

if __name__ == "__main__":
    # Teste rápido
    client = MercadoPagoClient()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Buscando resumo MP de {yesterday}...")
    try:
        summary = client.get_daily_summary(yesterday)
        print(summary)
    except Exception as e:
        print(f"Erro: {e}")
 Riverside:
