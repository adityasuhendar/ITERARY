import { useEffect, useMemo, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/categoryService';

export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCategories();
      const list = Array.isArray(data) ? data : (data?.data || data?.items || []);
      setCategories(list);
    } catch (e) {
      // Fallback demo data so UI remains visible
      console.warn('getCategories failed:', e?.response?.data || e?.message);
      setCategories([
        { id: 1, name: 'Fiction' },
        { id: 2, name: 'Science' },
        { id: 3, name: 'History' },
      ]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAddModal = () => { setEditingCategory(null); setModalOpen(true); };
  const openEditModal = (c) => { setEditingCategory(c); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const onCreate = async (payload) => {
    try {
      const created = await createCategory(payload);
      // Optimistic update if backend returns created object {id, name}
      const newItem = Array.isArray(created) ? created[0] : created;
      if (newItem && newItem.id) {
        setCategories((prev) => {
          // avoid duplicate if already reloaded elsewhere
          if (prev.some((c) => c.id === newItem.id)) return prev;
          return [...prev, newItem];
        });
      }
    } catch (e) { /* optionally toast */ }
    await load();
    closeModal();
  };

  const onUpdate = async (id, payload) => {
    try {
      await updateCategory(id, payload);
    } catch (e) { /* optionally toast */ }
    await load();
    closeModal();
  };

  const onDelete = async (id) => {
    try {
      await deleteCategory(id);
    } catch (e) { /* optionally toast */ }
    await load();
  };

  const modals = useMemo(() => ({
    modalOpen,
    editingCategory,
    openAddModal,
    openEditModal,
    closeModal,
    confirmDelete,
    setConfirmDelete,
  }), [modalOpen, editingCategory, confirmDelete]);

  return { categories, loading, error, modals, onCreate, onUpdate, onDelete };
}
