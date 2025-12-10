import { useState } from 'react';

function SecuritySettings({ loading, onChangePassword }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const isStrong = (pwd) => pwd.length >= 8;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) { setError('Semua field wajib diisi'); return; }
    if (!isStrong(newPassword)) { setError('Password harus minimal 8 karakter'); return; }
    if (newPassword !== confirmPassword) { setError('Konfirmasi password tidak cocok'); return; }
    setError('');
    onChangePassword({ oldPassword, newPassword });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <label className="block text-sm text-slate-700 mb-1">Old Password</label>
          <input type="password" value={oldPassword} onChange={(e)=>setOldPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">New Password</label>
          <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
        </div>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end mt-4">
        <button type="submit" className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg">Change Password</button>
      </div>
    </form>
  );
}

export default SecuritySettings;
