import useCategories from '../hooks/useCategories';

function BookFilter({ value, onChange }) {
  const { categories: catList, loading } = useCategories();

  // categories from hook are objects like {id, name}
  const options = Array.isArray(catList) && catList.length > 0
    ? [{ id: '__all', name: 'All' }, ...catList]
    : [{ id: '__all', name: 'All' }];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-blue-200 bg-white/90 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
      >
        {options.map((c) => (
          <option key={c.id ?? c.name} value={c.id === '__all' ? '' : c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * @param {{
 *  value: string,
 *  onChange: (v: string) => void
 * }} props
 */

export default BookFilter;
