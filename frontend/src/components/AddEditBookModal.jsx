import { useEffect, useState } from 'react';

function AddEditBookModal({ open, onClose, onSubmit, editingBook }) {
  const [form, setForm] = useState({
    title: '',
    author: '',
    category: '',
    isbn: '',
    total_copies: 1,
    cover_url: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editingBook) {
      setForm({
        title: editingBook.title || '',
        author: editingBook.author || '',
        category: editingBook.category || '',
        isbn: editingBook.isbn || '',
        total_copies: editingBook.total_copies ?? editingBook.totalCopies ?? 1,
        cover_url: editingBook.cover_url || editingBook.coverUrl || '',
      });
    } else {
      setForm({ title: '', author: '', category: '', isbn: '', total_copies: 1, cover_url: '' });
    }
  }, [editingBook]);

  const validate = () => {
    const e = {};
    if (!form.title) e.title = 'Title is required';
    if (!form.author) e.author = 'Author is required';
    if (!form.category) e.category = 'Category is required';
    if (!form.isbn) e.isbn = 'ISBN is required';
    if (form.total_copies === '' || form.total_copies == null || Number.isNaN(Number(form.total_copies))) e.total_copies = 'Total copies is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: key === 'total_copies' ? Number(value) : value }));
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (editingBook?.id) {
      onSubmit({ id: editingBook.id, data: form });
    } else {
      onSubmit({ data: form });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl animate-fadeIn">
        <h3 className="text-lg font-semibold text-[#0D47A1]">
          {editingBook ? 'Edit Book' : 'Add New Book'}
        </h3>
        <form onSubmit={submitForm} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Author</label>
            <input
              value={form.author}
              onChange={(e) => handleChange('author', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.author && <p className="mt-1 text-sm text-red-600">{errors.author}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">ISBN</label>
              <input
                value={form.isbn}
                onChange={(e) => handleChange('isbn', e.target.value)}
                className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {errors.isbn && <p className="mt-1 text-sm text-red-600">{errors.isbn}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Copies</label>
              <input
                type="number"
                min={0}
                value={form.total_copies}
                onChange={(e) => handleChange('total_copies', e.target.value)}
                className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {errors.total_copies && <p className="mt-1 text-sm text-red-600">{errors.total_copies}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cover Image URL</label>
            <input
              value={form.cover_url}
              onChange={(e) => handleChange('cover_url', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-[#1E88E5] px-4 py-2 text-white shadow-md hover:bg-[#0D47A1]">
              {editingBook ? 'Save Changes' : 'Create Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// JSDoc types for better editor hints
/**
 * @param {{
 *  open: boolean,
 *  onClose: () => void,
 *  onSubmit: (args: {id?: string|number, data: any}) => void,
 *  editingBook?: any
 * }} props
 */

export default AddEditBookModal;
