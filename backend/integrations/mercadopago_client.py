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
        Busca pagamentos aprovados e tarifas de um dia específico (YYYY-MM-DD).
        Usa /v1/payments/search para gross/count e /v1/account/movements/search
        para tarifas — mesma fonte do relatório de movimentação do MP dashboard.
        """
        begin_date = f"{target_date}T00:00:00.000-03:00"
        end_date = f"{target_date}T23:59:59.999-03:00"

        # 1. Buscar pagamentos aprovados para gross_amount e transaction_count
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

        # 2. Buscar tarifas via API de movimentações da conta
        fees = self._get_daily_fees(begin_date, end_date)
        net = gross - fees

        return {
            "date": target_date,
            "gateway": "mercadopago",
            "gross_amount": round(gross, 2),
            "fee_amount": round(fees, 2),
            "net_amount": round(net, 2),
            "transaction_count": count
        }

    def _get_daily_fees(self, begin_date: str, end_date: str) -> float:
        """
        Busca movimentações do tipo 'Tarifa do Mercado Pago' no período.
        Endpoint: GET /v1/account/movements/search
        Retorna o valor absoluto (positivo) das tarifas.
        """
        try:
            params = {
                "range": "date_created",
                "begin_date": begin_date,
                "end_date": end_date,
                "limit": 100
            }
            response = requests.get(
                f"{self.base_url}/v1/account/movements/search",
                headers=self.headers, params=params
            )

            if response.status_code == 200:
                movements = response.json().get("results", [])
                # Somar movimentos com tipo de tarifa (valores negativos no MP)
                fee_total = 0
                for m in movements:
                    desc = (m.get("description") or m.get("type") or "").lower()
                    if "tarifa" in desc or "fee" in desc:
                        fee_total += abs(float(m.get("amount", 0)))
                return fee_total

            # Fallback: usar fee_details dos pagamentos se movements API falhar
            return self._get_fees_from_payments(begin_date, end_date)
        except Exception:
            return self._get_fees_from_payments(begin_date, end_date)

    def _get_fees_from_payments(self, begin_date: str, end_date: str) -> float:
        """Fallback: calcula fees a partir dos campos do pagamento individual."""
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

        fees = 0
        for payment in data.get("results", []):
            g = float(payment.get("transaction_amount", 0))
            td_net = float((payment.get("transaction_details") or {}).get("net_received_amount", 0))
            if td_net > 0:
                fees += (g - td_net)
            else:
                fees += sum(float(f.get("amount", 0)) for f in payment.get("fee_details", []))
        return fees


if __name__ == "__main__":
    client = MercadoPagoClient()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Buscando resumo MP de {yesterday}...")
    try:
        summary = client.get_daily_summary(yesterday)
        print(summary)
    except Exception as e:
        print(f"Erro: {e}")
