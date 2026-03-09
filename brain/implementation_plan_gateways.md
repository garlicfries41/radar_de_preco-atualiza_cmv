# Integração Automática Mercado Pago & Stripe

Este plano descreve a estratégia para automatizar a coleta de dados financeiros (vendas e taxas) das plataformas de pagamento.

## Objetivo (North Star)
Eliminar a necessidade de inserção manual de "Taxa Mercado Pago", "Taxa Stripe" e receitas brutas no Wizard de Fechamento, provendo dados precisos em tempo real.

## Estratégia de Sincronização
Para equilibrar performance e atualização, a melhor abordagem é a **Sincronização Híbrida**:

1. **Sincronização Diária (Automática):**
   - Um script agendado buscará as transações do dia anterior.
   - Isso permite que você veja a evolução da DRE durante o mês quase em tempo real (D-1).
   - Dados serão cacheados no banco de dados para consulta rápida.

2. **Sincronização Manual (No Fechamento):**
   - Dentro do Wizard, haverá um botão para forçar a atualização imediata.
   - Isso garante que, no dia do fechamento (ex: dia 28), os dados do próprio dia também entrem no cálculo.

## Arquitetura Proposta

### Camada de Banco (Supabase)
- **Nova Tabela:** `payment_gateways_history`
  - Armazenará totais diários (Bruto, Taxas, Líquido) por gateway.

### Camada de Integração (Backend)
- Criaremos uma estrutura modular em `backend/integrations/`:
  - `mercadopago_client.py`: Lógica para buscar relatórios de liberação (Release Reports) ou buscas de pagamentos.
  - `stripe_client.py`: Lógica para buscar Balance Transactions (que já trazem as taxas discriminadas).

### Camada de Interface (Frontend)
- O Wizard de Fechamento exibirá esses valores com um Status: "Auto-preenchido via API".

## Verificação Técnica (Spike)
Antes de automatizar, preciso validar as conectividades:
- [ ] Obter Access Token/Secret do Mercado Pago.
- [ ] Obter Secret Key do Stripe.

---
> [!IMPORTANT]
> A API do Mercado Pago é muito detalhista sobre "quando" o dinheiro é liberado vs "quando" a venda ocorreu. Usaremos a data da **venda** para a DRE por competência.
