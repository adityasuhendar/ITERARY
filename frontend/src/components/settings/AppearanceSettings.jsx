import { useEffect, useState } from 'react';

const palettes = [
  { name: 'Blue 1', primary: '#1E88E5', secondary: '#0D47A1' },
  { name: 'Blue 2', primary: '#2196F3', secondary: '#1565C0' },
  { name: 'Blue 3', primary: '#42A5F5', secondary: '#1976D2' },
];

function AppearanceSettings({ data, loading, onSave }) {
  const [themeIndex, setThemeIndex] = useState(0);

  useEffect(()=>{
    if (data) {
      setThemeIndex(data.themeIndex ?? 0);
    }
  }, [data]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ themeIndex });
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg shadow-blue-100 p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center">
          <span className="material-icons">palette</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Appearance Settings</h3>
          <p className="text-slate-600">Pilih palet warna dominan biru yang modern.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {palettes.map((p, idx) => (
            <label key={idx} className={`rounded-2xl p-4 border cursor-pointer transition shadow-sm ${themeIndex===idx?'border-blue-500 shadow-blue-100':'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-sm text-slate-600">Primary {p.primary}</div>
                </div>
                <input type="radio" name="palette" checked={themeIndex===idx} onChange={()=>setThemeIndex(idx)} />
              </div>
              <div className="mt-3 h-2 rounded-full" style={{background:p.primary}}></div>
              <div className="mt-1 h-2 rounded-full" style={{background:p.secondary}}></div>
            </label>
          ))}
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg">Simpan Tampilan</button>
        </div>
      </form>
    </div>
  );
}

export default AppearanceSettings;
