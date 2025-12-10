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
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
      <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center">
        <label className="block text-sm font-medium text-slate-700 mb-1 md:mb-0 md:w-40">Foto Profil</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center overflow-hidden">
            {avatar ? (
              <img src={URL.createObjectURL(avatar)} alt="Avatar preview" className="object-cover w-full h-full" />
            ) : (
              <span className="text-blue-400 text-2xl font-bold">A</span>
            )}
          </div>
          <label className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white cursor-pointer shadow-md hover:shadow-lg">
            Pilih Gambar
            <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
          </label>
          {avatar && <span className="text-sm text-slate-600">{avatar.name}</span>}
        </div>
      </div>
      <div className="md:col-span-2 flex justify-end mt-4">
        <button type="submit" className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg">Simpan Perubahan</button>
      </div>
    </form>
  );
}

export default ProfileSettings;
