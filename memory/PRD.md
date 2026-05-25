# Bartz - Sistema de Gestão de Abastecimento de Frota v5.0

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 5.0 - Migração para Mapbox GL JS (25/05/2026) ✅
- **Substituição completa do Google Maps por Mapbox:**
  - Mapa interativo com estilos: Híbrido, Satélite, Mapa escuro
  - Marcadores personalizados com cores por preço (verde/vermelho/laranja)
  - Popups com informações do posto e botão "Copiar Link Google Maps"
  - Geocoder integrado para busca de locais em português
  - Controles de zoom e escala
  - Camada de trânsito
- **Funcionalidades mantidas:**
  - Cálculo e exibição de rotas
  - Criação de postos via clique no mapa
  - Marcadores arrastawéis para posicionamento
  - Indicadores de melhor/pior preço por estado

### Versão 4.1 - Relatório de Preços Excel + UI (17/03/2026) ✅
- Nova tela de login com imagem de fundo personalizada
- Destaque de preços por estado no mapa
- Relatório de preços em Excel (admin only)
- Nova aba "Relatórios" no painel admin

### Versão 4.0 - Sistema de Autenticação (09/03/2026) ✅
- Tela de login com logotipos
- Usuário Admin inicial: JAI / 123
- Rotas protegidas (JWT)
- Painel de Administração
- Sessão válida até meia-noite

### Versões Anteriores ✅
- Capacidade padrão do tanque: 850L
- Consultor IA (OpenAI GPT)
- Edição inline de postos
- Slider visual do tanque
- Auto-preenchimento de postos

## Stack Técnica
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Mapbox GL JS
- **Backend:** FastAPI, Pydantic, Motor (MongoDB), PyJWT
- **Banco de Dados:** MongoDB
- **Mapas:** Mapbox GL JS + Mapbox Geocoder

## Configuração do Mapbox
```env
REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoiYmFydHoyMiIsImEiOiJjbXBrM214MngxcnlnMnFvaGc5NG1jNmh3In0.ibZpBqQtvESg3hZv4Ez5JQ
```

## APIs

### Autenticação
- `POST /api/auth/login` - Login (JWT)
- `GET /api/auth/me` - Usuário autenticado

### Admin (requer admin)
- `GET /api/users` - Lista usuários
- `POST /api/users` - Criar usuário
- `GET /api/access-logs` - Histórico de acessos
- `GET /api/reports/prices` - Relatório Excel de preços

### Operação
- `GET /api/stations` - Lista postos
- `POST /api/stations` - Cria posto
- `PUT /api/stations/{id}` - Atualiza
- `DELETE /api/stations/{id}` - Exclui
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos
- `POST /api/ai-advisor` - Consultor IA

## Credenciais de Teste
- **Admin:** JAI / 123
- **Admin:** BARTZ / 123456

## Tarefas Concluídas Nesta Sessão
- [x] Migração completa de Google Maps para Mapbox GL JS
- [x] Geocoder Mapbox integrado para busca de locais
- [x] Marcadores personalizados com preços
- [x] Menu de camadas (Híbrido, Satélite, Mapa, Trânsito)
- [x] Popups com informações dos postos
- [x] Rota exibida como GeoJSON LineString

## Próximas Tarefas (P1)
1. Adicionar Directions API do Mapbox para cálculo de rotas
2. Timeout visual da sessão (countdown para meia-noite)
3. Botão de "Imprimir" na Ordem de Abastecimento

## Backlog (P2-P3)
1. Histórico de planos de abastecimento
2. Dashboard de análise de custos
3. Notificações de preços baixos
