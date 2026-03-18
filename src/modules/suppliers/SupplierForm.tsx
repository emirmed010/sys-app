import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { Supplier } from '../../core/types';
import { db } from '../../data/db';
import { generateId } from '../../core/utils/formatters';

const supplierSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون أكثر من حرفين'),
  phone: z.string().min(8, 'رقم الهاتف غير صحيح'),
  address: z.string().optional(),
  supplyType: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface Props {
  supplier?: Supplier;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SupplierForm = ({ supplier, onSuccess, onCancel }: Props) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      supplyType: supplier?.supplyType ?? '',
      notes: supplier?.notes ?? '',
    },
  });

  const onSubmit = async (data: SupplierFormValues) => {
    try {
      if (supplier) {
        await db.suppliers.update(supplier.id, { ...data });
      } else {
        await db.suppliers.add({
          id: generateId(),
          ...data,
          balance: 0,
          createdAt: Date.now(),
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('حدث خطأ أثناء حفظ بيانات المورد');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="اسم المورد *"
        {...register('name')}
        error={errors.name?.message}
        autoFocus
      />
      <Input
        label="رقم الهاتف *"
        {...register('phone')}
        error={errors.phone?.message}
        dir="ltr"
        className="text-right"
      />
      <Input
        label="العنوان"
        {...register('address')}
        error={errors.address?.message}
      />
      <Input
        label="نوع المواد / التوريدات"
        {...register('supplyType')}
        error={errors.supplyType?.message}
        placeholder="مثال: ألمنيوم، زجاج، مواد البناء..."
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ملاحظات</label>
        <textarea
          {...register('notes')}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]"
          placeholder="أي تفاصيل إضافية عن المورد..."
        />
      </div>
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {supplier ? 'حفظ التعديلات' : 'إضافة المورد'}
        </Button>
      </div>
    </form>
  );
};
