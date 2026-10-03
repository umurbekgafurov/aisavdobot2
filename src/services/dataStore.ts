import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Business,
  Warehouse,
  Product,
  Customer,
  Order,
  StockMovement,
  AIFollowupRecommendation,
  TelegramMessage
} from '../types';
import {
  INITIAL_WAREHOUSES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_FOLLOWUPS
} from '../data/mockData';

const DEFAULT_BIZ_ID = 'biz-default';

export const DEFAULT_BUSINESS: Business = {
  id: DEFAULT_BIZ_ID,
  name: 'Telefon Market & Gadgets',
  ownerUid: 'admin-user-1',
  phone: '+998 71 200 00 20',
  address: 'Toshkent sh., Yunusobod tumani, Amir Temur shoh ko\'chasi 107',
  workingHours: '09:00 - 21:00 (dam olish kunlarisiz)',
  deliveryZones: ['Toshkent shahri', 'Toshkent viloyati', 'Butun O\'zbekiston (BTS Pochta)'],
  deliveryPrice: 25000,
  freeDeliveryThreshold: 1000000,
  paymentMethods: ['Naqd pul', 'Click', 'Payme', 'Uzum Bank'],
  currency: 'UZS',
  defaultWarehouseId: 'wh-main',
  telegramConnected: true,
  telegramBotUsername: 'savdobot_demo_bot',
  settings: {
    autoReply: true,
    groupAutoReply: true,
    humanApprovalRequired: false,
    followUp: true,
  },
  createdAt: Date.now() - 30 * 86400000,
};

// Local storage fallback cache so the app is always fast, responsive, and resilient
const STORAGE_PREFIX = 'savdobot_data_';

function loadLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function saveLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}

