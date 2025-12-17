import { useEffect, useState } from 'react';
import { BooksApi } from '../api/booksApi';

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
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (editingBook) {
      setForm({
        title: editingBook.title || '',
        author: editingBook.author || '',
        category: editingBook.category || '',
        isbn: editingBook.isbn || '',
        total_copies: editingBook.total_copies ?? editingBook.totalCopies ?? 1,
        cover_url: editingBook.cover_url || '',
      });
    } else {
      setForm({ title: '', author: '', category: '', isbn: '', total_copies: 1, cover_url: '' });
    }
  }, [editingBook]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await BooksApi.getCategories();
        console.log('📂 Categories API Response:', response);
        const data = response.data || response;
        let categoryList = [];
        if (Array.isArray(data)) {
          categoryList = data.map(cat => cat.name || cat);
        } else if (data.categories && Array.isArray(data.categories)) {
          categoryList = data.categories;
        } else {
          categoryList = [];
        }
        console.log('📋 Parsed categories:', categoryList);
        setCategories(categoryList);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategories(['Fiction', 'Non-Fiction', 'Technology', 'History', 'Science', 'General']);
      }
    };

    if (open) {
      fetchCategories();
    }
  }, [open]);

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

  const submitForm = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (editingBook?.id) {
        await onSubmit({ id: editingBook.id, data: form });
      } else {
        await onSubmit({ data: form });
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-4 md:p-6 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-semibold text-[#0D47A1]">
          {editingBook ? 'Edit Book' : 'Add New Book'}
        </h3>
        <form onSubmit={submitForm} className="mt-3 md:mt-4 space-y-3 md:space-y-4">
          {/* Cover URL Input with Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Cover Image URL</label>
            <input
              type="url"
              placeholder="https://example.com/book-cover.jpg"
              value={form.cover_url}
              onChange={(e) => handleChange('cover_url', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {form.cover_url && (
              <div className="mt-2 flex justify-center">
                <img 
                  src={form.cover_url} 
                  alt="Cover preview" 
                  className="h-32 w-24 object-cover rounded-lg border border-gray-200"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  onLoad={(e) => { e.target.style.display = 'block'; }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">Title</label>
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-2 md:px-3 py-1.5 md:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <select
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Select a category</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
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

export default AddEditBookModal;