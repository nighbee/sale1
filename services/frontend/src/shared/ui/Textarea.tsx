import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
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
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'appearance-none block w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 dark:text-white transition-all duration-200 resize-none',
          error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
          className
        )}
        id={id}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
