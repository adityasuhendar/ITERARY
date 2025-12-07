import { useEffect, useMemo, useState } from 'react';
import { getSettings, updateSystemSettings, updateProfileSettings, updatePassword } from '../services/settingsService';

export default function useSettings() {
  const [settings, setSettings] = useState({
    system: { appName: 'ITERARY', maxBooks: 3, borrowDurationDays: 7, maintenance: false },
    profile: { fullName: 'Admin', username: 'admin', email: 'admin@example.com' },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSettings();
      setSettings({
        system: data.system || settings.system,
        profile: data.profile || settings.profile,
      });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateSystem = async (payload) => {
    try { await updateSystemSettings(payload); await load(); return true; }
    catch (e) { setError(e); return false; }
  };
  const updateProfile = async (payload) => {
    try { await updateProfileSettings(payload); await load(); return true; }
    catch (e) { setError(e); return false; }
  };
  const changePassword = async (payload) => {
    try { await updatePassword(payload); } catch (e) {}
  };

  const actions = useMemo(() => ({
    updateSystem,
    updateProfile,
    updatePassword: changePassword,
  }), []);

  return { settings, loading, error, actions };
}
