import { useEffect, useState } from 'react';

function ProfileSettings({ data, loading, onSave }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [error, setError] = useState('');

  useEffect(()=>{
    if (data) {
      setFullName(data.fullName || '');
      setUsername(data.username || '');
      setEmail(data.email || '');
    }
  }, [data]);

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    if (file) setAvatar(file);
  };
  const handleSelect = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) setAvatar(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !email.trim()) { setError('Semua field wajib diisi'); return; }
    if (!isValidEmail(email.trim())) { setError('Format email tidak valid'); return; }
    setError('');
    onSave({ fullName: fullName.trim(), username: username.trim(), email: email.trim(), avatar });
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg shadow-blue-100 p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center">
          <span className="material-icons">person</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Profile Settings</h3>
          <p className="text-slate-600">Pengaturan identitas admin dan foto profil.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
          <input value={fullName} onChange={(e)=>setFullName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Foto Profil</label>
          <div onDrop={handleDrop} onDragOver={(e)=>e.preventDefault()} className="border-2 border-dashed border-blue-300 rounded-2xl p-6 text-center bg-blue-50">
            <p className="text-slate-700">Tarik & letakkan gambar ke sini, atau</p>
            <label className="inline-block mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white cursor-pointer">Pilih Gambar
              <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
            </label>
            {avatar && <p className="mt-3 text-sm text-slate-600">Dipilih: {avatar.name}</p>}
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg">Simpan Perubahan</button>
        </div>
      </form>
    </div>
  );
}

export default ProfileSettings;
