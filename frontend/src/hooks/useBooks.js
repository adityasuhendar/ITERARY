import { useEffect, useMemo, useState } from 'react';
import { BooksApi } from '../api/booksApi';

export function useBooks() {
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const queryParams = useMemo(() => ({ page, pageSize, search, category }), [page, pageSize, search, category]);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await BooksApi.list(queryParams);
      console.log('📚 Books API Response:', response);

      // Backend returns: { success: true, data: { books: [...], pagination: {...} } }
      const data = response.data || response;
      const items = data.books || data.items || (Array.isArray(data) ? data : []);

      console.log('📖 Parsed books:', items);
      setBooks(items);
      setTotal(data.pagination?.total || data.total || items.length);
    } catch (err) {
      console.error('❌ Fetch books error:', err);
      setError(err);
      // Fallback demo data so UI tetap tampil ketika API bermasalah
      const demo = [
        { id: 'd1', title: 'Clean Code', author: 'Robert C. Martin', category: 'Technology', total_copies: 5, cover_url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=240&q=60' },
        { id: 'd2', title: 'Deep Work', author: 'Cal Newport', category: 'Non-Fiction', total_copies: 2, cover_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=240&q=60' },
        { id: 'd3', title: 'Sapiens', author: 'Yuval Noah Harari', category: 'History', total_copies: 0, cover_url: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=240&q=60' },
      ];
      setBooks(demo);
      setTotal(demo.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, category]);

  const openAddModal = () => {
    setEditingBook(null);
    setModalOpen(true);
  };

  const openEditModal = (book) => {
    setEditingBook(book);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBook(null);
  };

  const onCreate = async (payload) => {
    try {
      const response = await BooksApi.create(payload);
      console.log('✅ Book created:', response);
      closeModal();
      await fetchBooks(); // Wait for fetch to complete
      alert('Book created successfully!');
    } catch (error) {
      console.error('❌ Create book error:', error);
      // Re-throw error so modal can catch and display it
      throw error;
    }
  };

  const onUpdate = async (id, payload) => {
    await BooksApi.update(id, payload);
    closeModal();
    fetchBooks();
  };

  const onDelete = async (id) => {
    try {
      await BooksApi.remove(id);
      setConfirmDelete(null);
      await fetchBooks();
      alert('Book deleted successfully!');
    } catch (error) {
      console.error('❌ Delete book error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete book';
      alert(errorMessage);
    }
  };

  const pagination = {
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
  };

  const filters = {
    search,
    setSearch,
    category,
    setCategory,
  };

  const modals = {
    modalOpen,
    editingBook,
    openAddModal,
    openEditModal,
    closeModal,
    confirmDelete,
    setConfirmDelete,
  };

  return { books, loading, error, fetchBooks, pagination, filters, modals, onCreate, onUpdate, onDelete };
}

export default useBooks;
