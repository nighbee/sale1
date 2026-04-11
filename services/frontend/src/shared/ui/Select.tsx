import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  className,
  id,
  options,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'appearance-none block w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 dark:text-white transition-all duration-200',
          error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
          className
        )}
        id={id}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
