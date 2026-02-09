import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { logActivity } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  login: (user: User, token: string, rememberMe: boolean) => void;
  logout: () => void;
  loading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let storedUser: string | null = null;
    let storedToken: string | null = null;
    
    // Check localStorage first for "Remember me" session
    storedUser = localStorage.getItem('user');
    storedToken = localStorage.getItem('token');

    // If not in localStorage, check sessionStorage for regular session
    if (!storedUser || !storedToken) {
      storedUser = sessionStorage.getItem('user');
      storedToken = sessionStorage.getItem('token');
    }

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (error) {
        console.error("Failed to parse user from storage", error);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData: User, token: string, rememberMe: boolean) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(userData));
    storage.setItem('token', token);
    
    // Clear the other storage to avoid conflicts
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem('user');
    otherStorage.removeItem('token');

    setUser(userData);
    setToken(token);
    logActivity(userData.username, 'Logged in');
  };

  const logout = () => {
    if(user) {
      logActivity(user.username, 'Logged out');
    }
    // Clear from both storages on logout
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('rememberedUser'); // Also clear remembered username
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};