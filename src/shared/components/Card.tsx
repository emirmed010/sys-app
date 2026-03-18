import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card = ({ className, children }: { className?: string, children: React.ReactNode }) => {
  return (
    <div className={twMerge(clsx('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className))}>
      {children}
    </div>
  );
};

export const CardHeader = ({ className, children }: { className?: string, children: React.ReactNode }) => {
  return (
    <div className={twMerge(clsx('px-6 py-4 border-b border-slate-100', className))}>
      {children}
    </div>
  );
};

export const CardTitle = ({ className, children }: { className?: string, children: React.ReactNode }) => {
  return (
    <h3 className={twMerge(clsx('text-lg font-bold text-slate-800 font-tajawal', className))}>
      {children}
    </h3>
  );
};

export const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => {
  return (
    <div className={twMerge(clsx('p-6', className))}>
      {children}
    </div>
  );
};
