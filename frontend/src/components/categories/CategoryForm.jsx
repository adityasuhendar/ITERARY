import { useEffect, useState } from 'react';

function CategoryForm({ open, onClose, onSubmit, editingCategory }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name || '');
    } else {
      setName('');
    }
    setError('');
  }, [editingCategory, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama kategori wajib diisi');
      return;
    }
    onSubmit({ id: editingCategory?.id, name: name.trim() });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-2">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
        <p className="text-sm text-slate-600 mb-3 md:mb-4">{editingCategory ? 'Update the category name.' : 'Enter a new category name.'}</p>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs md:text-sm text-slate-700 mb-1">Nama Kategori</label>
            <input
              value={name}
              onChange={(e)=>setName(e.target.value)}
              placeholder="e.g., Science"
              className="w-full border border-slate-200 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
            />
            {error && <div className="text-sm text-red-600 mt-1">{error}</div>}
          </div>
          <div className="flex justify-end gap-2 md:gap-3">
            <button type="button" onClick={onClose} className="px-3 md:px-4 py-1.5 md:py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button type="submit" className="px-3 md:px-4 py-1.5 md:py-2 text-sm rounded-lg bg-[#1E88E5] text-white">{editingCategory ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryForm;
