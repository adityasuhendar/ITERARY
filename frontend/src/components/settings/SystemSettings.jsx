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
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
      <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center">
        <label className="block text-sm font-medium text-slate-700 mb-1 md:mb-0 md:w-40">Logo Aplikasi</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center overflow-hidden">
            {logo ? (
              <img src={URL.createObjectURL(logo)} alt="Logo preview" className="object-cover w-full h-full" />
            ) : (
              <span className="text-blue-400 text-2xl font-bold">IT</span>
            )}
          </div>
          <label className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white cursor-pointer shadow-md hover:shadow-lg">
            Pilih Gambar
            <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
          </label>
          {logo && <span className="text-sm text-slate-600">{logo.name}</span>}
        </div>
      </div>
      <div className="md:col-span-2 flex justify-end mt-4">
        <button type="submit" className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg">Simpan Pengaturan</button>
      </div>
    </form>
  );
}

export default SystemSettings;
