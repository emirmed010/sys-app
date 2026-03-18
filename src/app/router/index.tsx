
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppRouteError } from './AppRouteError';
import { MainLayout } from '../../shared/layouts/MainLayout';
import { DashboardPage } from '../../modules/dashboard/DashboardPage';
import { CustomersPage } from '../../modules/customers/CustomersPage';
import { CustomerProfilePage } from '../../modules/customers/CustomerProfilePage';
import { ProductsPage } from '../../modules/products/ProductsPage';
import { ProductProfilePage } from '../../modules/products/ProductProfilePage';
import { OrdersPage } from '../../modules/orders/OrdersPage';
import { InvoicesPage } from '../../modules/invoices/InvoicesPage';
import { SettingsPage } from '../../modules/settings/SettingsPage';
import { SuppliersPage } from '../../modules/suppliers/SuppliersPage';
import { SupplierProfilePage } from '../../modules/suppliers/SupplierProfilePage';
import { PurchasesPage } from '../../modules/purchases/PurchasesPage';

import { InventoryPage } from '../../modules/inventory/InventoryPage';
import { ReportsPage } from '../../modules/reports/ReportsPage';
import { ServicesPage } from '../../modules/services/ServicesPage';
import { ServiceCategoryProfilePage } from '../../modules/services/ServiceCategoryProfilePage';
import { ServiceSubtypeProfilePage } from '../../modules/services/ServiceSubtypeProfilePage';
import { DebtAndPaymentsPage } from '../../modules/payments/DebtAndPaymentsPage';

const ComingSoonModule = ({ title, icon, desc }: { title: string, icon: string, desc: string }) => (
  <>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
          {title}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{desc}</p>
      </div>
    </div>
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-16 text-center mt-6">
      <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-800 block mb-4 drop-shadow-sm">construction</span>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">قريباً في التحديث القادم</h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">يجري حالياً تطوير هذه الوحدة لتقديم أفضل تجربة إدارة ممكنة. ستكون متاحة قريباً.</p>
    </div>
  </>
);

const Payments = () => <DebtAndPaymentsPage />;

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <AppRouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:customerId', element: <CustomerProfilePage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'suppliers/:supplierId', element: <SupplierProfilePage /> },
      { path: 'purchases', element: <PurchasesPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:productId', element: <ProductProfilePage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'services/categories/:categoryId', element: <ServiceCategoryProfilePage /> },
      { path: 'services/subtypes/:subtypeId', element: <ServiceSubtypeProfilePage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'payments', element: <Payments /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
