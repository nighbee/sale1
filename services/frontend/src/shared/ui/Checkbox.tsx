import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '../utils/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  error,
  className,
  id,
  ...props
}, ref) => {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 items-center">
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            'h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800 transition-colors cursor-pointer',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          id={id}
          {...props}
        />
      </div>
      {label && (
        <div className="text-sm leading-6">
          <label
            className={cn(
              'font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none',
              error && 'text-red-600 dark:text-red-400'
            )}
            htmlFor={id}
          >
            {label}
          </label>
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
