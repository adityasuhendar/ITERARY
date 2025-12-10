import { Plus } from 'lucide-react';
import BookSearchBar from '../components/BookSearchBar';
import BookFilter from '../components/BookFilter';
import BookTable from '../components/BookTable';
import AddEditBookModal from '../components/AddEditBookModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import useBooks from '../hooks/useBooks';

function ManageBooks() {
  const { books, loading, filters, pagination, modals, onCreate, onUpdate, onDelete } = useBooks();

  const handleSubmitModal = async ({ id, data }) => {
    try {
      // Remove cover_url from data before sending to backend
      const cleanData = { ...data };
      if ('cover_url' in cleanData) delete cleanData.cover_url;
      if (id) {
        await onUpdate(id, cleanData);
      } else {
        await onCreate(cleanData);
      }
    } catch (error) {
      // Extract error message from response
      const errorMessage = error.response?.data?.message || 'Failed to save book';
      alert(errorMessage);
      throw error; // Re-throw so modal knows to stay open
    }
  }

  return (
    <div className="space-y-6 px-0 py-0">
      {/* Breadcrumb and Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 pt-6">
        <div>
          <div className="text-sm text-gray-500">Dashboard / Manage Books</div>
          <h1 className="text-2xl font-bold text-[#0D47A1]">Manage Books</h1>
        </div>
        <button
          onClick={modals.openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1E88E5] to-[#0D47A1] px-4 py-2 text-white shadow-md hover:shadow-lg"
        >
          <Plus className="h-4 w-4" /> Add New Book
        </button>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6">
        <div className="sm:col-span-2">
          <BookSearchBar value={filters.search} onChange={filters.setSearch} onSubmit={() => {}} />
        </div>
        <BookFilter value={filters.category} onChange={filters.setCategory} />
      </div>

      {/* Table */}
      <div className="px-6">
      <BookTable
        books={books}
        loading={loading}
        onView={(b) => modals.openEditModal(b)}
        onEdit={(b) => modals.openEditModal(b)}
        onDelete={(b) => modals.setConfirmDelete(b)}
      />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-3 px-6 pb-6">
        <button
          disabled={pagination.page <= 1}
          onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}
          className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-[#0D47A1] disabled:opacity-50"
        >
          Prev
        </button>
        <div className="text-gray-600">Page {pagination.page}</div>
        <button
          disabled={books.length < pagination.pageSize}
          onClick={() => pagination.setPage(pagination.page + 1)}
          className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-[#0D47A1] disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Modals */}
      <AddEditBookModal
        open={modals.modalOpen}
        onClose={modals.closeModal}
        onSubmit={handleSubmitModal}
        editingBook={modals.editingBook}
      />

      <ConfirmDeleteModal
        open={Boolean(modals.confirmDelete)}
        onClose={() => modals.setConfirmDelete(null)}
        onConfirm={() => modals.confirmDelete && onDelete(modals.confirmDelete.id)}
        book={modals.confirmDelete}
      />
    </div>
  );
}

export default ManageBooks;
