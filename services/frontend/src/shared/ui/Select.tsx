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
          className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-0.5"
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'appearance-none block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 dark:text-white transition-all duration-200 cursor-pointer',
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
        <span className="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">
          expand_more
        </span>
      </div>
      {error && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
