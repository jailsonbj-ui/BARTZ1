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
    <div className="min-h-screen relative">
      {/* Full Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/login-bg.png)' }}
      />
      
      {/* Dark overlay to obscure the original form in the image */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/40 to-black/95 lg:to-black/90" />

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-end">
        {/* Mobile: Centered form with overlay */}
        <div className="lg:hidden absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2 z-20">
          <img 
            src="/brambila-logo.png" 
            alt="Brambila" 
            className="h-14 w-auto object-contain drop-shadow-xl"
          />
        </div>

        {/* Form Panel - Right side */}
        <div className="w-full lg:w-[38%] xl:w-[35%] min-h-screen flex items-center justify-center bg-slate-950/95 lg:bg-slate-950 backdrop-blur-md lg:backdrop-blur-none">
          {/* Decorative vertical line on desktop */}
          <div className="hidden lg:block absolute left-0 top-1/4 bottom-1/4 w-px bg-gradient-to-b from-transparent via-emerald-500/40 to-transparent" />
          
          {/* Form Container */}
          <div className="w-full max-w-sm px-8 py-12">
            {/* Welcome Header */}
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-white mb-2">
                Bem-vindo
              </h2>
              <p className="text-gray-400 text-sm">
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
                  className="h-12 bg-slate-900/80 border-slate-700 text-white placeholder:text-gray-500 rounded-lg focus:border-emerald-500 focus:ring-emerald-500/20"
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
                    className="h-12 bg-slate-900/80 border-slate-700 text-white placeholder:text-gray-500 rounded-lg pr-12 focus:border-emerald-500 focus:ring-emerald-500/20"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                data-testid="btn-login"
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <LogIn className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Session Info */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Sessão válida até meia-noite
            </p>

            {/* Bartz Logo at bottom */}
            <div className="mt-12 flex justify-center">
              <img 
                src="/bartz-logo.png" 
                alt="Bartz" 
                className="h-10 w-auto object-contain opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
