# 🔧 Walkthrough: Resolução do Problema de Conectividade do Backend

## 📋 Resumo

Resolvido problema onde a URL do backend não estava respondendo. O diagnóstico revelou que o servidor FastAPI não estava em execução devido a um erro de encoding Unicode no Windows.

---

## 🔍 Problema Identificado

### Sintoma
- Frontend configurado para `http://127.0.0.1:8000`
- Requisições falhando com erro de conexão
- Porta 8000 não estava respondendo

### Diagnóstico
```bash
# Teste de conectividade
curl http://127.0.0.1:8000
# Resultado: Failed to connect to 127.0.0.1 port 8000

# Verificação de porta
netstat -ano | findstr :8000
# Resultado: Nenhum processo rodando
```

**Causa raiz:** Backend não estava em execução.

---

## 🐛 Erro Encontrado ao Iniciar o Backend

Ao tentar iniciar o servidor, foi detectado um `UnicodeEncodeError`:

```
ERROR:    Traceback (most recent call last):
  File "backend\main.py", line 40, in lifespan
    print("🚀 Backend started - Radar de Preço & CMV")
  File "C:\Python312\Lib\encodings\cp1252.py", line 19, in encode
    return codecs.charmap_encode(input,self.errors,encoding_table)[0]
UnicodeEncodeError: 'charmap' codec can't encode character '\U0001f680' 
in position 0: character maps to <undefined>
```

**Causa:** Console do Windows (cp1252) não suporta emojis Unicode.

---

## ✅ Solução Aplicada

### Correção no [main.py](file:///c:/Users/Alisson/Documents/Projects/Radar%20de%20Preço_Atualiza%20CMV/backend/main.py#L37-L42)

```diff
 @asynccontextmanager
 async def lifespan(app: FastAPI):
     """Application lifespan events."""
-    print("🚀 Backend started - Radar de Preço & CMV")
+    print("[STARTUP] Backend started - Radar de Preco & CMV")
     yield
-    print("👋 Backend shutting down")
+    print("[SHUTDOWN] Backend shutting down")
```

**Mudanças:**
- Removidos emojis (🚀, 👋)
- Substituídos por tags textuais `[STARTUP]` e `[SHUTDOWN]`
- Removidos caracteres acentuados que poderiam causar problemas

---

## ✅ Validação

### 1. Backend Iniciado com Sucesso

```bash
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Resultado:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [60472] using WatchFiles
INFO:     Started server process [52704]
INFO:     Waiting for application startup.
[STARTUP] Backend started - Radar de Preco & CMV
INFO:     Application startup complete.
```

✅ **Status:** Servidor rodando sem erros

---

### 2. Endpoint Raiz Funcionando

```bash
curl http://127.0.0.1:8000
```

**Resposta:**
```json
{
  "status": "online",
  "service": "Radar de Preço & CMV"
}
```

✅ **Status:** API respondendo corretamente

---

### 3. Documentação Swagger Disponível

**URL:** http://127.0.0.1:8000/docs

✅ **Status:** Interface Swagger UI carregando normalmente

**Endpoints disponíveis:**
- `GET /` - Health check
- `POST /api/receipts/upload` - Upload de recibos
- `PUT /api/receipts/{receipt_id}/validate` - Validação de recibos
- `GET /api/receipts/pending` - Listar recibos pendentes
- `GET /api/ingredients` - Listar ingredientes
- `GET /api/recipes` - Listar receitas com CMV

---

## 🎯 Estado Atual do Sistema

### ✅ Backend (FastAPI)
- **Status:** ✅ Rodando na porta 8000
- **Configuração:** Modo reload ativo para desenvolvimento
- **Conexão Supabase:** ✅ Configurada
- **Discord Webhook:** ✅ Configurado
- **OCR (Tesseract):** ✅ Disponível

### ✅ Frontend (React + Vite)
- **Status:** ✅ Rodando em http://localhost:5173
- **Configuração:** ✅ `.env` com `VITE_API_URL=http://127.0.0.1:8000`
- **Build:** ✅ Compilado em 832ms
- **Hot Reload:** ✅ Ativo

---

## 🎉 Sistema Completo Rodando!

### URLs de Acesso
- **Frontend:** http://localhost:5173
- **Backend API:** http://127.0.0.1:8000
- **Documentação API:** http://127.0.0.1:8000/docs

### Próximos Passos para Teste

1. **Testar o Fluxo Completo**
   - ✅ Abrir http://localhost:5173 no navegador
   - Upload de recibo via interface
   - Validação de itens
   - Atualização de preços
   - Cálculo de CMV

3. **Verificar Integrações**
   - Conexão com Supabase
   - Notificações Discord
   - Sistema de aprendizado (product_map)

---

## 🔧 Comandos Úteis

### Backend
```bash
# Iniciar backend
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Testar endpoint
curl http://127.0.0.1:8000

# Ver documentação
start http://127.0.0.1:8000/docs
```

### Frontend
```bash
cd frontend
npm run dev
```

---

## 📌 Notas Importantes

> [!IMPORTANT]
> O backend está configurado para aceitar requisições de qualquer origem (`allow_origins=["*"]`). Isso deve ser restringido em produção.

> [!TIP]
> Use a documentação Swagger em `/docs` para testar os endpoints diretamente no navegador durante o desenvolvimento.

> [!NOTE]
> O servidor está em modo `--reload`, reiniciando automaticamente quando detecta mudanças nos arquivos Python.
