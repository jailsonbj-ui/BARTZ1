# Bartz - Sistema de Gestão de Abastecimento de Frota v2.5

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 2.5 - Refinamentos Finais (24/01/2026) ✅
- **Barra de pesquisa no mapa**:
  - Google Places Autocomplete integrado
  - Busca qualquer local no Brasil
  - Mapa centraliza automaticamente no local buscado
- **Botão "Completar" nas paradas**:
  - Toggle para indicar se deve completar o tanque
  - Visual: botão azul com ✓ quando ativo
- **Ordem de abastecimento atualizada**:
  - Mostra "COMPLETAR" se marcado, ou quantidade de litros
  - SEM valor monetário na ordem (conforme solicitado)
- **Postos limitados a 50km da rota** (antes era 100km)
- **Renomeado de SmartFuel para Bartz**

### Versão 2.4 - Gestão de Plano ✅
- Barra de pesquisa na lista de postos
- Edição manual de litragem
- Remover parada (redistribui litros)
- Ordem completa numerada (1ª, 2ª, etc.)

### Versões Anteriores ✅
- Lógica otimizada para carretas (mín. 100L, 20% reserva destino)
- Consultor IA
- Google Maps visual com camadas
- Toggle Ativo/Inativo

## Formato da Ordem de Abastecimento
```
🚛 *ORDEM DE ABASTECIMENTO*
📍 Rota: Origem → Destino
📏 Distância: X km

*PARADAS:*

*1ª abastecida*
⛽ Posto: [Nome do Posto]
📌 Local: [Cidade]
🛣️ Km [X]
💧 [COMPLETAR ou XXL]
🗺️ [Link do Maps]

*RESUMO:*
⛽ Total estimado: XXL
```

## APIs Disponíveis
- `GET /api/stations` - Lista postos
- `POST /api/stations` - Cria posto
- `PUT /api/stations/{id}` - Atualiza posto
- `DELETE /api/stations/{id}` - Remove posto
- `GET /api/search-cities?query=` - Busca cidades
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos (max 50km da rota)
- `POST /api/ai-advisor` - Consultor IA
- `POST /api/generate-full-order` - Ordem completa (+isComplete)

## Próximas Tarefas (Backlog)
1. Histórico de viagens realizadas
2. Dashboard de análise de custos
3. Notificações de preços baixos
4. Integração com GPS do caminhão

## Arquitetura
```
/app/
├── backend/
│   └── server.py (max_deviation=50km, isComplete support)
├── frontend/
│   ├── src/components/MapView.jsx (+Autocomplete search)
│   ├── src/components/ControlPanel.jsx (+Completar button)
│   └── src/pages/FleetDashboard.jsx (+handleToggleComplete)
└── memory/PRD.md
```
