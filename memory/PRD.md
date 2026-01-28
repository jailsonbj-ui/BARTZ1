# Bartz - Sistema de Gestão de Abastecimento de Frota v3.2

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 3.2 - Slider Visual do Tanque (28/01/2026) ✅
- **Slider visual para porcentagem do tanque**:
  - Barra de nível animada mostrando o combustível atual
  - Botões de seleção rápida: 0%, 25%, 50%, 75%, 100%
  - Arrastar para ajustar o nível (incrementos de 5%)
  - Exibe equivalente em litros automaticamente

### Versão 3.1 - Otimização do Plano de Abastecimento (28/01/2026) ✅
- **Adicionar posto manualmente ao plano**:
  - Botão "+ Adicionar Posto ao Plano" no painel de abastecimento
  - Modal para selecionar posto e quantidade de litros
  - Postos já incluídos no plano são marcados como "Já no plano"
- **Regra de consolidação de paradas (200km)**:
  - Se dois postos estão a menos de 200km, mantém apenas o mais barato
  - Consolida o combustível em uma única parada para reduzir tempo

### Versão 3.0 - Preenchimento Automático de Postos (28/01/2026) ✅
- **Auto-preenchimento ao criar posto**:
  - Ao pesquisar um local no mapa e criar um posto, o nome e cidade são preenchidos automaticamente
  - Ex: Buscar "Posto Shell Curitiba" → Nome: "Posto Shell", Cidade: "Curitiba-PR"
- **Botão "Criar Posto Aqui"** no InfoWindow do marcador de busca
- **Aba "Postos" abre automaticamente** ao criar novo posto

### Versão 2.9 - Configurações do Veículo (28/01/2026) ✅
- **Capacidade padrão do tanque**: 850L (valor típico para carretas)
- **Modo de entrada de combustível**: Toggle Litros/Porcentagem
  - Permite informar o diesel atual em litros ou porcentagem
  - Mostra conversão automática (ex: 24% = 204 litros)

### Versão 2.8 - Melhorias Visuais (28/01/2026) ✅
- **Cores claras/pastel**: 12 cores para melhor visibilidade no mapa
  - Laranja, Azul, Verde, Vermelho, Roxo, Amarelo
  - Rosa, Ciano, Lima, Âmbar, Branco, Turquesa
- **Mais ícones para postos**: 14 opções
  - Combustível, Estrela, Círculo, Quadrado, Losango, Caminhão
  - Shell, Petrobras, Ipiranga, ALE, Bandeira, Pin, Bomba, Gota
- **Mapa inicia com camada híbrida + trânsito ativado**

### Versão 2.7 - Correções de Bugs (28/01/2026) ✅
- **Bug 1 CORRIGIDO**: Ícones e cores dos postos agora são salvos corretamente
  - Adicionado `marker_icon` e `marker_color` ao modelo `FuelStationUpdate`
- **Bug 2 CORRIGIDO**: Novas rotas substituem rotas anteriores corretamente
  - Adicionada key dinâmica ao componente Polyline para forçar recriação

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
