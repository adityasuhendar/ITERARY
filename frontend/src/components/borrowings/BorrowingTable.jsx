import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

function StatusBadge({ status }) {
  const isReturned = status === 'Returned';
  const cls = isReturned ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200';
  return <span className={`inline-block text-xs px-2 py-1 rounded-lg border ${cls}`}>{status}</span>;
}

function BorrowingTable({ borrowings = [], loading, onEdit, onReturn, onDelete }) {
  const list = Array.isArray(borrowings) ? borrowings : [];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed">
        <thead>
          <tr className="bg-blue-50 text-slate-700">
            <th className="w-16 px-4 py-3 text-left">No</th>
            <th className="px-4 py-3 text-left">Nama Peminjam</th>
            <th className="px-4 py-3 text-left">Judul Buku</th>
            <th className="px-4 py-3 text-left">Tanggal Pinjam</th>
            <th className="px-4 py-3 text-left">Tanggal Kembali</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="w-56 px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td className="px-4 py-6" colSpan={7}>Loading...</td></tr>
          ) : list.length === 0 ? (
            <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No borrowings found.</td></tr>
          ) : (
            list.map((b, idx) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{idx + 1}</td>
                <td className="px-4 py-3 font-medium">{b.borrowerName}</td>
                <td className="px-4 py-3">{b.bookTitle}</td>
                <td className="px-4 py-3">{b.borrowedAt}</td>
                <td className="px-4 py-3">{b.returnedAt || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={()=>onEdit(b)} className="px-3 py-1.5 rounded-lg border border-blue-200 text-[#0D47A1] hover:bg-blue-50">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {b.status !== 'Returned' && (
                      <button onClick={()=>onReturn(b)} className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={()=>onDelete(b)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
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

export default BorrowingTable;
