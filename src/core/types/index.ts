export interface Order {
  id: string;
  orderNumber: number;
  customerId: string;
  date: string;
  expectedDeliveryDate?: string;
  status: 'new' | 'in_progress' | 'ready' | 'installed' | 'cancelled';
  deposit: number;
  total: number;
  remaining: number;
  description?: string;
  notes?: string;
  createdAt: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  type: 'product' | 'service';
  itemId: string;
  subtypeId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  secondaryPhone?: string;
  address?: string;
  notes?: string;
  balance: number;
  createdAt: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  supplyType?: string;
  notes?: string;
  balance: number;
  createdAt: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: number;
  supplierId: string;
  date: string;
  total: number;
  paid: number;
  remaining: number;
  notes?: string;
  createdAt: number;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minStock: number;
  defaultSupplierId?: string;
  notes?: string;
  createdAt: number;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  referenceId?: string;
  notes?: string;
  date: string;
  createdAt: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStock: number;
  notes?: string;
  inventoryItemId?: string;
  createdAt: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
}

export interface ServiceSubtype {
  id: string;
  categoryId: string;
  name: string;
  defaultPrice: number;
  unit: string;
  isActive: boolean;
  notes?: string;
  createdAt: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: number;
  orderId?: string;
  customerId: string;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  notes?: string;
  createdAt: number;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  type: 'product' | 'service';
  itemId: string;
  subtypeId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Payment {
  id: string;
  entityType: 'customer' | 'supplier';
  entityId: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  referenceId?: string;
  notes?: string;
  createdAt: number;
}

export interface AppSettings {
  id: string;
  workshopName: string;
  phone: string;
  address: string;
  invoiceFooterText?: string;
  currency: string;
  orderNumberSequence: number;
  invoiceNumberSequence: number;
  purchaseNumberSequence: number;
}
