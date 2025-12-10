import api from '../utils/api';

export const BooksApi = {
  list: async (params = {}) => {
    const { page = 1, pageSize = 10, search = '', category = '' } = params;
    const res = await api.get('/api/books', { params: { page, pageSize, search, category } });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/api/books/${id}`);
    return res.data;
  },
  getCategories: async () => {
    const res = await api.get('/api/categories');
    return res.data;
  },
  getBookCategories: async () => {
    const res = await api.get('/api/books/categories');
    return res.data;
  },
  create: async (payload) => {
    const res = await api.post('/api/books', payload);
    return res.data;
  },
  update: async (id, payload) => {
    const res = await api.put(`/api/books/${id}`, payload);
    return res.data;
  },
  remove: async (id) => {
    const res = await api.delete(`/api/books/${id}`);
    return res.data;
  },
};

export default BooksApi;
