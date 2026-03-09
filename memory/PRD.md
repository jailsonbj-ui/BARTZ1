# Bartz - Sistema de Gestão de Abastecimento de Frota v4.0

## Problema Original
Sistema inteligente de logística para controle de abastecimento de carretas de frota.

## O Que Foi Implementado

### Versão 4.0 - Sistema de Autenticação (09/03/2026) ✅
- **Tela de Login**:
  - Design profissional com logotipos Bartz e Brambila
  - Campos de usuário e senha com toggle de visibilidade
  - Mensagem "Sessão válida até meia-noite"
- **Usuário Admin Inicial**: JAI / 123
- **Rotas Protegidas**:
  - Dashboard acessível apenas para usuários autenticados
  - Redirecionamento automático para /login
- **Menu do Usuário**:
  - Mostra nome e username do usuário logado
  - Acesso ao Painel Admin (para administradores)
  - Botão de Logout
- **Painel de Administração**:
  - Aba "Usuários": Lista todos os usuários com badges de role
  - Aba "Novo Usuário": Formulário para criar usuários com permissões
  - Aba "Histórico de Acesso": Logs de login com timestamps
- **Permissões Disponíveis**:
  - `edit_stations`: Alterar Postos
  - `view_history`: Ver Histórico
  - `create_users`: Criar Usuários
- **Sessão com Expiração à Meia-noite**:
  - Token JWT válido até meia-noite do dia atual
  - Login automático exigido no dia seguinte

### Versão 3.4 - Arrastar Rota (29/01/2026) ⚠️ REMOVIDO
- Funcionalidade removida devido a instabilidade (travamentos e duplicidade de rotas)
- Alternativa: usar campo "Adicionar Parada"

### Versão 3.3 - Copiar Localização (28/01/2026) ✅
- **Botão "Copiar Localização"** no balão de cada posto
- Copia coordenadas no formato `latitude,longitude`

### Versão 3.2 - Slider Visual do Tanque (28/01/2026) ✅
- **Slider visual para porcentagem do tanque**:
  - Barra de nível animada mostrando o combustível atual
  - Botões de seleção rápida: 0%, 25%, 50%, 75%, 100%
  - Arrastar para ajustar o nível (incrementos de 5%)
  - Exibe equivalente em litros automaticamente

### Versão 3.1 - Otimização do Plano de Abastecimento (28/01/2026) ✅
- **Adicionar posto manualmente ao plano**
- **Regra de consolidação de paradas (200km)**

### Versão 3.0 - Preenchimento Automático de Postos (28/01/2026) ✅
- **Auto-preenchimento ao criar posto**
- **Botão "Criar Posto Aqui"** no InfoWindow do marcador de busca

### Versões Anteriores ✅
- Capacidade padrão do tanque: 850L
- Cores claras/pastel e mais ícones para postos
- Correções de bugs (ícones, cores, rotas)
- Busca e personalização
- Lógica otimizada para carretas
- Consultor IA
- Google Maps com camadas

## APIs de Autenticação
- `POST /api/auth/login` - Login (retorna token JWT e dados do usuário)
- `GET /api/auth/me` - Dados do usuário autenticado
- `GET /api/users` - Lista usuários (requer admin)
- `POST /api/users` - Criar usuário (requer admin)
- `PUT /api/users/{id}` - Atualizar usuário (requer admin)
- `DELETE /api/users/{id}` - Excluir usuário (requer admin)
- `GET /api/access-logs` - Histórico de acessos (requer admin)

## APIs de Operação
- `GET /api/stations` - Lista postos
- `POST /api/stations` - Cria posto
- `PUT /api/stations/{id}` - Atualiza posto
- `DELETE /api/stations/{id}` - Exclui posto
- `POST /api/calculate-route` - Calcula rota
- `POST /api/plan-fuel-stops` - Planeja abastecimentos
- `POST /api/ai-advisor` - Consultor IA
- `POST /api/generate-full-order` - Ordem completa

## Credenciais de Teste
- **Admin**: JAI / 123

## Problemas Conhecidos
1. **BLOCKER - Google Maps**: API exibe "For development purposes only" - problema na conta Google Cloud do usuário (faturamento/limites)

## Tarefas Concluídas na Sessão Atual
- [x] Sistema de autenticação JWT
- [x] Tela de login com logotipos
- [x] Painel de administração
- [x] Gerenciamento de usuários e permissões
- [x] Histórico de acessos
- [x] Expiração de sessão à meia-noite

## Próximas Tarefas (P1)
1. Timeout visual da sessão (countdown para meia-noite)
2. Botão de "Imprimir" na Ordem de Abastecimento
3. Edição de senha do próprio usuário

## Backlog (P2-P3)
1. Re-avaliar funcionalidade de "arrastar rota" (removida por instabilidade)
2. Histórico de planos de abastecimento
3. Regra para ícones/cores automáticos com base no nome do posto
4. Dashboard de análise de custos
5. Notificações de preços baixos
6. Integração com GPS do caminhão
