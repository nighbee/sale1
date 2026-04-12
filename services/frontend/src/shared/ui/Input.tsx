import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  className,
  id,
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
      <input
        ref={ref}
        className={cn(
          'appearance-none block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 dark:text-white transition-all duration-200',
          error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
          className
        )}
        id={id}
        {...props}
      />
      {error && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
