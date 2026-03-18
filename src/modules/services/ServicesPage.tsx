import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { ServiceCategoryForm } from './ServiceCategoryForm';
import { ServiceSubtypeForm } from './ServiceSubtypeForm';
import { formatCurrency, getUnitLabel } from '../../core/utils/formatters';
import { ServiceCategory, ServiceSubtype } from '../../core/types';

export const ServicesPage = () => {
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | undefined>();
  const [editingSubtype, setEditingSubtype] = useState<ServiceSubtype | undefined>();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const categories = useLiveQuery(() =>
    db.serviceCategories.orderBy('createdAt').toArray()
  , []);

  const subtypes = useLiveQuery(() =>
    db.serviceSubtypes.orderBy('createdAt').toArray()
  , []);

  const handleDeleteCategory = async (cat: ServiceCategory) => {
    if (window.confirm(`هل تريد حذف الخدمة "${cat.name}" وجميع أنواعها الفرعية؟`)) {
      await db.serviceCategories.delete(cat.id);
      await db.serviceSubtypes.where('categoryId').equals(cat.id).delete();
    }
  };

  const handleDeleteSubtype = async (sub: ServiceSubtype) => {
    if (window.confirm(`هل تريد حذف النوع "${sub.name}"؟`)) {
      await db.serviceSubtypes.delete(sub.id);
    }
  };

  const handleToggleCategoryActive = async (cat: ServiceCategory) => {
    await db.serviceCategories.update(cat.id, { isActive: !cat.isActive });
  };

  const handleToggleSubtypeActive = async (sub: ServiceSubtype) => {
    await db.serviceSubtypes.update(sub.id, { isActive: !sub.isActive });
  };

  const openAddSubtype = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setEditingSubtype(undefined);
    setSubModalOpen(true);
  };

  const openEditSubtype = (sub: ServiceSubtype) => {
    setActiveCategoryId(sub.categoryId);
    setEditingSubtype(sub);
    setSubModalOpen(true);
  };

  const filteredCategories = (categories ?? []).filter(c =>
    !searchTerm ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">design_services</span>
            الخدمات وأنواعها
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            إدارة الخدمات الرئيسية وأنواعها الفرعية مع تسعير مستقل لكل نوع
          </p>
        </div>
        <button
          onClick={() => { setEditingCategory(undefined); setCatModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          إضافة خدمة رئيسية
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">search</span>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="ابحث عن خدمة..."
          className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
        />
      </div>

      {/* ── Summary Box ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الخدمات', value: categories?.length || 0, icon: 'design_services', color: 'blue' },
          { label: 'خدمات مفعّلة', value: categories?.filter(c => c.isActive).length || 0, icon: 'check_circle', color: 'emerald' },
          { label: 'إجمالي الأنواع', value: subtypes?.length || 0, icon: 'account_tree', color: 'purple' },
          { label: 'أنواع مفعّلة', value: subtypes?.filter(s => s.isActive).length || 0, icon: 'toggle_on', color: 'amber' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30 text-${stat.color}-600 dark:text-${stat.color}-400 flex items-center justify-center`}>
              <span className="material-symbols-outlined text-xl">{stat.icon}</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Category Cards ── */}
      {!categories && (
        <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
      )}

      {categories && categories.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 block mb-4">design_services</span>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">لا توجد خدمات مضافة</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">أضف خدمة رئيسية (مثل: أبواب ألمنيوم) ثم أضف لها أنواع بأسعار مختلفة.</p>
          <button onClick={() => { setEditingCategory(undefined); setCatModalOpen(true); }} className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            إضافة الخدمة الأولى
          </button>
        </div>
      )}

      {searchTerm && filteredCategories.length === 0 && categories && categories.length > 0 && (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
          <span className="material-symbols-outlined text-4xl block mb-2">search_off</span>
          لا توجد خدمات تطابق "
          <span className="font-bold text-slate-600 dark:text-slate-300">{searchTerm}</span>"
        </div>
      )}

      <div className="space-y-4">
        {filteredCategories.map(cat => {
          const catSubtypes = subtypes?.filter(s => s.categoryId === cat.id) || [];
          const isExpanded = expandedCategoryId === cat.id;

          return (
            <div key={cat.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Category Header */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cat.isActive ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                    <span className="material-symbols-outlined text-2xl">design_services</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{cat.name}</h3>
                    {cat.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cat.description}</p>}
                    <div className="flex gap-2 mt-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cat.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {cat.isActive ? 'مفعّلة' : 'موقوفة'}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                        {catSubtypes.length} نوع فرعي
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openAddSubtype(cat.id)}
                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="إضافة نوع فرعي"
                  >
                    <span className="material-symbols-outlined text-xl">add</span>
                  </button>
                  <button
                    onClick={() => handleToggleCategoryActive(cat)}
                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                    title={cat.isActive ? 'تعطيل' : 'تفعيل'}
                  >
                    <span className="material-symbols-outlined text-xl">{cat.isActive ? 'toggle_on' : 'toggle_off'}</span>
                  </button>
                  <button
                    onClick={() => { setEditingCategory(cat); setCatModalOpen(true); }}
                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                  <span className={`material-symbols-outlined text-slate-400 mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    chevron_left
                  </span>
                </div>
              </div>

              {/* Subtypes Table */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800">
                  {catSubtypes.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <span className="material-symbols-outlined block text-4xl text-slate-200 dark:text-slate-700 mb-2">account_tree</span>
                      <p className="text-sm">لا يوجد أنواع فرعية بعد</p>
                      <button onClick={() => openAddSubtype(cat.id)} className="mt-3 text-primary text-sm font-bold hover:underline">
                        + إضافة نوع فرعي
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/30 text-slate-400 text-xs font-bold uppercase">
                          <tr>
                            <th className="px-6 py-3">النوع الفرعي</th>
                            <th className="px-6 py-3">السعر الافتراضي</th>
                            <th className="px-6 py-3">الوحدة</th>
                            <th className="px-6 py-3">الحالة</th>
                            <th className="px-6 py-3">ملاحظات</th>
                            <th className="px-6 py-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {catSubtypes.map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-100 text-sm">{sub.name}</td>
                              <td className="px-6 py-3 font-bold text-primary">{formatCurrency(sub.defaultPrice)}</td>
                              <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-sm">{getUnitLabel(sub.unit)}</td>
                              <td className="px-6 py-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sub.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                  {sub.isActive ? 'مفعّل' : 'موقوف'}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-xs text-slate-400 max-w-[180px] truncate">{sub.notes || '-'}</td>
                              <td className="px-6 py-3">
                                <div className="flex justify-center gap-1">
                                  <button onClick={() => handleToggleSubtypeActive(sub)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title={sub.isActive ? 'تعطيل' : 'تفعيل'}>
                                    <span className="material-symbols-outlined text-[18px]">{sub.isActive ? 'toggle_on' : 'toggle_off'}</span>
                                  </button>
                                  <button onClick={() => openEditSubtype(sub)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="تعديل">
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                  </button>
                                  <button onClick={() => handleDeleteSubtype(sub)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="حذف">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button
                          onClick={() => openAddSubtype(cat.id)}
                          className="text-primary text-sm font-bold hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                          إضافة نوع لـ "{cat.name}"
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCategory ? `تعديل الخدمة: ${editingCategory.name}` : 'إضافة خدمة رئيسية جديدة'}
      >
        <ServiceCategoryForm
          category={editingCategory}
          onSuccess={() => setCatModalOpen(false)}
          onCancel={() => setCatModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={editingSubtype ? `تعديل النوع: ${editingSubtype.name}` : 'إضافة نوع فرعي جديد'}
      >
        {activeCategoryId && (
          <ServiceSubtypeForm
            categoryId={activeCategoryId}
            subtype={editingSubtype}
            onSuccess={() => setSubModalOpen(false)}
            onCancel={() => setSubModalOpen(false)}
          />
        )}
      </Modal>
    </>
  );
};
