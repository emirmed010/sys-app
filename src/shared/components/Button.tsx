import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: string | React.ElementType;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, icon, children, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 focus:ring-primary/20",
      secondary: "bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-sm focus:ring-slate-500",
      outline: "border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-slate-500",
      ghost: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-500",
      danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 focus:ring-rose-500"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-5 py-2.5 text-sm",
      lg: "px-8 py-3 text-base"
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading && (
          <span className="material-symbols-outlined animate-spin ml-2 text-lg">progress_activity</span>
        )}
        
        {!isLoading && icon && typeof icon === 'string' && (
          <span className="material-symbols-outlined ml-2 text-lg">{icon}</span>
        )}
        
        {!isLoading && icon && typeof icon !== 'string' && (
          React.createElement(icon, { className: "w-5 h-5 ml-2" })
        )}
        
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
