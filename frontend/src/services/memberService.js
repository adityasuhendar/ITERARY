import api from '../utils/api';

export async function searchMembers(q = '') {
  const { data } = await api.get('/api/members', { params: { q } });
  return data?.data ?? [];
}

export async function getMembers() {
  const { data } = await api.get('/api/members');
  return data?.data ?? data;
}

export async function createMember(payload) {
  const { data } = await api.post('/api/members', payload);
  return data?.data ?? data;
}

export async function updateMember(id, payload) {
  const { data } = await api.put(`/api/members/${id}`, payload);
  return data?.data ?? data;
}

export async function deleteMember(id) {
  const { data } = await api.delete(`/api/members/${id}`);
  return data?.data ?? data;
}
