import { Plus } from 'lucide-react';

function BorrowingActions({ onAdd }) {
  return (
    <button
      onClick={onAdd}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1E88E5] to-[#0D47A1] px-4 py-2 text-white shadow-md hover:shadow-lg"
    >
      <Plus className="h-4 w-4" /> Add Borrowing
    </button>
  );
}

export default BorrowingActions;
