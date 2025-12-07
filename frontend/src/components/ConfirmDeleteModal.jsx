
function ConfirmDeleteModal({ open, onClose, onConfirm, book }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl animate-fadeIn">
        <h3 className="text-lg font-semibold text-[#0D47A1]">Delete Book</h3>
        <p className="mt-2 text-gray-600">
          Are you sure you want to delete <span className="font-medium">{book?.title}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-white shadow-sm hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// JSDoc types for better editor hints
/**
 * @param {{
 *  open: boolean,
 *  onClose: () => void,
 *  onConfirm: () => void,
 *  book?: { id?: string|number, title?: string }
 * }} props
 */

export default ConfirmDeleteModal;
