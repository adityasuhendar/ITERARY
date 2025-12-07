import api from '../utils/api';

export async function getBorrowings() {
  const { data } = await api.get('/api/borrowings');
  return data?.data ?? data;
}

export async function createBorrowing(payload) {
  // Admin creation endpoint expects { member_id, book_id, duration_days }
  const { data } = await api.post('/api/borrowings/admin', payload);
  return data?.data ?? data;
}

export async function updateBorrowing(id, payload) {
  const { data } = await api.put(`/api/borrowings/${id}`, payload);
  return data?.data ?? data;
}

export async function returnBorrowing(id) {
  const { data } = await api.put(`/api/borrowings/${id}/return`);
  return data?.data ?? data;
}

export async function deleteBorrowing(id) {
  const { data } = await api.delete(`/api/borrowings/${id}`);
  return data?.data ?? data;
}
