# Bartz - Sistema de Gestão de Abastecimento de Frota v2.6

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 2.6 - Busca e Personalização (24/01/2026) ✅
- **Marcador de busca no mapa**:
  - Ao buscar um local, marcador vermelho aparece no ponto
  - Mapa centraliza automaticamente no local
  - Botão X limpa busca e remove marcador
- **Personalização de ícones dos postos**:
  - 6 ícones: Combustível, Estrela, Círculo, Quadrado, Losango, Caminhão
  - 8 cores: Laranja, Azul, Verde, Vermelho, Roxo, Amarelo, Rosa, Ciano
  - Salva no banco de dados por posto

### Versão 2.5 - Refinamentos ✅
- Barra de pesquisa no mapa (Google Places)
- Botão "Completar" nas paradas
- Ordem sem valor monetário
- Postos limitados a 50km da rota
- Renomeado para BARTZ

### Versões Anteriores ✅
- Lógica otimizada para carretas
- Consultor IA
- Google Maps com camadas
- Edição/remoção de paradas

## Personalização de Marcadores
```javascript
STATION_ICONS = {
  fuel: "Combustível",
  star: "Estrela", 
  circle: "Círculo",
  square: "Quadrado",
  diamond: "Losango",
  truck: "Caminhão"
}

STATION_COLORS = {
  orange, blue, green, red,
  purple, yellow, pink, cyan
}
```

## APIs Disponíveis
- `GET /api/stations` - Lista postos (inclui marker_icon, marker_color)
- `POST /api/stations` - Cria posto com personalização
- `PUT /api/stations/{id}` - Atualiza posto
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos
- `POST /api/ai-advisor` - Consultor IA
- `POST /api/generate-full-order` - Ordem completa

## Próximas Tarefas (Backlog)
1. Histórico de viagens realizadas
2. Dashboard de análise de custos
3. Notificações de preços baixos
4. Integração com GPS do caminhão
