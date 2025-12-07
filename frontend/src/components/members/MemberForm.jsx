import { useEffect, useState } from 'react';

function MemberForm({ open, onClose, onSubmit, editingMember }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('Active');
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingMember) {
      setName(editingMember.name || '');
      setEmail(editingMember.email || '');
      setPhone(editingMember.phone || '');
      setStatus(editingMember.status || 'Active');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setStatus('Active');
    }
    setError('');
  }, [editingMember, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Nama dan email wajib diisi');
      return;
    }
    const payload = { name: name.trim(), email: email.trim(), phone: phone.trim(), status };
    onSubmit({ id: editingMember?.id, payload });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{editingMember ? 'Edit Member' : 'Add Member'}</h3>
        <p className="text-slate-600 mb-4">{editingMember ? 'Update member details.' : 'Enter new member details.'}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Nama</label>
            <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Nomor Telepon</label>
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Status</label>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none">
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#1E88E5] text-white">{editingMember ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MemberForm;