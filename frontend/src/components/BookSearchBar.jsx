
function BookSearchBar({ value, onChange, onSubmit }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="flex flex-col sm:flex-row gap-3 items-stretch"
    >
      <input
        type="text"
        placeholder="Search by title, author, ISBN"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-blue-200 bg-white/90 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
      />
      <button
        type="submit"
        className="rounded-lg px-5 py-2 bg-gradient-to-r from-[#1E88E5] to-[#0D47A1] text-white shadow-md hover:shadow-lg transition"
      >
        Search
      </button>
    </form>
  );
}

/**
 * @param {{
 *  value: string,
 *  onChange: (v: string) => void,
 *  onSubmit?: () => void
 * }} props
 */

export default BookSearchBar;
