import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error("Preencha usuário e senha!");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username: username.trim(),
        password: password.trim(),
      });

      const { token, user } = response.data;
      
      localStorage.setItem("bartz_token", token);
      localStorage.setItem("bartz_user", JSON.stringify(user));
      
      toast.success(`Bem-vindo, ${user.name || user.username}!`);
      onLogin(user, token);
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.response?.data?.detail || "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Full Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/login-bg.png)' }}
      />

      {/* Left Side - Just the background, no extra content since image already has branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10" />

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative z-10">
        {/* Mobile: Semi-transparent overlay for better form visibility */}
        <div className="lg:hidden absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2 z-20">
          <img 
            src="/brambila-logo.png" 
            alt="Brambila" 
            className="h-14 w-auto object-contain drop-shadow-xl"
          />
        </div>

        {/* Glass Card Form */}
        <div className="w-full max-w-md mx-4 lg:mx-8 relative z-10">
          <div className="bg-slate-900/85 backdrop-blur-xl rounded-3xl p-8 lg:p-10 shadow-2xl border border-white/10">
            {/* Welcome Text */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Bem-vindo
              </h1>
              <p className="text-gray-400">
                Entre com suas credenciais para acessar o sistema
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Usuário
                </label>
                <Input
                  data-testid="input-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="h-14 bg-slate-800/60 border-slate-600/50 text-white placeholder:text-gray-500 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="h-14 bg-slate-800/60 border-slate-600/50 text-white placeholder:text-gray-500 rounded-xl pr-12 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <Button
                data-testid="btn-login"
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Sessão válida até meia-noite
              </p>
              <img 
                src="/bartz-logo.png" 
                alt="Bartz" 
                className="h-8 w-auto object-contain opacity-70"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
