# SmartFuel - Sistema de Gestão de Abastecimento de Frota v2.3

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 2.3 - Otimização para Carretas (24/01/2026) ✅
- **Lógica de Abastecimento Otimizada**:
  - Minimiza número de paradas (preferência por grandes abastecimentos)
  - Abastecimento mínimo: 100 litros (não vale parar por menos)
  - Parcial apenas quando há posto >5% mais barato adiante
  - Chegada no destino com **20% de reserva** no tanque
- **Consultor IA**:
  - Botão "Consultar IA sobre este plano"
  - Análise inteligente da rota e paradas
  - Sugestões de otimização personalizadas
- **Novos campos no plano**:
  - Preço médio por litro
  - Percentual do tanque na chegada
  - Motivo de cada parada (parcial vs completo)

### Versão 2.2 - Melhorias UX ✅
- Botão "Novo Posto" no mapa
- Toggle rápido Ativo/Inativo na lista
- Camadas: Mapa, Satélite, Relevo, Híbrido, Trânsito

### Versões Anteriores ✅
- Google Maps visual
- Sistema de avaliação (4 categorias)
- 6 temas visuais
- Ordens de serviço para WhatsApp

## Regras de Abastecimento para Carretas
```
MIN_REFUEL_LITERS = 100        # Mínimo para parar
DESTINATION_RESERVE = 20%      # Reserva no destino
SAFETY_MARGIN = 50 km          # Nunca rodar vazio
CHEAPER_THRESHOLD = 5%         # Diferença para abastecimento parcial
```

## Stack Tecnológica
- Frontend: React + Tailwind + @react-google-maps/api
- Backend: FastAPI + MongoDB
- Routing: Google Directions (fallback: OSRM)
- IA: OpenAI GPT-5.2 (Emergent LLM Key)

## APIs Disponíveis
- `GET /api/stations` - Lista postos
- `POST /api/stations` - Cria posto
- `PUT /api/stations/{id}` - Atualiza posto
- `DELETE /api/stations/{id}` - Remove posto
- `GET /api/search-cities?query=` - Busca cidades
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos (otimizado)
- `POST /api/ai-advisor` - **NOVO** Consultor IA
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
│   ├── server.py (endpoints + lógica IA otimizada)
│   └── .env (GOOGLE_MAPS_API_KEY, EMERGENT_LLM_KEY)
├── frontend/
│   ├── src/components/MapView.jsx (Google Maps + controles)
│   ├── src/components/ControlPanel.jsx (+ botão IA)
│   └── src/pages/FleetDashboard.jsx (+ handleAskAI)
└── memory/PRD.md
```
