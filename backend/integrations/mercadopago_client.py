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
        Busca pagamentos aprovados de um dia específico (YYYY-MM-DD).
        Retorna gross_amount, transaction_count. fee_amount = 0 aqui;
        as tarifas são calculadas mensalmente via get_monthly_fees().
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

        gross = sum(float(p.get("transaction_amount", 0)) for p in data.get("results", []))
        count = len(data.get("results", []))

        return {
            "date": target_date,
            "gateway": "mercadopago",
            "gross_amount": round(gross, 2),
            "fee_amount": 0,
            "net_amount": round(gross, 2),
            "transaction_count": count
        }

    def get_monthly_fees(self, year: int, month: int) -> float:
        """
        Busca TODAS as tarifas do mês via API de movimentações da conta.
        Mesma fonte do relatório XLSX do dashboard do MP.
        Retorna o valor absoluto (positivo) total das tarifas.
        """
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        begin_date = f"{year}-{str(month).zfill(2)}-01T00:00:00.000-03:00"
        end_date = f"{year}-{str(month).zfill(2)}-{str(last_day).zfill(2)}T23:59:59.999-03:00"

        total_fees = 0
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

            if response.status_code != 200:
                break

            results = response.json().get("results", [])
            if not results:
                break

            for m in results:
                desc = (m.get("description") or m.get("type") or "").lower()
                if "tarifa" in desc or "fee" in desc:
                    total_fees += abs(float(m.get("amount", 0)))

            if len(results) < 100:
                break
            offset += 100

        return round(total_fees, 2)


if __name__ == "__main__":
    client = MercadoPagoClient()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Buscando resumo MP de {yesterday}...")
    try:
        summary = client.get_daily_summary(yesterday)
        print(summary)
    except Exception as e:
        print(f"Erro: {e}")
