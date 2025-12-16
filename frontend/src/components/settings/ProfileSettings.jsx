import { useEffect, useState } from 'react';
import { User, Mail, AtSign, Camera, Save, Loader2 } from 'lucide-react';

// Helper function to get full avatar URL
const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http')) return avatarPath;
  
  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://iterary-api-889794700120.asia-southeast2.run.app';
  
  return `${API_URL}${avatarPath}`;
};

function ProfileSettings({ data, loading, onSave }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (data) {
      setFullName(data.fullName || '');
      setUsername(data.username || '');
      setEmail(data.email || '');
      if (data.avatar_url) {
        setAvatarPreview(getAvatarUrl(data.avatar_url));
      }
    }
  }, [data]);

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSelect = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setError('Semua field wajib diisi');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError('Format email tidak valid');
      return;
    }

    setSaving(true);
    try {
      const result = await onSave({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        avatar
      });
      if (result !== false) {
        setSuccess('Profil berhasil disimpan!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="Masukkan nama lengkap"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <AtSign className="h-5 w-5 text-gray-400" />
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="Masukkan username"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="Masukkan email"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Foto Profil</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="object-cover w-full h-full" />
              ) : (
                <User className="h-8 w-8 text-blue-400" />
              )}
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white cursor-pointer shadow-md hover:shadow-lg">
              <Camera className="h-4 w-4" />
              Pilih Gambar
              <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
            </label>
            {avatar && <span className="text-sm text-slate-600">{avatar.name}</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Simpan Perubahan
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default ProfileSettings;
