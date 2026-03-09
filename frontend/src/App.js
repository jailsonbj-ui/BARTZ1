import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import FleetDashboard from "@/pages/FleetDashboard";
import LoginPage from "@/pages/LoginPage";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Check if session is still valid (expires at midnight)
function isSessionValid() {
  const token = localStorage.getItem("bartz_token");
  const loginDate = localStorage.getItem("bartz_login_date");
  
  if (!token) return false;
  
  // Check if login was today
  const today = new Date().toDateString();
  if (loginDate !== today) {
    // Session expired at midnight
    localStorage.removeItem("bartz_token");
    localStorage.removeItem("bartz_user");
    localStorage.removeItem("bartz_login_date");
    return false;
  }
  
  return true;
}

// Protected Route wrapper
function ProtectedRoute({ children, user }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      if (!isSessionValid()) {
        setIsLoading(false);
        return;
      }

      const storedToken = localStorage.getItem("bartz_token");
      const storedUser = localStorage.getItem("bartz_user");

      if (storedToken && storedUser) {
        try {
          // Validate token with backend
          const res = await axios.get(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          
          setUser(res.data);
          setToken(storedToken);
        } catch (error) {
          // Token invalid, clear storage
          console.error("Session validation failed:", error);
          localStorage.removeItem("bartz_token");
          localStorage.removeItem("bartz_user");
          localStorage.removeItem("bartz_login_date");
        }
      }
      
      setIsLoading(false);
    };

    checkSession();
  }, []);

  // Handle login
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("bartz_login_date", new Date().toDateString());
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("bartz_token");
    localStorage.removeItem("bartz_user");
    localStorage.removeItem("bartz_login_date");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute user={user}>
                <FleetDashboard 
                  user={user} 
                  token={token} 
                  onLogout={handleLogout} 
                />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
