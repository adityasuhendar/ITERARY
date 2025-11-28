export default function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  className = "",
  inputMode,
  pattern,
  ...props
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-dwash-dark">
          {label} {required && <span className="text-dwash-red">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        pattern={pattern}
        className={`input-dwash ${className}`}
        {...props}
      />
    </div>
  )
}