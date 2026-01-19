# SmartFuel - Sistema de Gestão de Abastecimento de Frota

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas com:
- Mapa interativo (70% da tela) + Painel de controle retrátil (30%)
- Gestão de postos de combustível com marcadores no mapa
- Calculadora de rota com paradas intermediárias
- Dados do caminhão (litros, consumo, capacidade)
- Cálculo de autonomia com ponto limite no mapa
- IA para recomendar melhor posto
- Gerador de ordem de serviço para WhatsApp

## Arquitetura
- **Frontend**: React + Tailwind CSS + Leaflet/OpenStreetMap + React-Leaflet
- **Backend**: FastAPI + MongoDB + OSRM (routing)
- **IA**: OpenAI GPT-5.2 via Emergent LLM Key
- **Mapas**: CartoDB Dark Matter + ESRI Satellite

## O Que Foi Implementado (19/01/2026)

### Versão 1.0 (Inicial)
- Layout 70/30 com mapa e painel lateral
- Mapa interativo com tema escuro
- CRUD completo de postos de combustível
- Calculadora de rota (linha reta)

### Versão 2.0 (Melhorias do Usuário)
- ✅ **Rota por RODOVIAS reais** (OSRM - Open Source Routing Machine)
- ✅ **Entrada simplificada**: apenas nomes de cidades (sem lat/lng)
- ✅ **Vista Satélite/Aérea** (toggle no header)
- ✅ **Busca de postos** por cidade/nome
- ✅ **Postos ao longo da rota** identificados automaticamente
- ✅ **Tempo estimado** de viagem
- ✅ Distância real ~1128km (Porto Alegre → São Paulo) vs 852km linha reta

## User Personas
1. **Gestor de Frota** - Monitora rotas e custos de abastecimento
2. **Motorista** - Recebe ordens de serviço via WhatsApp

## Backlog (P0/P1/P2)

### P0 - Crítico
- Nenhum pendente

### P1 - Importante
- Retry logic para APIs externas (Nominatim)
- Histórico de abastecimentos
- Dashboard de custos

### P2 - Nice to Have
- App mobile (React Native)
- Alertas de preços
- Integração com sistemas de frotas

## Próximas Tarefas
1. Adicionar mais cidades ao dicionário KNOWN_CITIES
2. Implementar histórico de viagens
3. Dashboard com análise de custos por período
