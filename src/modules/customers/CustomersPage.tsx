import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { CustomerForm } from './CustomerForm';
import { formatCurrency, formatDate } from '../../core/utils/formatters';

export const CustomersPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  const customers = useLiveQuery(() => 
    db.customers.orderBy('createdAt').reverse().toArray()
  , []);

  const filteredCustomers = customers?.filter(c => 
    c.name.includes(searchTerm) || 
    c.phone.includes(searchTerm)
  );

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الزبون ${name}؟`)) {
      await db.customers.delete(id);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">group</span>
            إدارة العملاء
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">سجل تفاصيل الزبائن، ديونهم، ومشترياتهم السابقة</p>
        </div>
        <button 
          onClick={() => { setEditingCustomer(undefined); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">person_add</span>
          إضافة عميل
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input 
              type="text"
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-slate-100" 
              placeholder="بحث بالاسم أو رقم الهاتف..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">معلومات الاتصال</th>
                <th className="px-6 py-4">الرصيد المالي (الديون)</th>
                <th className="px-6 py-4">تاريخ الإضافة</th>
                <th className="px-6 py-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!filteredCustomers && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
              )}
              {filteredCustomers && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">person_search</span>
                    <p>لا يوجد عملاء مسجلين</p>
                  </td>
                </tr>
              )}
              {filteredCustomers && filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg uppercase">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100">{customer.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-lg text-slate-400">call</span>
                      <span dir="ltr">{customer.phone}</span>
                    </div>
                    {customer.address && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                        <span>{customer.address}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold flex items-center gap-2">
                       {customer.balance > 0 ? (
                        <>
                          <span className="text-rose-600 dark:text-rose-400">{formatCurrency(customer.balance)}</span>
                          <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-sm">trending_up</span>
                        </>
                      ) : (
                        <span className="text-slate-400">لا يوجد ديون</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {formatDate(customer.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(customer)}
                        className="p-1.5 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" 
                        title="تعديل"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id, customer.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" 
                        title="حذف"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
      >
        <CustomerForm 
          customer={editingCustomer} 
          onSuccess={() => setIsModalOpen(false)} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>
    </>
  );
};
