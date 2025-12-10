import { formatAvailability } from '../utils/formatters';
import { Info, Pencil, Trash } from 'lucide-react';

function BookRow({ book, onView, onEdit, onDelete, index }) {
  return (
    <tr
      className={`${index % 2 === 0 ? 'bg-[#F5FAFF]' : 'bg-white'} hover:shadow-sm transition`}
    >
      <td className="px-4 py-3">
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} className="h-12 w-9 rounded-md object-cover" />
        ) : (
          <div className="h-12 w-9 rounded-md bg-[#E3F2FD]" />
        )}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{book.title}</div>
        <div className="text-sm text-gray-500">{book.author}</div>
      </td>
      <td className="px-4 py-3 text-gray-700">{book.category || '-'}</td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-gray-900">
          {book.available_copies ?? 0} / {book.total_copies ?? 0}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${(book.available_copies ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {(book.available_copies ?? 0) > 0 ? 'Available' : 'Unavailable'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1 text-[#0D47A1] hover:bg-[#E3F2FD]"
            onClick={() => onView(book)}
            title="View"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1 text-[#0D47A1] hover:bg-[#E3F2FD]"
            onClick={() => onEdit(book)}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50"
            onClick={() => onDelete(book)}
            title="Delete"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * @param {{
 *  index: number,
 *  book: { id?: any, title?: string, author?: string, category?: string, cover_url?: string, total_copies?: number },
 *  onView: (book:any)=>void,
 *  onEdit: (book:any)=>void,
 *  onDelete: (book:any)=>void
 * }} props
 */

export default BookRow;
