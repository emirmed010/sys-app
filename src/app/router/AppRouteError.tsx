import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

export const AppRouteError = () => {
  const error = useRouteError();

  let title = 'حدث خطأ غير متوقع';
  let message = 'تعذر فتح الصفحة المطلوبة حالياً. حاول إعادة المحاولة أو الرجوع إلى الصفحة الرئيسية.';

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? 'الصفحة غير موجودة' : `خطأ ${error.status}`;
    message = typeof error.data === 'string' && error.data.trim().length > 0
      ? error.data
      : message;
  } else if (error instanceof Error && error.message.trim().length > 0) {
    message = error.message;
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-3xl">error</span>
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 leading-7 mb-6">{message}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-primary/20"
          >
            العودة إلى الرئيسية
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      </div>
    </div>
  );
};