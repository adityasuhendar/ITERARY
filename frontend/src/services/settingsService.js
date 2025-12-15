import api from '../utils/api';

export async function getSettings() {
  const { data } = await api.get('/api/settings');
  return data;
}

export async function updateSystemSettings(payload) {
  // If logo (File) provided, send as multipart/form-data
  if (payload && payload.logo instanceof File) {
    const form = new FormData();
    if (payload.appName) form.append('appName', payload.appName);
    if (payload.maxBooks !== undefined) form.append('maxBooks', payload.maxBooks);
    if (payload.borrowDurationDays !== undefined) form.append('borrowDurationDays', payload.borrowDurationDays);
    if (payload.maintenance !== undefined) form.append('maintenance', payload.maintenance);
    form.append('logo', payload.logo);
    const { data } = await api.put('/api/settings/system', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }
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
