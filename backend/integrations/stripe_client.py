import os
import stripe
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class StripeClient:
    def __init__(self):
        self.api_key = os.getenv("STRIPE_SECRET_KEY")
        stripe.api_key = self.api_key

    def get_daily_summary(self, target_date: str):
        """
        Busca transações de um dia específico (YYYY-MM-DD) e retorna o resumo.
        Considera taxas (fees) e valores brutos.
        """
        # Converter string para timestamps de início e fim do dia (UTC)
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        start_ts = int(dt.timestamp())
        end_ts = int((dt + timedelta(days=1)).timestamp())

        gross = 0
        fees = 0
        net = 0
        count = 0

        # Paginar transações de saldo (Balance Transactions)
        # Este endpoint já traz o valor líquido (amount) e a taxa (fee)
        transactions = stripe.BalanceTransaction.list(
            created={"gte": start_ts, "lt": end_ts},
            limit=100
        )

        for txn in transactions.auto_paging_iter():
            # stripe trata valores em centavos. Convertemos para BRL (floating)
            gross += txn.amount / 100 if txn.amount > 0 else 0
            fees += txn.fee / 100
            net += txn.net / 100
            if txn.type in ["charge", "payment"]:
                count += 1

        return {
            "date": target_date,
            "gateway": "stripe",
            "gross_amount": round(gross, 2),
            "fee_amount": round(fees, 2),
            "net_amount": round(net, 2),
            "transaction_count": count
        }

if __name__ == "__main__":
    # Teste rápido
    client = StripeClient()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Buscando resumo de {yesterday}...")
    summary = client.get_daily_summary(yesterday)
    print(summary)
