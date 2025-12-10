import BookRow from './BookRow';

function BookTable({ books, loading, onView, onEdit, onDelete }) {
  const list = Array.isArray(books) ? books : [];
  if (loading) {
    return (
      <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-6 rounded bg-[#E3F2FD]" />
          ))}
        </div>
      </div>
    );
  }

  if (!list || list.length === 0) {
    return (
      <div className="rounded-xl border border-blue-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-16 w-16 rounded-full bg-[#E3F2FD]" />
        <h3 className="mt-4 text-lg font-semibold text-[#0D47A1]">No books found</h3>
        <p className="text-gray-600">Try adjusting filters or add a new book.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-blue-100 bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="sticky top-0 bg-[#E3F2FD]">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[#0D47A1]">Cover</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[#0D47A1]">Title</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[#0D47A1]">Category</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[#0D47A1]">Stock</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[#0D47A1]">Availability</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[#0D47A1]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((b, idx) => (
            <BookRow key={b.id || idx} book={b} index={idx} onView={onView} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * @param {{
 *  books: any[],
 *  loading?: boolean,
 *  onView: (book:any)=>void,
 *  onEdit: (book:any)=>void,
 *  onDelete: (book:any)=>void
 * }} props
 */

export default BookTable;
