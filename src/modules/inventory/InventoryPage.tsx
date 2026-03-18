import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { InventoryItemForm } from './InventoryItemForm';
import { formatCurrency, formatDate, getUnitLabel, generateId } from '../../core/utils/formatters';
import { InventoryItem, StockMovement } from '../../core/types';

// ─── Stock Movement Modal (IN / OUT / COUNT) ──────────────────────────────────
type MovementMode = 'in' | 'out' | 'count';
interface StockMoveModalProps {
  item: InventoryItem;
  mode: MovementMode;
  onClose: () => void;
}
const StockMoveModal = ({ item, mode, onClose }: StockMoveModalProps) => {
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const title = mode === 'in' ? 'إضافة كمية' : mode === 'out' ? 'خصم كمية' : 'جرد — تحديث الكمية الفعلية';
  const label = mode === 'count' ? 'الكمية الفعلية (الجرد)' : mode === 'in' ? 'الكمية المضافة' : 'الكمية المخصومة';

  const handleSave = async () => {
    const amount = parseFloat(qty);
    if (isNaN(amount) || amount < 0) { alert('أدخل كمية صحيحة'); return; }
    if (mode === 'out' && amount > item.quantity) { alert('الكمية المخصومة أكبر من المخزون الحالي'); return; }
    setSaving(true);
    try {
      await db.transaction('rw', [db.inventory, db.stockMovements], async () => {
        let newQty: number;
        let movementType: StockMovement['type'];
        let movementQty: number;

        if (mode === 'in') {
          newQty = item.quantity + amount;
          movementType = 'in';
          movementQty = amount;
        } else if (mode === 'out') {
          newQty = item.quantity - amount;
          movementType = 'out';
          movementQty = amount;
        } else {
          // count — record the diff as adjustment
          movementQty = amount - item.quantity;
          newQty = amount;
          movementType = 'adjustment';
        }

        await db.inventory.update(item.id, { quantity: newQty });
        await db.stockMovements.add({
          id: generateId(),
          itemId: item.id,
          type: movementType,
          quantity: movementQty,
          notes: notes || undefined,
          date,
          createdAt: Date.now(),
        });
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تسجيل الحركة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-sm space-y-1">
        <div className="text-slate-600 dark:text-slate-300">الصنف: <span className="font-bold text-slate-800 dark:text-slate-100">{item.name}</span></div>
        <div className="text-slate-600 dark:text-slate-300">الكمية الحالية: <span className="font-bold">{item.quantity} {getUnitLabel(item.unit)}</span></div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label} *</label>
        <input
          type="number" min="0" step="0.001"
          value={qty} onChange={e => setQty(e.target.value)} autoFocus
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {mode === 'count' && qty && !isNaN(parseFloat(qty)) && (
          <p className={`text-xs font-bold mt-1 ${
            parseFloat(qty) > item.quantity ? 'text-emerald-600' :
            parseFloat(qty) < item.quantity ? 'text-rose-500' : 'text-slate-400'
          }`}>
            التسوية: {parseFloat(qty) > item.quantity ? '+' : ''}{(parseFloat(qty) - item.quantity).toFixed(3)} {getUnitLabel(item.unit)}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">التاريخ</label>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ملاحظات</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px]"
        />
      </div>
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSave} isLoading={saving}
          icon={mode === 'in' ? 'add_circle' : mode === 'out' ? 'remove_circle' : 'fact_check'}
        >
          {title}
        </Button>
      </div>
    </div>
  );
};

// ─── Movements Modal ──────────────────────────────────────────────────────────
const MovementsModal = ({ item, onClose }: { item: InventoryItem; onClose: () => void }) => {
  const movements = useLiveQuery(
    () => db.stockMovements.where('itemId').equals(item.id).reverse().sortBy('createdAt'),
    [item.id]
  ) ?? [];

  const typeLabel = (t: StockMovement['type']) =>
    t === 'in' ? 'إضافة' : t === 'out' ? 'خصم' : 'تسوية جرد';
  const typeBadge = (t: StockMovement['type']) =>
    t === 'in'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : t === 'out'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          الصنف: <span className="font-bold text-slate-800 dark:text-slate-100">{item.name}</span>{' — '}
          الكمية الحالية: <span className="font-bold text-primary">{item.quantity} {getUnitLabel(item.unit)}</span>
        </div>
        <span className="text-xs text-slate-400">{movements.length} حركة</span>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 font-bold">
            <tr>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">النوع</th>
              <th className="px-3 py-2">الكمية</th>
              <th className="px-3 py-2">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {movements.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-slate-400">لا توجد حركات مسجلة</td></tr>
            ) : movements.map(m => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(m.date)}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeBadge(m.type)}`}>{typeLabel(m.type)}</span>
                </td>
                <td className="px-3 py-2 font-bold">
                  <span className={m.type === 'out' ? 'text-rose-600 dark:text-rose-400' : m.type === 'in' ? 'text-emerald-600' : 'text-amber-600'}>
                    {m.type === 'out' ? '-' : m.type === 'in' ? '+' : (m.quantity >= 0 ? '+' : '')}{m.quantity} {getUnitLabel(item.unit)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{m.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
};

export const InventoryPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [moveItem, setMoveItem] = useState<{ item: InventoryItem; mode: MovementMode } | undefined>();
  const [movementsItem, setMovementsItem] = useState<InventoryItem | undefined>();

  const inventoryItems = useLiveQuery(() =>
    db.inventory.orderBy('createdAt').reverse().toArray()
  , []);

  const categories = [...new Set((inventoryItems || []).map(i => i.category).filter(Boolean))];

  const filteredItems = inventoryItems?.filter(i => {
    const matchSearch = !searchTerm ||
      i.name.includes(searchTerm) ||
      (i.code && i.code.includes(searchTerm));
    const matchCat = !filterCategory || i.category === filterCategory;
    return matchSearch && matchCat;
  });

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: InventoryItem) => {
    const moves = await db.stockMovements.where('itemId').equals(item.id).count();
    if (moves > 0) {
      if (!window.confirm(`هذا الصنف لديه ${moves} حركة مخزنية. هل تريد حذفه مع جميع حركاته؟`)) return;
      await db.stockMovements.where('itemId').equals(item.id).delete();
    } else if (!window.confirm(`هل أنت متأكد من حذف "${item.name}" من المخزون؟`)) {
      return;
    }
    await db.inventory.delete(item.id);
  };

  const handlePrintReport = async () => {
    const settings = await db.settings.toCollection().first();
    const workshopName = settings?.workshopName ?? 'الورشة';
    const currency = settings?.currency ?? 'د.ج';
    const items = inventoryItems ?? [];
    const totalVal = items.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
    const lowItems = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير المخزون</title>
<style>
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 20px; font-size: 12px; color: #1e293b; }
  h1 { font-size: 20px; text-align: center; color: #1e40af; margin-bottom: 4px; }
  .sub { text-align: center; color: #64748b; margin-bottom: 16px; font-size: 11px; }
  .stats { display: flex; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 16px; font-size: 12px; }
  .stats div span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1e40af; color: #fff; padding: 6px 8px; text-align: right; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .low { background: #fef3c7 !important; }
  .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
<h1>${workshopName}</h1>
<div class="sub">تقرير المخزون — ${new Date().toLocaleDateString('ar-DZ')}</div>
<div class="stats">
  <div>إجمالي الأصناف: <span>${items.length}</span></div>
  <div>أصناف منخفضة: <span style="color:#dc2626">${lowItems.length}</span></div>
  <div>قيمة المخزون: <span>${totalVal.toFixed(2)} ${currency}</span></div>
</div>
<table>
  <thead><tr><th>الكود</th><th>الصنف</th><th>التصنيف</th><th>الوحدة</th><th>الكمية</th><th>الحد الأدنى</th><th>سعر الشراء</th><th>سعر البيع</th><th>القيمة الإجمالية</th></tr></thead>
  <tbody>
    ${items.map(i => `<tr class="${i.minStock > 0 && i.quantity <= i.minStock ? 'low' : ''}">
      <td dir="ltr">${i.code}</td>
      <td><strong>${i.name}</strong></td>
      <td>${i.category || '—'}</td>
      <td>${getUnitLabel(i.unit)}</td>
      <td><strong>${i.quantity}</strong></td>
      <td>${i.minStock}</td>
      <td>${i.purchasePrice.toFixed(2)} ${currency}</td>
      <td>${i.sellingPrice.toFixed(2)} ${currency}</td>
      <td><strong>${(i.quantity * i.purchasePrice).toFixed(2)} ${currency}</strong></td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="footer">${workshopName} — تقرير المخزون — ${new Date().toLocaleDateString('ar-DZ')}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=900');
    if (!win) { alert('يرجى السماح بالنوافذ المنبثقة'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const totalQty = inventoryItems?.reduce((acc, i) => acc + i.quantity, 0) || 0;
  const lowStockCount = inventoryItems?.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length || 0;
  const totalValue = inventoryItems?.reduce((acc, i) => acc + (i.quantity * i.purchasePrice), 0) || 0;
  const totalItems = inventoryItems?.length || 0;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">inventory_2</span>
            إدارة المخزون والجرد
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            تسجيل المواد الخام والقطع وتتبع الكميات والتكاليف
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrintReport}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">print</span>
            طباعة التقرير
          </button>
          <button
            onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20 shrink-0"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            إضافة صنف
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الأصناف', value: totalItems, icon: 'category', color: 'blue', suffix: '' },
          { label: 'إجمالي الكميات', value: totalQty, icon: 'inventory', color: 'emerald', suffix: '' },
          { label: 'أصناف ناقصة', value: lowStockCount, icon: 'warning', color: 'amber', suffix: '' },
          { label: 'قيمة المخزون', value: formatCurrency(totalValue), icon: 'payments', color: 'purple', suffix: '', currency: true },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/30 text-${stat.color}-600 dark:text-${stat.color}-400 flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{stat.label}</p>
              <p className={`font-bold text-slate-800 dark:text-slate-100 ${stat.currency ? 'text-base' : 'text-2xl'}`}>
                {stat.currency ? stat.value : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Search + Filter */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              type="text"
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder:text-slate-400 dark:text-slate-100"
              placeholder="بحث باسم المادة أو الكود..."
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
          {(searchTerm || filterCategory) && (
            <button
              onClick={() => { setSearchTerm(''); setFilterCategory(''); }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">filter_list_off</span>
              إلغاء الفلتر
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">
              <tr>
                <th className="px-6 py-4">الكود / المادة</th>
                <th className="px-6 py-4">التصنيف</th>
                <th className="px-6 py-4">الكمية المتوفرة</th>
                <th className="px-6 py-4">حد الإنذار</th>
                <th className="px-6 py-4">سعر الشراء</th>
                <th className="px-6 py-4">سعر البيع</th>
                <th className="px-6 py-4">القيمة الإجمالية</th>
                <th className="px-6 py-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!filteredItems && (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">جاري التحميل...</td></tr>
              )}
              {filteredItems && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-3">inventory_2</span>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">لا توجد عناصر مخزون مطابقة</p>
                    <button
                      onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                    >
                      + إضافة أول عنصر للمخزون
                    </button>
                  </td>
                </tr>
              )}
              {filteredItems?.map(item => {
                const isLow = item.minStock > 0 && item.quantity <= item.minStock;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isLow ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          <span className="material-symbols-outlined text-[18px]">{isLow ? 'warning' : 'inventory'}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.name}</div>
                          {item.code && <div className="text-xs text-slate-400 font-mono" dir="ltr">{item.code}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.category ? (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.category}
                        </span>
                      ) : <span className="text-slate-400 text-sm">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${isLow ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                        {item.quantity} {getUnitLabel(item.unit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {item.minStock} {getUnitLabel(item.unit)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.purchasePrice)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-primary">
                      {formatCurrency(item.sellingPrice)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {formatCurrency(item.purchasePrice * item.quantity)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => setMoveItem({ item, mode: 'in' })}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                          title="إضافة كمية"
                        >
                          <span className="material-symbols-outlined text-xl">add_circle</span>
                        </button>
                        <button
                          onClick={() => setMoveItem({ item, mode: 'out' })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="خصم كمية"
                        >
                          <span className="material-symbols-outlined text-xl">remove_circle</span>
                        </button>
                        <button
                          onClick={() => setMoveItem({ item, mode: 'count' })}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                          title="جرد وتسوية"
                        >
                          <span className="material-symbols-outlined text-xl">fact_check</span>
                        </button>
                        <button
                          onClick={() => setMovementsItem(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="حركة الصنف"
                        >
                          <span className="material-symbols-outlined text-xl">history</span>
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit/Add Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `تعديل: ${editingItem.name}` : 'إضافة صنف جديد للمخزون'}
        width="lg"
      >
        <InventoryItemForm
          item={editingItem}
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* ── Stock Move Modal ── */}
      <Modal
        isOpen={!!moveItem}
        onClose={() => setMoveItem(undefined)}
        title={
          moveItem?.mode === 'in' ? `إضافة كمية — ${moveItem.item.name}` :
          moveItem?.mode === 'out' ? `خصم كمية — ${moveItem.item.name}` :
          `جرد وتسوية — ${moveItem?.item.name}`
        }
        width="sm"
      >
        {moveItem && (
          <StockMoveModal
            item={moveItem.item}
            mode={moveItem.mode}
            onClose={() => setMoveItem(undefined)}
          />
        )}
      </Modal>

      {/* ── Movements Modal ── */}
      <Modal
        isOpen={!!movementsItem}
        onClose={() => setMovementsItem(undefined)}
        title={`حركة المخزون — ${movementsItem?.name ?? ''}`}
        width="lg"
      >
        {movementsItem && (
          <MovementsModal item={movementsItem} onClose={() => setMovementsItem(undefined)} />
        )}
      </Modal>
    </>
  );
};
