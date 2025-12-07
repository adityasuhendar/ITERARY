import { useEffect, useState } from 'react';
import { searchMembers } from '../../services/memberService';
import api from '../../utils/api';

function BorrowingForm({ open, onClose, onSubmit, editingBorrowing, errorMessage }) {
  const [memberName, setMemberName] = useState('');
  const [memberNim, setMemberNim] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [extensionDays, setExtensionDays] = useState('');
  const [error, setError] = useState('');
  const [memberOptions, setMemberOptions] = useState([]);
  const [bookOptions, setBookOptions] = useState([]);

  useEffect(() => {
    if (editingBorrowing) {
      setMemberName(editingBorrowing?.member?.name || '');
      setMemberNim(editingBorrowing?.member?.member_id || '');
      setBookTitle(editingBorrowing?.book?.title || '');
      setDurationDays('7');
      setExtensionDays('');
    } else {
      setMemberName('');
      setMemberNim('');
      setBookTitle('');
      setDurationDays('7');
      setExtensionDays('');
    }
    setError('');
  }, [editingBorrowing, open]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const members = await searchMembers('');
        setMemberOptions(members);
        const { data } = await api.get('/api/books', { params: { limit: 50 } });
        const books = data?.data?.books || data?.data || data || [];
        setBookOptions(books);
      } catch (e) {
        // ignore
      }
    };
    if (open) loadOptions();
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!memberName.trim() || !memberNim.trim() || !bookTitle.trim()) {
      setError('Nama, NIM, dan Judul Buku wajib diisi');
      return;
    }
    // Kirim NIM sebagai member_id (backend akan resolve NIM/ID), judul buku sebagai book_id (backend resolve title/ISBN/ID)
    const baseDuration = 7;
    const extra = parseInt(extensionDays || '0', 10);
    const payload = {
      member_id: memberNim.trim(),
      book_id: bookTitle.trim(),
      duration_days: baseDuration + (isNaN(extra) ? 0 : Math.max(0, extra))
    };
    onSubmit({ id: editingBorrowing?.id, payload });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{editingBorrowing ? 'Edit Borrowing' : 'Add Borrowing (Admin)'}</h3>
        <p className="text-slate-600 mb-4">{editingBorrowing ? 'Update data peminjaman.' : 'Masukkan Nama, NIM, dan Judul Buku. Durasi default 7 hari.'}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Nama</label>
            <input value={memberName} onChange={(e)=>setMemberName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">NIM</label>
            <input value={memberNim} onChange={(e)=>setMemberNim(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Judul Buku</label>
            <input value={bookTitle} onChange={(e)=>setBookTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Durasi (hari)</label>
            <input type="number" min="1" value={durationDays} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" />
            <p className="text-xs text-slate-500 mt-1">Default 7 hari. Untuk perpanjangan, isi field di bawah.</p>
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Perpanjangan (hari)</label>
            <input type="number" min="0" value={extensionDays} onChange={(e)=>setExtensionDays(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
            <p className="text-xs text-slate-500 mt-1">Opsional. Ditambahkan di atas 7 hari default.</p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {errorMessage && (
            <div className="text-sm text-red-600">
              {['Member not found', 'Book not found'].includes(errorMessage)
                ? 'Gagal membuat peminjaman. Periksa kembali NIM atau Judul Buku.'
                : errorMessage}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#1E88E5] text-white">{editingBorrowing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BorrowingForm;
