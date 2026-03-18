import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useOverlayStore } from '../../store/useAppStore';

export const MainLayout = () => {
  const { isLoading, loadingMessage } = useOverlayStore();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-70 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary mb-4"></div>
            <p className="text-slate-700 font-medium font-display">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
