import api from '../utils/api';

export async function getSettings() {
  const { data } = await api.get('/api/settings');
  return data;
}

export async function updateSystemSettings(payload) {
  // JSON payload only; ignore file objects here
  const { data } = await api.put('/api/settings/system', payload);
  return data;
}

export async function updateProfileSettings(payload) {
  // If avatar (File) provided, send as multipart/form-data
  if (payload && payload.avatar instanceof File) {
    const form = new FormData();
    if (payload.fullName) form.append('fullName', payload.fullName);
    if (payload.username) form.append('username', payload.username);
    if (payload.email) form.append('email', payload.email);
    form.append('avatar', payload.avatar);
    const { data } = await api.put('/api/settings/profile', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }
  const { data } = await api.put('/api/settings/profile', payload);
  return data;
}

export async function updateAppearanceSettings(payload) {
  const { data } = await api.put('/api/settings/appearance', payload);
  return data;
}

export async function updatePassword(payload) {
  const { data } = await api.put('/api/settings/security/password', payload);
  return data;
}
