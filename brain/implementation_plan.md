# Plano: Restaurar Acesso Externo via Docker

## Contexto

O usuário anteriormente acessava o sistema via **http://191.252.193.107:3000**, mas agora não está funcionando. 

**Situação atual:**
- ✅ Backend rodando localmente: `http://127.0.0.1:8000`
- ✅ Frontend rodando localmente: `http://localhost:5173`
- ❌ Docker não está rodando
- ❌ Acesso externo não disponível

**Situação desejada:**
- ✅ Sistema rodando via Docker
- ✅ Frontend acessível em: `http://191.252.193.107:3000`
- ✅ Backend acessível em: `http://191.252.193.107:8000`

---

## User Review Required

> [!IMPORTANT]
> **Decisão necessária:** Você quer manter os servidores locais rodando E iniciar o Docker, ou prefere parar os servidores locais e usar apenas o Docker?
> 
> **Opções:**
> 1. **Parar servidores locais** e usar apenas Docker (recomendado para evitar conflito de portas)
> 2. **Manter ambos** rodando em portas diferentes
> 
> **Recomendação:** Opção 1 - usar apenas Docker para produção/acesso externo.

> [!WARNING]
> **Conflito de portas:** O backend local está usando a porta 8000. Se iniciarmos o Docker sem parar o servidor local, haverá conflito.

---

## Proposed Changes

### Docker Configuration

#### [MODIFY] [docker-compose.prod.yml](file:///c:/Users/Alisson/Documents/Projects/Radar%20de%20Preço_Atualiza%20CMV/docker-compose.prod.yml)

O arquivo já está configurado corretamente:
- Backend na porta 8000
- Frontend na porta 3000 (mapeado para porta 80 interna do nginx)

**Nenhuma alteração necessária** - arquivo já está correto.

---

### Frontend Configuration

#### [MODIFY] [frontend/.env](file:///c:/Users/Alisson/Documents/Projects/Radar%20de%20Preço_Atualiza%20CMV/frontend/.env)

Atualizar a URL da API para apontar para o IP externo quando em produção:

```env
# Para desenvolvimento local
VITE_API_URL=http://127.0.0.1:8000

# Para produção (Docker)
# VITE_API_URL=http://191.252.193.107:8000
```

**Ação:** Criar arquivo `.env.production` com a URL correta para build de produção.

---

### Firewall & Network

#### Verificações necessárias:

1. **Firewall do Windows** - Verificar se as portas 3000 e 8000 estão abertas
2. **Router/Modem** - Verificar se há port forwarding configurado para 191.252.193.107
3. **Docker Network** - Verificar se o Docker está configurado para aceitar conexões externas

---

## Verification Plan

### Automated Tests

#### 1. Verificar se Docker está instalado
```bash
docker --version
docker-compose --version
```

#### 2. Parar servidores locais (se necessário)
```bash
# Parar frontend (Ctrl+C no terminal do Vite)
# Parar backend (Ctrl+C no terminal do Uvicorn)
```

#### 3. Build e iniciar containers Docker
```bash
cd "c:\Users\Alisson\Documents\Projects\Radar de Preço_Atualiza CMV"
docker-compose -f docker-compose.prod.yml up --build -d
```

#### 4. Verificar containers rodando
```bash
docker-compose -f docker-compose.prod.yml ps
```

#### 5. Testar endpoints localmente
```bash
# Backend
curl http://localhost:8000

# Frontend
curl http://localhost:3000
```

### Manual Verification

#### 1. Testar acesso local
- Abrir navegador em `http://localhost:3000`
- Verificar se o frontend carrega
- Verificar se consegue se comunicar com o backend

#### 2. Testar acesso via IP da rede local
- Abrir navegador em `http://192.168.15.6:3000` (IP local da máquina)
- Verificar se funciona na rede local

#### 3. Testar acesso via IP externo
- Abrir navegador em `http://191.252.193.107:3000`
- Verificar se funciona externamente
- **Nota:** Isso só funcionará se houver port forwarding configurado no router

#### 4. Verificar logs do Docker
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

---

## Troubleshooting

### Se o acesso externo não funcionar:

1. **Verificar IP público atual:**
   ```bash
   curl ifconfig.me
   ```
   Confirmar se ainda é `191.252.193.107`

2. **Verificar firewall do Windows:**
   - Abrir "Firewall do Windows com Segurança Avançada"
   - Verificar regras de entrada para portas 3000 e 8000

3. **Verificar port forwarding no router:**
   - Acessar configurações do router (geralmente `192.168.15.1`)
   - Verificar se há regras de port forwarding para:
     - Porta 3000 → 192.168.15.6:3000
     - Porta 8000 → 192.168.15.6:8000

---

## Next Steps After Approval

1. Parar servidores locais
2. Build e iniciar Docker containers
3. Testar acesso local
4. Testar acesso via IP externo
5. Configurar firewall/port forwarding se necessário
