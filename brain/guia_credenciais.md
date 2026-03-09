# Guia para Obtenção de Credenciais (MP & Stripe)

Para que o sistema consiga ler suas vendas e taxas automaticamente, você precisará gerar as chaves de API em cada plataforma.

## 1. Mercado Pago
O Mercado Pago usa um "Access Token" para autenticar as chamadas.

1. Acesse o [Painel do Desenvolvedor do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app).
2. Se não tiver uma aplicação criada, clique em **"Criar aplicação"**. Dê um nome como "Dashboard DRE".
3. No menu lateral da sua aplicação, clique em **"Credenciais de produção"**.
4. Você verá um campo chamado **"Access Token"**.
   - **O que eu preciso:** Copie esse código longo (começa com `APP_USR-...`).
   - **Segurança:** Nunca compartilhe o "Client Secret", apenas o Access Token é suficiente para o que vamos fazer.

## 2. Stripe
O Stripe usa uma "Secret Key" (Chave Secreta).

1. Acesse o [Dashboard do Stripe](https://dashboard.stripe.com/apikeys).
2. Certifique-se de que o interruptor **"Test Mode"** (Modo de Teste) no topo da página esteja **desativado** (para pegar dados reais).
3. Na seção **"Standard keys"**, você verá a **"Secret key"**.
4. Clique em **"Reveal live key"** (Revelar chave de produção).
   - **O que eu preciso:** Copie essa chave (começa com `sk_live_...`).

---

### Onde colocar essas chaves?
Você tem duas opções:
1. **Passar para mim aqui no chat:** Eu as configurarei no servidor (VPS) para você no arquivo `.env`.
2. **Configurar você mesmo:** Posso te orientar a abrir o arquivo `.env` no terminal e colar as chaves lá.

> [!CAUTION]
> Chaves de API são como senhas. Uma vez que você me passar, eu as salvarei no arquivo `.env` e você pode apagar a mensagem se desejar. O arquivo `.env` é protegido e nunca é enviado para o GitHub.
 Riverside:
