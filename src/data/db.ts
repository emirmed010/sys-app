import Dexie, { Table } from 'dexie';
import {
  Order, OrderItem, Customer, Supplier, Purchase, PurchaseItem,
  InventoryItem, StockMovement, Product, ServiceCategory,
  ServiceSubtype, Invoice, InvoiceItem, Payment, AppSettings
} from '../core/types';

export class WorkshopDatabase extends Dexie {
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  purchaseItems!: Table<PurchaseItem, string>;
  inventory!: Table<InventoryItem, string>;
  stockMovements!: Table<StockMovement, string>;
  products!: Table<Product, string>;
  serviceCategories!: Table<ServiceCategory, string>;
  serviceSubtypes!: Table<ServiceSubtype, string>;
  invoices!: Table<Invoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  payments!: Table<Payment, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('WorkshopDB');

    // Version 1 — original schema (kept for upgrade path)
    this.version(1).stores({
      orders: 'id, customerId, status, date, createdAt',
      orderItems: 'id, orderId, itemId',
      customers: 'id, name, phone, createdAt',
      suppliers: 'id, name, phone, createdAt',
      purchases: 'id, supplierId, date, createdAt',
      purchaseItems: 'id, purchaseId, itemId',
      inventory: 'id, code, category, name, createdAt',
      stockMovements: 'id, itemId, type, date, referenceId',
      products: 'id, code, categoryId, name',
      serviceCategories: 'id, name, isActive',
      serviceSubtypes: 'id, categoryId, name, isActive',
      invoices: 'id, orderId, customerId, status, date, createdAt',
      invoiceItems: 'id, invoiceId, itemId',
      payments: 'id, entityType, entityId, date, referenceId',
      settings: 'id'
    });

    // Version 2 — updated products schema to include unit & quantity indexes
    this.version(2).stores({
      orders: 'id, customerId, status, date, createdAt',
      orderItems: 'id, orderId, itemId',
      customers: 'id, name, phone, createdAt',
      suppliers: 'id, name, phone, createdAt',
      purchases: 'id, supplierId, date, createdAt',
      purchaseItems: 'id, purchaseId, itemId',
      inventory: 'id, code, category, name, createdAt',
      stockMovements: 'id, itemId, type, date, referenceId',
      products: 'id, code, categoryId, name, unit, createdAt',
      serviceCategories: 'id, name, isActive, createdAt',
      serviceSubtypes: 'id, categoryId, name, isActive, createdAt',
      invoices: 'id, orderId, customerId, status, date, createdAt',
      invoiceItems: 'id, invoiceId, itemId',
      payments: 'id, entityType, entityId, date, referenceId',
      settings: 'id'
    });

    // Version 3 — add createdAt index to payments
    this.version(3).stores({
      orders: 'id, customerId, status, date, createdAt',
      orderItems: 'id, orderId, itemId',
      customers: 'id, name, phone, createdAt',
      suppliers: 'id, name, phone, createdAt',
      purchases: 'id, supplierId, date, createdAt',
      purchaseItems: 'id, purchaseId, itemId',
      inventory: 'id, code, category, name, createdAt',
      stockMovements: 'id, itemId, type, date, referenceId',
      products: 'id, code, categoryId, name, unit, createdAt',
      serviceCategories: 'id, name, isActive, createdAt',
      serviceSubtypes: 'id, categoryId, name, isActive, createdAt',
      invoices: 'id, orderId, customerId, status, date, createdAt',
      invoiceItems: 'id, invoiceId, itemId',
      payments: 'id, entityType, entityId, date, createdAt, referenceId',
      settings: 'id'
    });

    // Version 4 — add subtypeId indexes for service subtype profile lookups
    this.version(4).stores({
      orders: 'id, customerId, status, date, createdAt',
      orderItems: 'id, orderId, itemId, subtypeId',
      customers: 'id, name, phone, createdAt',
      suppliers: 'id, name, phone, createdAt',
      purchases: 'id, supplierId, date, createdAt',
      purchaseItems: 'id, purchaseId, itemId',
      inventory: 'id, code, category, name, createdAt',
      stockMovements: 'id, itemId, type, date, referenceId',
      products: 'id, code, categoryId, name, unit, createdAt',
      serviceCategories: 'id, name, isActive, createdAt',
      serviceSubtypes: 'id, categoryId, name, isActive, createdAt',
      invoices: 'id, orderId, customerId, status, date, createdAt',
      invoiceItems: 'id, invoiceId, itemId, subtypeId',
      payments: 'id, entityType, entityId, date, createdAt, referenceId',
      settings: 'id'
    });
  }
}

export const db = new WorkshopDatabase();
