import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from backend.utils.logger import logger

load_dotenv()

class MercadoPagoClient:
    def __init__(self):
        self.access_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
        self.base_url = "https://api.mercadopago.com"
        self.headers = {"Authorization": f"Bearer {self.access_token}"}

    def get_daily_summary(self, target_date: str):
        """
        Busca pagamentos aprovados de um dia (YYYY-MM-DD).
        Calcula fees via transaction_details.net_received_amount como baseline.
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

    def get_monthly_fees(self, year: int, month: int) -> dict:
        """
        Tenta buscar tarifas do mês via API de movimentações.
        Retorna dict com total e debug info.
        """
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        begin_date = f"{year}-{str(month).zfill(2)}-01T00:00:00.000-03:00"
        end_date = f"{year}-{str(month).zfill(2)}-{str(last_day).zfill(2)}T23:59:59.999-03:00"

        total_fees = 0
        total_movements = 0
        api_status = None
        offset = 0

        while True:
            params = {
                "range": "date_created",
                "begin_date": begin_date,
                "end_date": end_date,
                "limit": 100,
                "offset": offset
            }
            response = requests.get(
                f"{self.base_url}/v1/account/movements/search",
                headers=self.headers, params=params
            )
            api_status = response.status_code

            if response.status_code != 200:
                logger.warning(f"[MP] movements API returned {response.status_code}: {response.text[:500]}")
                break

            body = response.json()
            results = body.get("results", [])
            total_movements += len(results)

            if not results:
                break

            for m in results:
                desc = (m.get("description") or m.get("type") or "").lower()
                if "tarifa" in desc or "fee" in desc:
                    total_fees += abs(float(m.get("amount", 0)))

            if len(results) < 100:
                break
            offset += 100

        return {
            "total": round(total_fees, 2),
            "movements_found": total_movements,
            "api_status": api_status
        }


if __name__ == "__main__":
    client = MercadoPagoClient()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Buscando resumo MP de {yesterday}...")
    try:
        summary = client.get_daily_summary(yesterday)
        print(summary)
        print("Monthly fees Jan:", client.get_monthly_fees(2026, 1))
    except Exception as e:
        print(f"Erro: {e}")
