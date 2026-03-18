import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
            <span>{label}</span>
            {error && <span className="text-rose-500 text-xs">{error}</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              "w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-lg text-sm text-slate-900 dark:text-slate-100 p-2.5",
              "focus:ring-2 focus:ring-primary/20 focus:outline-none transition-shadow",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              error && "ring-2 ring-rose-500/20 bg-rose-50/50 dark:bg-rose-900/10",
              className
            )
          )}
          {...props}
        />
        {hint && !error && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
