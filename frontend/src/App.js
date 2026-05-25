import "@/App.css";
import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import FleetDashboard from "@/pages/FleetDashboard";
import LoginPage from "@/pages/LoginPage";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Storage keys constants
const STORAGE_KEYS = {
  TOKEN: "bartz_token",
  USER: "bartz_user",
  LOGIN_DATE: "bartz_login_date",
};

// Check if session is still valid (expires at midnight)
function isSessionValid() {
  const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
  const loginDate = sessionStorage.getItem(STORAGE_KEYS.LOGIN_DATE);
  
  if (!token) return false;
  
  // Check if login was today
  const today = new Date().toDateString();
  if (loginDate !== today) {
    // Session expired at midnight
    clearSession();
    return false;
  }
  
  return true;
}

// Clear session data
function clearSession() {
  sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.USER);
  sessionStorage.removeItem(STORAGE_KEYS.LOGIN_DATE);
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
    let isMounted = true;
    
    const checkSession = async () => {
      if (!isSessionValid()) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const storedToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
      const storedUser = sessionStorage.getItem(STORAGE_KEYS.USER);

      if (storedToken && storedUser) {
        try {
          // Validate token with backend
          const res = await axios.get(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          
          if (isMounted) {
            setUser(res.data);
            setToken(storedToken);
          }
        } catch {
          // Token invalid, clear storage
          clearSession();
        }
      }
      
      if (isMounted) setIsLoading(false);
    };

    checkSession();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle login
  const handleLogin = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
    sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    sessionStorage.setItem(STORAGE_KEYS.LOGIN_DATE, new Date().toDateString());
  }, []);

  // Handle logout
  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearSession();
  }, []);

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
