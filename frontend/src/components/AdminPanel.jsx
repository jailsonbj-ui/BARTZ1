import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  UserPlus, 
  History, 
  Shield, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2,
  LogIn,
  LogOut,
  Settings
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERMISSIONS = [
  { id: "edit_stations", label: "Alterar Postos", icon: Settings },
  { id: "view_history", label: "Ver Histórico", icon: History },
  { id: "create_users", label: "Criar Usuários", icon: UserPlus },
];

export default function AdminPanel({ user, token, onClose }) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // New user form
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    name: "",
    role: "monitor",
    permissions: []
  });
  
  // Editing user
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (activeTab === "users") fetchUsers();
    if (activeTab === "history") fetchAccessLogs();
  }, [activeTab]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API}/users`, { headers });
      setUsers(res.data);
    } catch (error) {
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccessLogs = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API}/access-logs`, { headers });
      setAccessLogs(res.data);
    } catch (error) {
      toast.error("Erro ao carregar histórico");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.name) {
      toast.error("Preencha todos os campos!");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API}/users`, newUser, { headers });
      toast.success("Usuário criado com sucesso!");
      setNewUser({ username: "", password: "", name: "", role: "monitor", permissions: [] });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar usuário");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userId) => {
    setIsLoading(true);
    try {
      await axios.put(`${API}/users/${userId}`, editForm, { headers });
      toast.success("Usuário atualizado!");
      setEditingUserId(null);
      fetchUsers();
    } catch (error) {
      toast.error("Erro ao atualizar usuário");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Tem certeza que deseja excluir ${username}?`)) return;
    
    setIsLoading(true);
    try {
      await axios.delete(`${API}/users/${userId}`, { headers });
      toast.success("Usuário excluído!");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao excluir usuário");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (permId, isEdit = false) => {
    if (isEdit) {
      const current = editForm.permissions || [];
      setEditForm({
        ...editForm,
        permissions: current.includes(permId) 
          ? current.filter(p => p !== permId)
          : [...current, permId]
      });
    } else {
      setNewUser({
        ...newUser,
        permissions: newUser.permissions.includes(permId)
          ? newUser.permissions.filter(p => p !== permId)
          : [...newUser.permissions, permId]
      });
    }
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
      is_active: user.is_active !== false
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-800 border-white/10">
        <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-orange-500" />
            <CardTitle className="text-xl text-white">Painel de Administração</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "users" 
                ? "bg-orange-500/20 text-orange-400 border-b-2 border-orange-500" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "create" 
                ? "bg-orange-500/20 text-orange-400 border-b-2 border-orange-500" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Novo Usuário
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "history" 
                ? "bg-orange-500/20 text-orange-400 border-b-2 border-orange-500" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Histórico de Acesso
          </button>
        </div>

        <CardContent className="p-4 overflow-y-auto max-h-[60vh]">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}

          {/* Users List */}
          {activeTab === "users" && !isLoading && (
            <div className="space-y-3">
              {users.map(u => (
                <div 
                  key={u.id} 
                  className={`p-4 rounded-lg border ${
                    u.is_active === false 
                      ? "bg-red-900/10 border-red-500/30" 
                      : "bg-slate-700/50 border-white/10"
                  }`}
                >
                  {editingUserId === u.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          placeholder="Nome"
                          className="bg-slate-600 border-white/10"
                        />
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                          className="bg-slate-600 border-white/10 rounded-md px-3 text-white"
                        >
                          <option value="admin">Administrador</option>
                          <option value="monitor">Monitor</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {PERMISSIONS.map(perm => (
                          <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                            <Checkbox
                              checked={editForm.permissions?.includes(perm.id)}
                              onCheckedChange={() => togglePermission(perm.id, true)}
                            />
                            {perm.label}
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <Checkbox
                            checked={editForm.is_active}
                            onCheckedChange={(checked) => setEditForm({...editForm, is_active: checked})}
                          />
                          Ativo
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateUser(u.id)}>
                          <Save className="w-4 h-4 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{u.name || u.username}</span>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                            {u.role === "admin" ? "Admin" : "Monitor"}
                          </Badge>
                          {u.is_active === false && (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">@{u.username}</div>
                        <div className="flex gap-1 mt-2">
                          {(u.permissions || []).map(p => {
                            const perm = PERMISSIONS.find(x => x.id === p);
                            return perm ? (
                              <Badge key={p} variant="outline" className="text-xs">
                                {perm.label}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => startEditing(u)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {u.id !== user.id && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-red-400 hover:text-red-300"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create User Form */}
          {activeTab === "create" && !isLoading && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Usuário</label>
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    placeholder="nome.usuario"
                    className="bg-slate-700/50 border-white/10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="••••••"
                    className="bg-slate-700/50 border-white/10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome Completo</label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Nome do usuário"
                  className="bg-slate-700/50 border-white/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-md px-3 py-2 text-white"
                >
                  <option value="monitor">Monitor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Permissões</label>
                <div className="flex flex-wrap gap-4">
                  {PERMISSIONS.map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <Checkbox
                        checked={newUser.permissions.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">
                <UserPlus className="w-4 h-4 mr-2" />
                Criar Usuário
              </Button>
            </form>
          )}

          {/* Access Logs */}
          {activeTab === "history" && !isLoading && (
            <div className="space-y-2">
              {accessLogs.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Nenhum registro encontrado</p>
              ) : (
                accessLogs.map(log => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      {log.action === "login" ? (
                        <LogIn className="w-4 h-4 text-green-400" />
                      ) : log.action.startsWith("created") ? (
                        <UserPlus className="w-4 h-4 text-blue-400" />
                      ) : (
                        <LogOut className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <span className="font-medium text-white">{log.name || log.username}</span>
                        <span className="text-gray-400 text-sm ml-2">
                          {log.action === "login" ? "fez login" : log.action}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(log.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
