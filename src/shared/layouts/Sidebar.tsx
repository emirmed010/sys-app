import React from 'react';
import { NavLink } from 'react-router-dom';

type NavItem = {
  to: string;
  icon: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'لوحة القيادة' },
  { to: '/orders', icon: 'shopping_bag', label: 'الطلبات' },
  { to: '/customers', icon: 'group', label: 'العملاء' },
  { to: '/suppliers', icon: 'local_shipping', label: 'الموردون' },
  { to: '/purchases', icon: 'receipt_long', label: 'المشتريات' },
  { to: '/inventory', icon: 'inventory_2', label: 'المخزون والجرد' },
  { to: '/products', icon: 'precision_manufacturing', label: 'المنتجات' },
  { to: '/services', icon: 'design_services', label: 'الخدمات والأنواع' },
  { to: '/invoices', icon: 'description', label: 'الفواتير والمبيعات' },
  { to: '/payments', icon: 'account_balance_wallet', label: 'الديون والمدفوعات' },
  { to: '/reports', icon: 'bar_chart', label: 'التقارير' },
  { to: '/settings', icon: 'settings', label: 'الإعدادات' },
];

const activeClass = 'bg-primary text-white shadow-md shadow-primary/20';
const inactiveClass = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
          <span className="material-symbols-outlined text-[22px]">build</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-primary dark:text-slate-100 leading-tight">الورشة</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">إدارة المؤسسة</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all text-sm ${isActive ? activeClass : inactiveClass}`
            }
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <div className="text-center text-xs text-slate-400 dark:text-slate-600 py-1">
          ورشة الألمنيوم v1.0
        </div>
      </div>
    </aside>
  );
};
