import { useEffect, useMemo, useState } from 'react';
import { getMembers, createMember, updateMember, deleteMember } from '../services/memberService';

export default function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMembers();
      const list = Array.isArray(data) ? data : (data?.items || []);
      setMembers(list);
    } catch (e) {
      // Fallback demo data
      setMembers([
        { id: 1, name: 'Alice', email: 'alice@example.com', phone: '081234567890', registeredAt: '2024-01-10', status: 'Active' },
        { id: 2, name: 'Bob', email: 'bob@example.com', phone: '081987654321', registeredAt: '2024-02-05', status: 'Inactive' },
      ]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAddModal = () => { setEditingMember(null); setModalOpen(true); };
  const openEditModal = (m) => { setEditingMember(m); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const onCreate = async (payload) => {
    try { await createMember(payload); } catch (e) {}
    await load();
    closeModal();
  };

  const onUpdate = async (id, payload) => {
    try { await updateMember(id, payload); } catch (e) {}
    await load();
    closeModal();
  };

  const onDelete = async (id) => {
    try { await deleteMember(id); } catch (e) {}
    await load();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => (
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    ));
  }, [members, query]);

  const modals = useMemo(() => ({
    modalOpen,
    editingMember,
    openAddModal,
    openEditModal,
    closeModal,
    confirmDelete,
    setConfirmDelete,
  }), [modalOpen, editingMember, confirmDelete]);

  const search = useMemo(() => ({ query, setQuery }), [query]);

  return { members: filtered, loading, error, search, modals, onCreate, onUpdate, onDelete };
}
