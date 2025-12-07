import { categories } from '../utils/formatters';

function BookFilter({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-blue-200 bg-white/90 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
      >
        {categories.map((c) => (
          <option key={c} value={c === 'All' ? '' : c}>
            {c}
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
