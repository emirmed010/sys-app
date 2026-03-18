import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { Customer } from '../../core/types';
import { db } from '../../data/db';
import { generateId } from '../../core/utils/formatters';

const customerSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون أكثر من حرفين'),
  phone: z.string().min(8, 'رقم الهاتف غير صحيح'),
  secondaryPhone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface Props {
  customer?: Customer;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CustomerForm = ({ customer, onSuccess, onCancel }: Props) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer || {
      name: '',
      phone: '',
      secondaryPhone: '',
      address: '',
      notes: ''
    }
  });

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      if (customer) {
        await db.customers.update(customer.id, {
          ...data
        });
      } else {
        await db.customers.add({
          id: generateId(),
          ...data,
          balance: 0,
          createdAt: Date.now()
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('حدث خطأ أثناء حفظ بيانات الزبون');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="اسم الزبون *"
        {...register('name')}
        error={errors.name?.message}
        autoFocus
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="رقم الهاتف الأساسي *"
          {...register('phone')}
          error={errors.phone?.message}
          dir="ltr"
          className="text-right"
        />
        <Input
          label="رقم الهاتف الإضافي (اختياري)"
          {...register('secondaryPhone')}
          error={errors.secondaryPhone?.message}
          dir="ltr"
          className="text-right"
        />
      </div>
      <Input
        label="العنوان"
        {...register('address')}
        error={errors.address?.message}
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">ملاحظات</label>
        <textarea
          {...register('notes')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px]"
          placeholder="أي تفاصيل إضافية عن الزبون..."
        />
      </div>
      
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
        <Button type="button" variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {customer ? 'تحديث البيانات' : 'إضافة زبون'}
        </Button>
      </div>
    </form>
  );
};
