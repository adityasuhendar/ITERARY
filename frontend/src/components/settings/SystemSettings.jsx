import { useEffect, useState } from 'react';

function SystemSettings({ data, loading, onSave }) {
  const [appName, setAppName] = useState('');
  const [maxBooks, setMaxBooks] = useState(3);
  const [borrowDurationDays, setBorrowDurationDays] = useState(7);
  const [maintenance, setMaintenance] = useState(false);
  const [logo, setLogo] = useState(null);

  useEffect(()=>{
    if (data) {
      setAppName(data.appName || 'ITERARY');
      setMaxBooks(data.maxBooks ?? 3);
      setBorrowDurationDays(data.borrowDurationDays ?? 7);
      setMaintenance(Boolean(data.maintenance));
    }
  }, [data]);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    if (file) setLogo(file);
  };
  const handleSelect = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) setLogo(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ appName, maxBooks, borrowDurationDays, maintenance, logo });
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg shadow-blue-100 p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center">
          <span className="material-icons">settings</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900">System Settings</h3>
          <p className="text-slate-600">Pengaturan inti aplikasi dan operasional perpustakaan.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nama Aplikasi</label>
          <input value={appName} onChange={(e)=>setAppName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Maksimal Buku</label>
            <input type="number" value={maxBooks} onChange={(e)=>setMaxBooks(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Durasi Peminjaman (hari)</label>
            <input type="number" value={borrowDurationDays} onChange={(e)=>setBorrowDurationDays(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input id="maintenanceSwitch" type="checkbox" checked={maintenance} onChange={(e)=>setMaintenance(e.target.checked)} className="peer appearance-none w-12 h-6 rounded-full bg-slate-200 transition-all checked:bg-blue-500 relative cursor-pointer" />
          <label htmlFor="maintenanceSwitch" className="text-sm text-slate-700">Maintenance Mode</label>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Logo Aplikasi</label>
          <div onDrop={handleDrop} onDragOver={(e)=>e.preventDefault()} className="border-2 border-dashed border-blue-300 rounded-2xl p-6 text-center bg-blue-50">
            <p className="text-slate-700">Tarik & letakkan gambar ke sini, atau</p>
            <label className="inline-block mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white cursor-pointer">Pilih Gambar
              <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
            </label>
            {logo && <p className="mt-3 text-sm text-slate-600">Dipilih: {logo.name}</p>}
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg">Simpan Pengaturan</button>
        </div>
      </form>
    </div>
  );
}

export default SystemSettings;
