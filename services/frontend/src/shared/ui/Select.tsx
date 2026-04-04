import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[] | string[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option',
  disabled = false,
  isLoading = false,
  className = '',
}) => {
  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isLoading}
          className={`
            appearance-none block w-full px-4 py-2.5
            border border-slate-300 dark:border-slate-700
            rounded-xl shadow-sm
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            sm:text-sm bg-white dark:bg-slate-900 dark:text-white
            transition-all duration-200
            disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800
            hover:border-slate-400 dark:hover:border-slate-600
            cursor-pointer disabled:cursor-not-allowed
          `}
        >
          <option value="" disabled>{placeholder}</option>
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {/* Handle case where current value is not in options (e.g. legacy config) */}
          {value && !normalizedOptions.some(opt => opt.value === value) && (
             <option value={value}>{value}</option>
          )}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 group-hover:text-slate-500 transition-colors">
          {isLoading ? (
            <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></span>
          ) : (
            <span className="material-symbols-outlined text-xl">expand_more</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Select;
