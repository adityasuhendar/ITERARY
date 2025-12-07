import { useEffect, useMemo, useState } from 'react';
import { getBorrowings, createBorrowing, updateBorrowing, returnBorrowing, deleteBorrowing } from '../services/borrowingService';

export default function useBorrowings() {
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBorrowing, setEditingBorrowing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBorrowings();
      const arr = Array.isArray(data) ? data : (data?.borrowings || data?.data?.borrowings || []);
      // Map backend fields to UI shape expected by table
      const list = arr.map((b)=>({
        id: b.id,
        borrowerName: b.member?.name || b.member_name || 'Unknown',
        bookTitle: b.book?.title || b.book_title || 'Unknown',
        borrowedAt: b.borrow_date || b.borrowedAt || '',
        returnedAt: b.return_date || null,
        status: (b.status || '').toLowerCase() === 'returned' ? 'Returned' : 'Borrowed',
        member: b.member || { id: b.member?.id },
        book: b.book || { id: b.book?.id }
      }));
      setBorrowings(list);
    } catch (e) {
      // Fallback demo data
      setBorrowings([
        { id: 1, borrowerName: 'Alice', bookTitle: 'Fiction 101', borrowedAt: '2025-12-01', returnedAt: null, status: 'Borrowed' },
        { id: 2, borrowerName: 'Bob', bookTitle: 'Science Basics', borrowedAt: '2025-11-28', returnedAt: '2025-12-02', status: 'Returned' },
      ]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAddModal = () => { setEditingBorrowing(null); setModalOpen(true); };
  const openEditModal = (b) => { setEditingBorrowing(b); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const onCreate = async (payload) => {
    setSubmitError(null);
    try { await createBorrowing(payload); }
    catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Gagal membuat borrowing';
      setSubmitError(msg);
      return; // jangan tutup modal jika gagal
    }
    await load();
    closeModal();
  };

  const onUpdate = async (id, payload) => {
    try { await updateBorrowing(id, payload); } catch (e) {}
    await load();
    closeModal();
  };

  const onReturn = async (id) => {
    try { await returnBorrowing(id); } catch (e) {}
    await load();
  };

  const onDelete = async (id) => {
    try { await deleteBorrowing(id); } catch (e) {}
    await load();
  };

  const modals = useMemo(() => ({
    modalOpen,
    editingBorrowing,
    openAddModal,
    openEditModal,
    closeModal,
    confirmDelete,
    setConfirmDelete,
  }), [modalOpen, editingBorrowing, confirmDelete]);

  return { borrowings, loading, error, submitError, modals, onCreate, onUpdate, onReturn, onDelete };
}
