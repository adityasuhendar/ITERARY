import api from '../utils/api';

// All endpoints are under `/api`

export async function getCategories() {
  const { data } = await api.get('/api/categories');
  return data?.data ?? data;
}

export async function createCategory(payload) {
  const { data } = await api.post('/api/categories', payload);
  return data?.data ?? data;
}

export async function updateCategory(id, payload) {
  const { data } = await api.put(`/api/categories/${id}`, payload);
  return data?.data ?? data;
}

export async function deleteCategory(id) {
  const { data } = await api.delete(`/api/categories/${id}`);
  return data?.data ?? data;
}
