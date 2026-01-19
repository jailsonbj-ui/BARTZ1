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
- **Frontend**: React + Tailwind CSS + Leaflet/OpenStreetMap
- **Backend**: FastAPI + MongoDB
- **IA**: OpenAI GPT-5.2 via Emergent LLM Key
- **Mapas**: CartoDB Dark Matter (gratuito)

## User Personas
1. **Gestor de Frota** - Monitora rotas e custos de abastecimento
2. **Motorista** - Recebe ordens de serviço via WhatsApp

## O Que Foi Implementado (19/01/2026)
- ✅ Layout 70/30 com mapa e painel lateral
- ✅ Mapa interativo com tema escuro
- ✅ CRUD completo de postos de combustível
- ✅ Marcadores personalizados com preços
- ✅ Calculadora de rota com distância Haversine
- ✅ Dados do veículo (litros, consumo, capacidade)
- ✅ Cálculo de autonomia em tempo real
- ✅ Ponto limite de combustível no mapa
- ✅ Recomendação IA de melhor posto
- ✅ Gerador de ordem de serviço
- ✅ Compartilhamento via WhatsApp
- ✅ Postos fictícios Porto Alegre - São Paulo

## Backlog (P0/P1/P2)
### P0 - Crítico
- Nenhum pendente

### P1 - Importante
- Integração com Google Maps Directions API para rotas reais
- Histórico de abastecimentos
- Dashboard de custos

### P2 - Nice to Have
- App mobile (React Native)
- Alertas de preços
- Integração com sistemas de frotas

## Próximas Tarefas
1. Integrar API de direções para rotas mais precisas
2. Adicionar autenticação de usuários
3. Implementar dashboard de análise de custos
