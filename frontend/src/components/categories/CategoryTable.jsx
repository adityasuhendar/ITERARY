import { Pencil, Trash2 } from 'lucide-react';

function CategoryTable({ categories = [], loading, onEdit, onDelete }) {
  const list = Array.isArray(categories) ? categories : [];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed">
        <thead>
          <tr className="bg-blue-50 text-slate-700">
            <th className="w-20 px-4 py-3 text-left">No</th>
            <th className="px-4 py-3 text-left">Nama Kategori</th>
            <th className="w-48 px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td className="px-4 py-6" colSpan={3}>Loading...</td></tr>
          ) : list.length === 0 ? (
            <tr><td className="px-4 py-6 text-slate-500" colSpan={3}>No categories found.</td></tr>
          ) : (
            list.map((c, idx) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{idx + 1}</td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={()=>onEdit(c)} className="px-3 py-1.5 rounded-lg border border-blue-200 text-[#0D47A1] hover:bg-blue-50">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={()=>onDelete(c)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default CategoryTable;
