# SmartFuel - Sistema de Gestão de Abastecimento de Frota v2.2

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 2.2 - Melhorias UX (24/01/2026) ✅
- **Novo fluxo de criação de posto**:
  - Botão "Novo Posto" no mapa (não cria ao clicar acidentalmente)
  - Modo de criação com indicador visual e cursor crosshair
  - Marcador arrastável para ajustar posição
- **Toggle rápido Ativo/Inativo** na lista de postos
- **Camadas de mapa**:
  - Mapa, Satélite, Relevo, Híbrido
  - Trânsito em tempo real
- **Posto inativo**: marcador cinza, não considerado na IA

### Versão 2.1 - Google Maps ✅
- Google Maps visual (tema escuro)
- Rotas corretas via Google Directions / OSRM fallback
- Busca de cidades com autocomplete

### Versão 2.0 - Funcionalidades ✅
- Sistema de avaliação (4 categorias com estrelas)
- 6 temas visuais
- Planejamento multi-abastecimento com IA
- Ordens de serviço para WhatsApp

## Stack Tecnológica
- Frontend: React + Tailwind + @react-google-maps/api
- Backend: FastAPI + MongoDB
- Routing: Google Directions (fallback: OSRM)
- IA: OpenAI GPT-5.2 (Emergent LLM Key)

## APIs Disponíveis
- `GET /api/stations` - Lista postos
- `POST /api/stations` - Cria posto
- `PUT /api/stations/{id}` - Atualiza posto (inclui is_active)
- `DELETE /api/stations/{id}` - Remove posto
- `GET /api/search-cities?query=` - Busca cidades
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos (ignora inativos)
- `POST /api/generate-service-order` - Gera ordem de serviço

## Próximas Tarefas (Backlog)
1. Histórico de viagens realizadas
2. Dashboard de análise de custos
3. Notificações de preços baixos
4. Integração com GPS do caminhão

## Arquitetura
```
/app/
├── backend/
│   ├── server.py (endpoints + lógica IA)
│   └── .env (GOOGLE_MAPS_API_KEY, EMERGENT_LLM_KEY)
├── frontend/
│   ├── src/components/MapView.jsx (Google Maps + controles)
│   ├── src/components/ControlPanel.jsx (toggle ativo/inativo)
│   └── src/pages/FleetDashboard.jsx
└── memory/PRD.md
```
