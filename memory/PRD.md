# SmartFuel - Sistema de Gestão de Abastecimento de Frota v2.1

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## Requisitos do Produto
1. UI com Mapa Interativo (70%) + Painel de Controle (30%)
2. Gestão de Postos de Combustível (CRUD com avaliações)
3. Cálculo de Rotas seguindo rodovias reais
4. Planejamento inteligente de abastecimentos
5. Busca de cidades com autocomplete
6. Temas visuais selecionáveis
7. Ordens de serviço para WhatsApp

## O Que Foi Implementado (24/01/2026)

### Versão 2.1 - Migração Google Maps ✅
- **Google Maps Visual** - Mapa real do Google com tema escuro
- **Marcadores personalizados** - Postos com preço e avaliação
- **Rota visual** - Linha laranja seguindo rodovias
- **Fallbacks robustos**:
  - Google Places → Banco local de 80+ cidades
  - Google Directions → OSRM

### Versão 2.0 - Funcionalidades Completas ✅
- **Autocomplete de Cidades** - 80+ cidades brasileiras
- **Sistema de Avaliação** - Estrelas (0-5) para:
  - Preço, Atendimento, Estacionamento, Segurança
- **Tipos de Estacionamento**:
  - Grátis, Pago, Com abastecimento mínimo
- **6 Temas Visuais**:
  - Escuro, Oceano, Floresta, Pôr do Sol, Meia-Noite, Claro
- **Planejamento de Múltiplos Abastecimentos**:
  - Detecção de trechos sem postos (gaps)
  - Numeração dos postos no mapa
  - Lógica: abastecimento parcial quando há posto mais barato
- **IA para resumo do plano** (GPT-5.2)
- **Ordens de Serviço** - Compartilhamento via WhatsApp

### Versão 1.0 - Base ✅
- Layout mapa (70%) + painel lateral (30%)
- CRUD de postos de combustível
- Rota por rodovias (OSRM)

## Rotas Testadas e Verificadas
| Rota | Distância | Duração | Status |
|------|-----------|---------|--------|
| Porto Alegre → São Paulo | 1128 km | 14h 42min | ✅ |
| Porto Alegre → Recife | 3896 km | 51h 37min | ✅ |

## Stack Tecnológica
- Frontend: React + Tailwind + @react-google-maps/api
- Backend: FastAPI + MongoDB
- Mapa: Google Maps JavaScript API
- Routing: Google Directions (fallback: OSRM)
- Geocodificação: Google Places (fallback: banco local)
- IA: OpenAI GPT-5.2 (Emergent LLM Key)

## Credenciais
- **Google Maps API Key**: Armazenada em `backend/.env` e `frontend/.env`
- **Emergent LLM Key**: Armazenada em `backend/.env`
- **Nota**: A conta Google precisa de billing habilitado para remover watermark "For development purposes only"

## APIs Disponíveis
- `GET /api/health` - Health check
- `GET /api/stations` - Lista postos
- `POST /api/stations` - Cria posto
- `PUT /api/stations/{id}` - Atualiza posto
- `DELETE /api/stations/{id}` - Remove posto
- `GET /api/search-cities?query=` - Busca cidades
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos
- `POST /api/generate-service-order` - Gera ordem de serviço
- `POST /api/seed-stations` - Popula postos de exemplo

## Próximas Tarefas (Backlog)
1. Histórico de viagens realizadas
2. Dashboard de análise de custos
3. Notificações de preços baixos
4. Integração com GPS do caminhão
5. Refatorar `server.py` em módulos menores

## Arquitetura de Arquivos
```
/app/
├── backend/
│   ├── .env (MONGO_URL, EMERGENT_LLM_KEY, GOOGLE_MAPS_API_KEY)
│   ├── server.py (todos os endpoints)
│   ├── tests/test_fleet_api.py
│   └── requirements.txt
├── frontend/
│   ├── .env (REACT_APP_BACKEND_URL, REACT_APP_GOOGLE_MAPS_KEY)
│   ├── src/
│   │   ├── components/MapView.jsx (Google Maps)
│   │   ├── components/ControlPanel.jsx
│   │   └── pages/FleetDashboard.jsx
│   └── package.json
└── memory/PRD.md
```
