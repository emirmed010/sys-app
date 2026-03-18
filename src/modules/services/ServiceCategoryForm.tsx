import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ServiceCategory } from '../../core/types';
import { db } from '../../data/db';
import { generateId } from '../../core/utils/formatters';

const schema = z.object({
  name: z.string().min(2, 'اسم الخدمة يجب أن يكون أكثر من حرفين'),
  description: z.string().optional().default(''),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  category?: ServiceCategory;
  onSuccess: () => void;
  onCancel: () => void;
}

const fieldClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow placeholder:text-slate-400";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

export const ServiceCategoryForm = ({ category, onSuccess, onCancel }: Props) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: category ? {
      name: category.name,
      description: category.description || '',
      isActive: category.isActive,
    } : { name: '', description: '', isActive: true }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      if (category) {
        await db.serviceCategories.update(category.id, data);
      } else {
        await db.serviceCategories.add({
          id: generateId(),
          name: data.name,
          description: data.description || '',
          isActive: data.isActive,
          createdAt: Date.now(),
        });
      }
      onSuccess();
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className={labelClass}>اسم الخدمة الرئيسية *</label>
        <input
          {...register('name')}
          className={fieldClass}
          placeholder="مثال: أبواب ألمنيوم، نوافذ، واجهات زجاجية..."
          autoFocus
        />
        {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
      </div>
      <div>
        <label className={labelClass}>الوصف (اختياري)</label>
        <textarea
          {...register('description')}
          rows={2}
          className={fieldClass}
          placeholder="وصف الخدمة..."
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          id="isActiveCategory"
          type="checkbox"
          {...register('isActive')}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
        />
        <label htmlFor="isActiveCategory" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          الخدمة مفعّلة (ستظهر في الطلبات والفواتير)
        </label>
      </div>
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          إلغاء
        </button>
        <button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-[18px]">save</span>
          {category ? 'تحديث الخدمة' : 'إنشاء الخدمة'}
        </button>
      </div>
    </form>
  );
};
