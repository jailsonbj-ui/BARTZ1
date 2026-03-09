import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, Eye, EyeOff, Truck } from "lucide-react";
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
      
      // Save to localStorage
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
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900" />
        
        {/* Animated Shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-emerald-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 -right-20 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-teal-500/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Wave Pattern */}
        <svg className="absolute bottom-0 left-0 right-0 text-emerald-800/30" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="currentColor" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Logo */}
          <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
            <img 
              src="/brambila-logo.png" 
              alt="Brambila" 
              className="h-32 w-auto object-contain drop-shadow-2xl"
            />
          </div>
          
          {/* Tagline */}
          <div className="text-center max-w-md">
            <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
              Gestão Inteligente de Frota
            </h2>
            <p className="text-emerald-100/90 text-lg leading-relaxed">
              Controle completo de abastecimento, rotas otimizadas e economia real para sua operação.
            </p>
          </div>
          
          {/* Features */}
          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div className="group">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <p className="text-white/80 text-sm font-medium">Rotas Otimizadas</p>
            </div>
            <div className="group">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-white/80 text-sm font-medium">Análise de Custos</p>
            </div>
            <div className="group">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-white/80 text-sm font-medium">Postos Mapeados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-900 relative">
        {/* Subtle Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2">
          <img 
            src="/brambila-logo.png" 
            alt="Brambila" 
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md px-8 py-12 relative z-10">
          {/* Welcome Text */}
          <div className="mb-10">
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
                className="h-14 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
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
                  className="h-14 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl pr-12 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
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
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 mt-4"
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
          <div className="mt-10 pt-6 border-t border-slate-800">
            <p className="text-center text-sm text-gray-500">
              Sessão válida até meia-noite
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
