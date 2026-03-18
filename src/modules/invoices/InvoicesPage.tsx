import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../shared/components/Modal';
import { InvoiceForm } from './InvoiceForm';
import { formatCurrency, formatDate } from '../../core/utils/formatters';
import { db } from '../../data/db';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'issued': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'paid': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'cancelled': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'draft': return 'مسودة';
    case 'issued': return 'مُصدرة';
    case 'paid': return 'خالصة الدفع';
    case 'cancelled': return 'ملغاة';
    default: return status;
  }
};

export const InvoicesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  const invoices = useLiveQuery(async () => {
    const allInvoices = await db.invoices.orderBy('createdAt').reverse().toArray();
    
    const result = await Promise.all(allInvoices.map(async (invoice) => {
      const customer = await db.customers.get(invoice.customerId);
      const items = await db.invoiceItems.where('invoiceId').equals(invoice.id).toArray();
      return { ...invoice, customerName: customer?.name || 'عميل محذوف', items };
    }));

    if (searchTerm) {
      return result.filter(i => 
        i.customerName.includes(searchTerm) || 
        i.invoiceNumber.toString().includes(searchTerm)
      );
    }
    
    return result;
  }, [searchTerm]);

  const handleEdit = (invoice: any) => {
    setEditingInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, invNum: number) => {
    if (window.confirm(`تأكيد حذف الفاتورة رقم ${invNum}؟ انتبه: لن يتم إرجاع المخزون تلقائياً.`)) {
      await db.transaction('rw', [db.invoices, db.invoiceItems], async () => {
        await db.invoices.delete(id);
        await db.invoiceItems.where('invoiceId').equals(id).delete();
      });
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
            الفواتير والمبيعات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">إصدار الفواتير وتحصيل المبيعات النهائية للعملاء</p>
        </div>
        <button 
          onClick={() => { setEditingInvoice(undefined); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">note_add</span>
          إصدار فاتورة
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
              placeholder="بحث برقم الفاتورة أو العميل..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-4">الرقم</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الإجمالي</th>
                <th className="px-6 py-4">الباقي للدفع</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!invoices && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
              )}
              {invoices && invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">receipt</span>
                    <p>لا توجد فواتير مسجلة</p>
                  </td>
                </tr>
              )}
              {invoices && invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary dark:text-primary">
                    <span dir="ltr">#{inv.invoiceNumber}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{inv.customerName}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm font-medium">{formatDate(inv.date)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-100 font-bold">{formatCurrency(inv.total)}</td>
                  <td className="px-6 py-4">
                    {inv.remaining > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(inv.remaining)}</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrapflex items-center gap-1">
                        خالصة
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1">
                      <button className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="طباعة">
                        <span className="material-symbols-outlined text-xl">print</span>
                      </button>
                      <button onClick={() => handleEdit(inv)} className="p-1.5 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="تعديل">
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                      <button onClick={() => handleDelete(inv.id, inv.invoiceNumber)} className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="حذف">
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
        title={editingInvoice ? `تعديل الفاتورة #${editingInvoice.invoiceNumber}` : "إصدار فاتورة جديدة"}
        width="lg"
      >
        <InvoiceForm 
          invoice={editingInvoice} 
          onSuccess={() => setIsModalOpen(false)} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>
    </>
  );
};
