import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    system: { appName: 'ITERARY', maxBooks: 3, borrowDurationDays: 7, maintenance: false, logo_url: null },
    profile: { fullName: 'Admin', username: 'admin', email: 'admin@itera.ac.id', avatar_url: null },
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await api.get('/api/settings');
      if (data.success) {
        setSettings({
          system: data.system || settings.system,
          profile: data.profile || settings.profile,
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const refreshSettings = () => {
    loadSettings();
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useGlobalSettings must be used within SettingsProvider');
  }
  return context;
}

export default SettingsContext;
