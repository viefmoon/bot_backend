import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  as?: 'input' | 'textarea';
  rows?: number;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ label, error, hint, className, as = 'input', required, ...props }, ref) => {
    const Component = as;
    
    return (
      <div className="mb-4">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <strong>{label}</strong>
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {hint && (
          <p className="text-xs text-gray-600 mb-1">{hint}</p>
        )}
        <Component
          ref={ref as any}
          className={clsx(
            'w-full px-3 py-2 text-sm border rounded-md transition duration-200',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-red-500 text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';