import { useSettingsStore } from '../../store/useAppStore';

export const formatCurrency = (amount: number, currency?: string): string => {
  const curr = currency ?? useSettingsStore.getState().currency ?? 'MRU';
  if (isNaN(amount)) return `0.00 ${curr}`;
  return `${amount.toLocaleString('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
};

export const formatDate = (dateInput: string | number | Date): string => {
  try {
    const d = new Date(dateInput);
    return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
};

export const generateId = (): string => {
  return crypto.randomUUID();
};

export const UNITS = [
  { value: 'piece', label: 'قطعة' },
  { value: 'meter', label: 'متر' },
  { value: 'sqm', label: 'متر مربع' },
  { value: 'kg', label: 'كيلوغرام' },
  { value: 'liter', label: 'لتر' },
  { value: 'service', label: 'خدمة' },
  { value: 'pack', label: 'حزمة' },
];

export const getUnitLabel = (value: string) =>
  UNITS.find(u => u.value === value)?.label ?? value;
