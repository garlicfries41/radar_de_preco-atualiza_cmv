# 📊 Radar de Preço & CMV

Sistema de gestão de custos com análise de recibos via OCR e cálculo automático de CMV (Custo de Mercadoria Vendida).

## 🎯 Objetivos

1. **Automatizar atualização de preços** via leitura de recibos de mercado
2. **Calcular CMV em tempo real** para produtos baseados em fichas técnicas
3. **Notificar variações significativas** via Discord
4. **Rastrear tendências de mercado** para decisões de compra

## 🏗️ Arquitetura

- **Frontend**: React (Vite) + TailwindCSS → Hospedado na Vercel
- **Backend**: Python (FastAPI) + Tesseract OCR → Hospedado na VPS (Docker)
- **Database**: Supabase (PostgreSQL)
- **Alerts**: Discord Webhooks

## 📦 Setup Local

### Backend

```bash
# Criar virtualenv
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Instalar dependências
pip install -r requirements.txt

# Configurar .env
cp .env.example .env
# Editar .env com suas credenciais

# Rodar servidor
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker (Recomendado para VPS)

```bash
docker-compose up --build
```

## 🔑 Variáveis de Ambiente (.env)

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-chave-secreta
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## 📡 API Endpoints

### `POST /api/receipts/upload`
Upload de foto de recibo. Retorna dados extraídos via OCR.

### `PUT /api/receipts/{id}/validate`
Confirma e corrige dados do recibo. Atualiza preços e recalcula CMV.

### `GET /api/receipts/pending`
Lista recibos aguardando validação.

### `GET /api/ingredients`
Lista todos os ingredientes cadastrados.

### `GET /api/recipes`
Lista receitas com CMV atual.

## 🗄️ Database Schema

Ver [`architecture/supabase_setup.sql`](architecture/supabase_setup.sql)

## 📱 Workflow

1. **Mobile**: Tirar foto do recibo
2. **Upload**: App envia para backend
3. **OCR**: Tesseract extrai texto
4. **Parse**: Regex identifica itens e preços
5. **Match**: Sistema sugere ingredientes (via learning)
6. **Validação**: Usuário confirma/corrige
7. **Update**: Preços atualizados
8. **CMV**: Receitas recalculadas automaticamente
9. **Alert**: Discord notifica mudanças > 10%

## 🚀 Deploy

### Backend (VPS via Docker)
```bash
docker build -t radar-backend .
docker run -d -p 8000:8000 --env-file .env radar-backend
```

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

## 📊 B.L.A.S.T. Protocol

Este projeto segue o protocolo B.L.A.S.T. para desenvolvimento sistemático:

- ✅ **Blueprint**: Arquitetura definida
- ✅ **Link**: Conexões verificadas
- 🔄 **Architect**: Implementação em andamento
- ⏳ **Stylize**: Design pendente
- ⏳ **Trigger**: Deploy pendente

## 📄 Licença

Projeto privado.
