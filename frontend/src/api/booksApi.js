import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: `${baseURL}/api`,
});

export const BooksApi = {
  list: async (params = {}) => {
    const { page = 1, pageSize = 10, search = '', category = '' } = params;
    const res = await api.get('/books', { params: { page, pageSize, search, category } });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/books/${id}`);
    return res.data;
  },
  create: async (payload) => {
    const res = await api.post('/books', payload);
    return res.data;
  },
  update: async (id, payload) => {
    const res = await api.put(`/books/${id}`, payload);
    return res.data;
  },
  remove: async (id) => {
    const res = await api.delete(`/books/${id}`);
    return res.data;
  },
};

export default BooksApi;
