import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { ProductForm } from './ProductForm';
import { formatCurrency, getUnitLabel } from '../../core/utils/formatters';
import { Product, InventoryItem } from '../../core/types';

export const ProductsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewProduct, setViewProduct] = useState<Product | undefined>();

  const products = useLiveQuery(() =>
    db.products.orderBy('createdAt').reverse().toArray()
  , []);

  const inventoryItems = useLiveQuery(() => db.inventory.toArray()) ?? [];
  const inventoryMap = Object.fromEntries(inventoryItems.map((i: InventoryItem) => [i.id, i]));

  const categories = [...new Set((products || []).map(p => p.categoryId).filter(Boolean))];

  const filtered = products?.filter(p => {
    const matchSearch = !searchTerm || p.name.includes(searchTerm) || p.code.includes(searchTerm);
    const matchCat = !filterCategory || p.categoryId === filterCategory;
    return matchSearch && matchCat;
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المنتج "${name}"؟`)) {
      await db.products.delete(id);
    }
  };

  const stats = {
    total: products?.length || 0,
    lowStock: products?.filter(p => p.quantity <= p.minStock && p.minStock > 0).length || 0,
    totalValue: products?.reduce((acc, p) => acc + (p.quantity * p.costPrice), 0) || 0,
    linkedToInventory: products?.filter(p => !!p.inventoryItemId).length || 0,
  };

  const handlePrintReport = () => {
    const rows = (products || []).map(p => {
      const inv = p.inventoryItemId ? inventoryMap[p.inventoryItemId] : null;
      return `<tr>
        <td>${p.code}</td><td>${p.name}</td><td>${p.categoryId || '-'}</td>
        <td>${getUnitLabel(p.unit)}</td><td>${formatCurrency(p.costPrice)}</td>
        <td>${formatCurrency(p.sellingPrice)}</td><td>${p.quantity}</td>
        <td>${inv ? inv.name : '-'}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
      <title>تقرير المنتجات</title>
      <style>body{font-family:Arial;direction:rtl;padding:20px}h1{font-size:20px;margin-bottom:4px}p.sub{color:#666;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
      th{background:#f1f5f9;font-weight:bold}tr:nth-child(even){background:#f8fafc}</style></head>
      <body><h1>دليل المنتجات</h1><p class="sub">${new Date().toLocaleDateString('ar-SA')} | الإجمالي: ${stats.total} منتج</p>
      <table><thead><tr><th>الكود</th><th>الاسم</th><th>التصنيف</th><th>الوحدة</th><th>سعر التكلفة</th><th>سعر البيع</th><th>الكمية</th><th>صنف المخزون</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">precision_manufacturing</span>
            دليل المنتجات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">إدارة المنتجات والمواد القابلة للبيع والاستخدام في الطلبات</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrintReport}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">print</span>
            طباعة التقرير
          </button>
          <button
            onClick={() => { setEditingProduct(undefined); setIsModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            إضافة منتج
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">category</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي المنتجات</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">منتجات نقص المخزون</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.lowStock}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">قيمة المخزون (تكلفة)</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">link</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">مرتبط بالمخزون</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.linkedToInventory}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              type="text"
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder:text-slate-400 dark:text-slate-100"
              placeholder="بحث باسم المنتج أو الكود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none dark:text-slate-100"
            >
              <option value="">كل التصنيفات</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">
              <tr>
                <th className="px-6 py-4">الكود / المنتج</th>
                <th className="px-6 py-4">التصنيف</th>
                <th className="px-6 py-4">الوحدة</th>
                <th className="px-6 py-4">سعر التكلفة</th>
                <th className="px-6 py-4">سعر البيع</th>
                <th className="px-6 py-4">الكمية</th>
                <th className="px-6 py-4">صنف المخزون</th>
                <th className="px-6 py-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!filtered && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">جاري التحميل...</td></tr>
              )}
              {filtered && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-3">inventory_2</span>
                    <p className="text-slate-500 dark:text-slate-400">لا توجد منتجات مطابقة للبحث</p>
                    <button
                      onClick={() => { setEditingProduct(undefined); setIsModalOpen(true); }}
                      className="mt-4 text-primary text-sm font-bold hover:underline"
                    >
                      + إضافة منتج جديد
                    </button>
                  </td>
                </tr>
              )}
              {filtered && filtered.map(product => (
                <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">widgets</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{product.name}</div>
                        <div className="text-xs text-slate-400 font-mono" dir="ltr">{product.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {product.categoryId ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {product.categoryId}
                      </span>
                    ) : <span className="text-slate-400 text-sm">-</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {getUnitLabel(product.unit)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {formatCurrency(product.costPrice)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-primary">
                    {formatCurrency(product.sellingPrice)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                      product.minStock > 0 && product.quantity <= product.minStock
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {product.quantity} {getUnitLabel(product.unit)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.inventoryItemId && inventoryMap[product.inventoryItemId] ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <span className="material-symbols-outlined text-[14px]">link</span>
                        {inventoryMap[product.inventoryItemId].name}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => setViewProduct(product)}
                        className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                        title="عرض التفاصيل"
                      >
                        <span className="material-symbols-outlined text-xl">visibility</span>
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(product.id, product.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
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
        title={editingProduct ? `تعديل: ${editingProduct.name}` : 'إضافة منتج جديد'}
        width="lg"
      >
        <ProductForm
          product={editingProduct}
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* View Details Modal */}
      {viewProduct && (
        <Modal
          isOpen={!!viewProduct}
          onClose={() => setViewProduct(undefined)}
          title={`تفاصيل المنتج: ${viewProduct.name}`}
          width="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'كود المنتج', value: viewProduct.code, mono: true },
                { label: 'التصنيف', value: viewProduct.categoryId || '—' },
                { label: 'الوحدة', value: getUnitLabel(viewProduct.unit) },
                { label: 'الكمية الحالية', value: `${viewProduct.quantity} ${getUnitLabel(viewProduct.unit)}` },
                { label: 'سعر التكلفة', value: formatCurrency(viewProduct.costPrice) },
                { label: 'سعر البيع', value: formatCurrency(viewProduct.sellingPrice) },
                { label: 'حد الإنذار', value: viewProduct.minStock > 0 ? viewProduct.minStock.toString() : '—' },
                { label: 'صنف المخزون', value: viewProduct.inventoryItemId && inventoryMap[viewProduct.inventoryItemId] ? inventoryMap[viewProduct.inventoryItemId].name : '—' },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                  <p className={`text-sm font-bold text-slate-800 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
            {viewProduct.notes && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">ملاحظات</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{viewProduct.notes}</p>
              </div>
            )}
            {viewProduct.minStock > 0 && viewProduct.quantity <= viewProduct.minStock && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-700 dark:text-amber-400 text-sm">
                <span className="material-symbols-outlined text-xl">warning</span>
                تحذير: الكمية المتوفرة أقل من أو تساوي حد الإنذار
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setViewProduct(undefined); handleEdit(viewProduct); }}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                تعديل
              </button>
              <button
                onClick={() => setViewProduct(undefined)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