export class DataStore {
  // Products
  static async getProducts(businessId: string = DEFAULT_BIZ_ID): Promise<Product[]> {
    try {
      const colRef = collection(db, 'businesses', businessId, 'products');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
      }
    } catch (err) {
      console.warn('Firestore getProducts fallback to local:', err);
    }
    return loadLocal<Product[]>('products', INITIAL_PRODUCTS);
  }

  static async saveProduct(product: Product, businessId: string = DEFAULT_BIZ_ID): Promise<void> {
    const local = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const idx = local.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      local[idx] = product;
    } else {
      local.unshift(product);
    }
    saveLocal('products', local);

    try {
      const docRef = doc(db, 'businesses', businessId, 'products', product.id);
      await setDoc(docRef, product, { merge: true });
    } catch (err) {
      console.warn('Firestore saveProduct error:', err);
    }
  }

  static async deleteProduct(productId: string, businessId: string = DEFAULT_BIZ_ID): Promise<void> {
    const local = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    saveLocal('products', local.filter(p => p.id !== productId));
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'products', productId));
    } catch (err) {
      console.warn('Firestore deleteProduct error:', err);
    }
  }

  // Warehouses
  static async getWarehouses(businessId: string = DEFAULT_BIZ_ID): Promise<Warehouse[]> {
    try {
      const colRef = collection(db, 'businesses', businessId, 'warehouses');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Warehouse));
      }
    } catch (err) {
      console.warn('Firestore getWarehouses fallback:', err);
    }
    return loadLocal<Warehouse[]>('warehouses', INITIAL_WAREHOUSES);
  }

  static async saveWarehouse(warehouse: Warehouse, businessId: string = DEFAULT_BIZ_ID): Promise<void> {
    const list = loadLocal<Warehouse[]>('warehouses', INITIAL_WAREHOUSES);
    const idx = list.findIndex(w => w.id === warehouse.id);
    if (idx >= 0) list[idx] = warehouse;
    else list.push(warehouse);
    saveLocal('warehouses', list);

    try {
      await setDoc(doc(db, 'businesses', businessId, 'warehouses', warehouse.id), warehouse, { merge: true });
    } catch (e) {
      console.warn('Firestore saveWarehouse error:', e);
    }
  }

  // Stock movements
  static async getStockMovements(businessId: string = DEFAULT_BIZ_ID): Promise<StockMovement[]> {
    try {
      const colRef = collection(db, 'businesses', businessId, 'stock_movements');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as StockMovement));
      }
    } catch (e) {
      console.warn('Firestore getStockMovements fallback:', e);
    }
    return loadLocal<StockMovement[]>('stock_movements', INITIAL_STOCK_MOVEMENTS);
  }

  static async addStockMovement(movement: StockMovement, businessId: string = DEFAULT_BIZ_ID): Promise<void> {
    const movements = loadLocal<StockMovement[]>('stock_movements', INITIAL_STOCK_MOVEMENTS);
    movements.unshift(movement);
    saveLocal('stock_movements', movements);

    // Update product stock in memory & storage
    const products = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const p = products.find(prod => prod.id === movement.productId);
    if (p) {
      p.stock = Math.max(0, p.stock + movement.quantity);
      p.updatedAt = Date.now();
      saveLocal('products', products);
      try {
        await setDoc(doc(db, 'businesses', businessId, 'products', p.id), p, { merge: true });
      } catch (err) {
        console.warn('Firestore product stock update error:', err);
      }
    }

    try {
      await setDoc(doc(db, 'businesses', businessId, 'stock_movements', movement.id), movement);
    } catch (err) {
      console.warn('Firestore addStockMovement error:', err);
    }
  }

  // Customers
  static async getCustomers(businessId: string = DEFAULT_BIZ_ID): Promise<Customer[]> {
    try {
      const colRef = collection(db, 'businesses', businessId, 'customers');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
      }
    } catch (e) {
      console.warn('Firestore getCustomers fallback:', e);
    }
    return loadLocal<Customer[]>('customers', INITIAL_CUSTOMERS);
  }

  static async saveCustomer(customer: Customer, businessId: string = DEFAULT_BIZ_ID): Promise<void> {
    const list = loadLocal<Customer[]>('customers', INITIAL_CUSTOMERS);
    const idx = list.findIndex(c => c.id === customer.id);
    if (idx >= 0) list[idx] = customer;
    else list.unshift(customer);
    saveLocal('customers', list);

    try {
      await setDoc(doc(db, 'businesses', businessId, 'customers', customer.id), customer, { merge: true });
    } catch (e) {
      console.warn('Firestore saveCustomer error:', e);
    }
  }

  // Orders
  static async getOrders(businessId: string = DEFAULT_BIZ_ID): Promise<Order[]> {
    try {
      const colRef = collection(db, 'businesses', businessId, 'orders');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Order));
      }
    } catch (e) {
      console.warn('Firestore getOrders fallback:', e);
    }
    return loadLocal<Order[]>('orders', INITIAL_ORDERS);
  }

  /**
   * Complete Order Flow:
   * 1. Create order document
   * 2. Decrement product stock safely
   * 3. Record SALE stock movement
   * 4. Update customer stats (total orders & spent)
   */
  static async createOrder(order: Order, businessId: string = DEFAULT_BIZ_ID): Promise<void> {
    const orders = loadLocal<Order[]>('orders', INITIAL_ORDERS);
    orders.unshift(order);
    saveLocal('orders', orders);

    // Update stock and create stock movement for each item
    for (const item of order.items) {
      await this.addStockMovement({
        id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        businessId,
        warehouseId: 'wh-main',
        productId: item.productId,
        productName: item.productName,
        type: 'SALE',
        quantity: -item.quantity,
        reason: `Buyurtma #${order.id} orqali sotuv`,
        referenceId: order.id,
        createdAt: Date.now(),
        createdBy: 'Telegram Bot'
      }, businessId);
    }

    // Update customer stats
    const customers = loadLocal<Customer[]>('customers', INITIAL_CUSTOMERS);
    const cust = customers.find(c => c.id === order.customerId);
    if (cust) {
      cust.totalOrders += 1;
      cust.totalSpent += order.total;
      cust.status = 'Buyurtma berdi';
      cust.leadScore = Math.min(100, (cust.leadScore || 50) + 15);
      cust.lastInteraction = Date.now();
      saveLocal('customers', customers);
      try {
        await setDoc(doc(db, 'businesses', businessId, 'customers', cust.id), cust, { merge: true });
      } catch (e) {
        console.warn('Firestore update customer stats error:', e);
      }
    }

    try {
      await setDoc(doc(db, 'businesses', businessId, 'orders', order.id), order);
    } catch (e) {
      console.warn('Firestore createOrder error:', e);
    }
  }

  static async updateOrderStatus(
    orderId: string,
    orderStatus: Order['orderStatus'],
    paymentStatus?: Order['paymentStatus'],
    businessId: string = DEFAULT_BIZ_ID
  ): Promise<void> {
    const orders = loadLocal<Order[]>('orders', INITIAL_ORDERS);
    const ord = orders.find(o => o.id === orderId);
    if (ord) {
      ord.orderStatus = orderStatus;
      if (paymentStatus) ord.paymentStatus = paymentStatus;
      ord.updatedAt = Date.now();
      saveLocal('orders', orders);
      try {
        await setDoc(doc(db, 'businesses', businessId, 'orders', ord.id), ord, { merge: true });
      } catch (e) {
        console.warn('Firestore update order status error:', e);
      }
    }
  }

  // Follow-ups
  static async getFollowups(): Promise<AIFollowupRecommendation[]> {
    return loadLocal<AIFollowupRecommendation[]>('followups', INITIAL_FOLLOWUPS);
  }

  static async updateFollowupStatus(id: string, status: 'sent' | 'dismissed'): Promise<void> {
    const list = loadLocal<AIFollowupRecommendation[]>('followups', INITIAL_FOLLOWUPS);
    const f = list.find(x => x.id === id);
    if (f) {
      f.status = status;
      saveLocal('followups', list);
    }
  }

  // Business settings
  static async getBusiness(businessId: string = DEFAULT_BIZ_ID): Promise<Business> {
    try {
      const snap = await getDocs(query(collection(db, 'businesses'), where('id', '==', businessId)));
      if (!snap.empty) {
        return snap.docs[0].data() as Business;
      }
    } catch (e) {
      console.warn('Firestore getBusiness fallback:', e);
    }
    return loadLocal<Business>('business', DEFAULT_BUSINESS);
  }

  static async saveBusiness(business: Business): Promise<void> {
    saveLocal('business', business);
    try {
      await setDoc(doc(db, 'businesses', business.id), business, { merge: true });
    } catch (e) {
      console.warn('Firestore saveBusiness error:', e);
    }
  }
}
