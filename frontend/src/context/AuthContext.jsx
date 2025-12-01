import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      // Check if user is logged in on mount
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      // --- FINAL FIX FOR JSON PARSE ERROR ---
      if (token && savedUser && savedUser !== 'undefined') { // Tambah Pengecekan String "undefined"
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          // Jika parsing gagal (data korup), kita hapus token dan biarkan user logout
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          console.error("Corrupted local storage data cleared:", e);
        }
      }
      setLoading(false);
    }, []);

const login = async (credentials, isMember = false) => {
    const endpoint = isMember ? '/api/auth/member-login' : '/api/auth/login';
    
    // FIX: Mapping input 'username' dari form ke payload 'email' yang dibutuhkan Backend
    const payload = isMember
      ? { username: credentials.username, password: credentials.password }
      : { username: credentials.username, password: credentials.password };

      
    const response = await api.post(endpoint, payload); // Menggunakan payload yang sudah di-mapping

    const { token, user } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);

    return user;
  };

  const register = async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    const { token, user } = response.data.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);

    return user;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isMember: user?.role === 'member',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
