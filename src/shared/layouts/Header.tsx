import React from 'react';

export const Header = () => {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <nav aria-label="Breadcrumb" className="flex text-sm font-medium text-slate-500 dark:text-slate-400">
          <ol className="inline-flex items-center space-x-reverse space-x-2">
            <li className="inline-flex items-center">
              <span className="text-slate-800 dark:text-slate-100 font-bold">الرئيسية</span>
            </li>
          </ol>
        </nav>
        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input className="w-full pr-10 pl-4 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400" placeholder="بحث..." type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined text-sm">cloud_done</span>
          <span>آخر نسخة: 10 دقائق</span>
        </div>
        <button className="p-2 text-slate-400 hover:text-primary dark:hover:text-slate-100 relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
        </button>
        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
        <div className="flex items-center gap-3">
          <div className="text-left rtl:text-right hidden sm:block">
            <p className="text-sm font-bold leading-none mb-1">عبدالله أحمد</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">مدير النظام</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center border-2 border-primary/20" data-alt="User profile avatar portrait" style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD_qOaCYfggTxzkBa72BGxA5kPOsnJqU7bHEs8b37ii1TPYkQPSVoiMV8GpZFWyREn6okRx2myZQpgBcGIIeEZj5x1xjHNkA3TZQY47UNy8MJ0hmtB4JUykS4doaHCmR8X0RndBHqzufABTnkSZ7P0EcKvWtWIy0DxzM0N6XtPGl01TgBClmiOal6IPkPVQ02GBIRB5lG2vDGCiWoPtVEGP2I-j2XarGiQ-PX_lNm7aLezUBtya3Tx4i7fZsXTHPhF-jQtynV_XDxE')"}}></div>
        </div>
      </div>
    </header>
  );
};
