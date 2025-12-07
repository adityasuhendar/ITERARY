import CategoryActions from '../components/categories/CategoryActions';
import CategoryTable from '../components/categories/CategoryTable';
import CategoryForm from '../components/categories/CategoryForm';
import useCategories from '../hooks/useCategories';

function ManageCategories() {
  const { categories, loading, modals, onCreate, onUpdate, onDelete } = useCategories();

  return (
      <div className="space-y-6 px-6 pt-6 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Dashboard / Manage Categories</div>
            <h1 className="text-2xl font-bold text-[#0D47A1]">Manage Categories</h1>
          </div>
          <CategoryActions onAdd={modals.openAddModal} />
        </div>

        <div className="rounded-2xl bg-white shadow-xl border border-slate-100">
          <CategoryTable 
            categories={categories}
            loading={loading}
            onEdit={modals.openEditModal}
            onDelete={(c)=>modals.setConfirmDelete(c)}
          />
        </div>

        <CategoryForm 
          open={modals.modalOpen}
          onClose={modals.closeModal}
          onSubmit={({ id, name }) => id ? onUpdate(id, { name }) : onCreate({ name })}
          editingCategory={modals.editingCategory}
        />

        {Boolean(modals.confirmDelete) && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Category</h3>
              <p className="text-slate-600 mb-4">Are you sure you want to delete <span className="font-medium">{modals.confirmDelete?.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <button onClick={()=>modals.setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
                <button onClick={()=>{ onDelete(modals.confirmDelete.id); modals.setConfirmDelete(null); }} className="px-4 py-2 rounded-lg bg-[#1E88E5] text-white">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default ManageCategories;
