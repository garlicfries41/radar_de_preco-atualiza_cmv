import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class MercadoPagoClient:
    def __init__(self):
        self.access_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
        self.base_url = "https://api.mercadopago.com"
        self.headers = {"Authorization": f"Bearer {self.access_token}"}

    def get_daily_summary(self, target_date: str):
        """
        Busca pagamentos aprovados de um dia (YYYY-MM-DD).
        Calcula fees via transaction_details.net_received_amount e fee_details.
        Nota: a API do MP não expõe todas as tarifas (ex: tarifas mensais,
        ajustes) — o valor é um baseline editável no Wizard de Fechamento.
        """
        begin_date = f"{target_date}T00:00:00.000-03:00"
        end_date = f"{target_date}T23:59:59.999-03:00"

        params = {
            "status": "approved",
            "range": "date_created",
            "begin_date": begin_date,
            "end_date": end_date,
            "limit": 100
        }
        response = requests.get(
            f"{self.base_url}/v1/payments/search",
            headers=self.headers, params=params
        )
        response.raise_for_status()
        data = response.json()

        gross = 0
        fees = 0
        for payment in data.get("results", []):
            g = float(payment.get("transaction_amount", 0))
            td_net = float((payment.get("transaction_details") or {}).get("net_received_amount", 0))
            if td_net > 0:
                fees += (g - td_net)
            else:
                fees += sum(float(f.get("amount", 0)) for f in payment.get("fee_details", []))
            gross += g
        count = len(data.get("results", []))

        return {
            "date": target_date,
            "gateway": "mercadopago",
            "gross_amount": round(gross, 2),
            "fee_amount": round(fees, 2),
            "net_amount": round(gross - fees, 2),
            "transaction_count": count
        }


if __name__ == "__main__":
    client = MercadoPagoClient()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Buscando resumo MP de {yesterday}...")
    try:
        summary = client.get_daily_summary(yesterday)
        print(summary)
    except Exception as e:
        print(f"Erro: {e}")
