import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../lib/firebase';
import {
  Business,
  Warehouse,
  Product,
  Customer,
  Order,
  StockMovement,
  AIFollowupRecommendation
} from '../types';

export interface UserDocument {
  userId: string;
  businessId: string;
  businessName: string;
  email: string;
  displayName?: string;
  createdAt: number;
}

export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo?: boolean;
}

const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof localStorage !== 'undefined') {
      try { return localStorage.getItem(key); } catch {}
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(key, value); } catch {}
    }
  },
  removeItem: (key: string): void => {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(key); } catch {}
    }
  }
};

export class AuthService {
  private static localListeners: Array<(user: FirebaseUser | AppAuthUser | null) => void> = [];

  static notifyLocalListeners(user: FirebaseUser | AppAuthUser | null) {
    for (const listener of this.localListeners) {
      try {
        listener(user);
      } catch (e) {
        console.warn('Listener error:', e);
      }
    }
  }

  /**
   * Listen to Firebase Auth state changes
   */
  static onAuthChange(callback: (user: FirebaseUser | AppAuthUser | null) => void) {
    this.localListeners.push(callback);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        safeStorage.removeItem('ai_savdobot_local_user');
        callback(firebaseUser);
      } else {
        const localUserStr = safeStorage.getItem('ai_savdobot_local_user');
        if (localUserStr) {
          try {
            const localUser = JSON.parse(localUserStr);
            callback(localUser);
          } catch {
            callback(null);
          }
        } else {
          callback(null);
        }
      }
    });

    return () => {
      this.localListeners = this.localListeners.filter((l) => l !== callback);
      unsubscribe();
    };
  }

  /**
   * Get current authenticated user
   */
  static getCurrentUser(): FirebaseUser | AppAuthUser | null {
    if (auth.currentUser) return auth.currentUser;
    const localUserStr = safeStorage.getItem('ai_savdobot_local_user');
    if (localUserStr) {
      try {
        return JSON.parse(localUserStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Register a new user:
   * Step A: Firebase Authentication createUserWithEmailAndPassword()
   * Step B: Firestore user document & business document creation
   */
  static async registerUser(
    email: string,
    pass: string,
    businessName: string,
    ownerName?: string
  ): Promise<{ user: FirebaseUser; business: Business; userDoc: UserDocument }> {
    // 12. Add temporary debug logging:
    console.log("Firebase project:", firebaseConfig.projectId);
    console.log("Registering:", email);

    // Step A: Firebase Authentication account creation
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log("Firebase user:", userCredential.user.uid);
    } catch (authError: any) {
      console.warn(`[Firebase Auth Registration Failed] Code: ${authError.code || 'unknown'}, Message: ${authError.message}`);
      const err = new Error(authError.message);
      (err as any).code = authError.code || 'auth/unknown';
      (err as any).step = 'auth';
      throw err;
    }

    // Step B: Firestore user/profile creation
    const user = userCredential.user;
    if (ownerName) {
      try {
        await updateProfile(user, { displayName: ownerName });
      } catch (profErr) {
        console.warn("Profile update notice:", profErr);
      }
    }

    const businessId = `biz_${user.uid.slice(0, 12)}`;
    const now = Date.now();

    // 1. User document in `users` collection:
    const userDoc: UserDocument = {
      userId: user.uid,
      businessId: businessId,
      businessName: businessName,
      email: user.email || email,
      displayName: ownerName || user.email?.split('@')[0],
      createdAt: now,
    };

    // 2. Business document in `businesses` collection:
    const businessDoc: Business & { userId: string; businessName: string } = {
      id: businessId,
      userId: user.uid,
      businessId: businessId,
      name: businessName,
      businessName: businessName,
      ownerUid: user.uid,
      phone: '',
      address: 'Toshkent sh.',
      workingHours: '09:00 - 20:00',
      deliveryZones: ['Toshkent shahri', 'Viloyatlar'],
      deliveryPrice: 25000,
      freeDeliveryThreshold: 1000000,
      paymentMethods: ['Naqd pul', 'Click', 'Payme', 'Uzum Bank'],
      currency: 'UZS',
      defaultWarehouseId: `wh_${user.uid.slice(0, 8)}`,
      telegramConnected: false,
      settings: {
        autoReply: true,
        groupAutoReply: false,
        humanApprovalRequired: false,
        followUp: true,
      },
      createdAt: now,
    };

    // 3. Default Warehouse
    const defaultWarehouse: Warehouse = {
      id: businessDoc.defaultWarehouseId!,
      businessId: businessId,
      name: 'Asosiy ombor',
      address: 'Toshkent sh.',
      active: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'users', user.uid), userDoc);
      await setDoc(doc(db, 'businesses', businessId), businessDoc);
      await setDoc(doc(db, 'businesses', businessId, 'warehouses', defaultWarehouse.id), defaultWarehouse);

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('ai_savdobot_local_user');
      }
      return { user, business: businessDoc, userDoc };
    } catch (firestoreError: any) {
      console.warn(`[Firestore Profile Creation Error] Code: ${firestoreError.code || 'unknown'}, Message: ${firestoreError.message}`);
      const err = new Error(firestoreError.message);
      (err as any).code = firestoreError.code || 'firestore/permission-denied';
      (err as any).step = 'firestore';
      (err as any).user = user;
      throw err;
    }
  }

  /**
   * Log in user with email & password
   */
  static async loginUser(email: string, pass: string): Promise<FirebaseUser | AppAuthUser> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      safeStorage.removeItem('ai_savdobot_local_user');
      return cred.user;
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('auth/operation-not-allowed'))) {
        console.warn('[Firebase Auth] Notice: Email/Password provider is disabled in Firebase Console. Logging in via local session.');
        const savedUserStr = safeStorage.getItem('ai_savdobot_local_user');
        if (savedUserStr) {
          const u = JSON.parse(savedUserStr);
          AuthService.notifyLocalListeners(u);
          return u;
        }

        const localUser: AppAuthUser = {
          uid: 'usr_demo_101',
          email: email || 'demo@savdobot.uz',
          displayName: email.split('@')[0] || 'Do\'kon egasi',
          isDemo: true,
        };
        safeStorage.setItem('ai_savdobot_local_user', JSON.stringify(localUser));
        AuthService.notifyLocalListeners(localUser);
        return localUser;
      }
      throw err;
    }
  }

  /**
   * Log out user
   */
  static async logoutUser(): Promise<void> {
    safeStorage.removeItem('ai_savdobot_local_user');
    safeStorage.removeItem('ai_savdobot_local_biz');
    safeStorage.removeItem('ai_savdobot_local_udoc');
    await signOut(auth).catch(() => {});
    AuthService.notifyLocalListeners(null);
  }

  /**
   * Fetch current user's document and linked business from Firestore
   */
  static async getUserProfileAndBusiness(uid: string): Promise<{ userDoc: UserDocument | null; business: Business | null }> {
    const savedBizStr = safeStorage.getItem('ai_savdobot_local_biz');
    const savedDocStr = safeStorage.getItem('ai_savdobot_local_udoc');
    if (savedBizStr && savedDocStr) {
      try {
        return { userDoc: JSON.parse(savedDocStr), business: JSON.parse(savedBizStr) };
      } catch (e) {
        console.warn('Error reading saved local business:', e);
      }
    }

    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (!uSnap.exists()) {
        return { userDoc: null, business: null };
      }

      const uData = uSnap.data() as UserDocument;
      const bSnap = await getDoc(doc(db, 'businesses', uData.businessId));
      const business = bSnap.exists() ? (bSnap.data() as Business) : null;

      return { userDoc: uData, business };
    } catch (err) {
      console.warn('Notice fetching user profile and business from Firestore:', err);
      return { userDoc: null, business: null };
    }
  }
}

/**
 * Clean Firestore Service Layer for Business Data
 * Enforces businessId isolation on all reads and writes
 */
export class FirestoreService {
  // Warehouses
  static async getWarehouses(businessId: string): Promise<Warehouse[]> {
    const colRef = collection(db, 'businesses', businessId, 'warehouses');
    const snap = await getDocs(colRef);
    return snap.docs
      .map(d => ({ ...d.data(), id: d.id } as Warehouse))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  static async getWarehouse(businessId: string, warehouseId: string): Promise<Warehouse | null> {
    const docRef = doc(db, 'businesses', businessId, 'warehouses', warehouseId);
    const snap = await getDoc(docRef);
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Warehouse) : null;
  }

  static async saveWarehouse(businessId: string, warehouse: Warehouse): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'warehouses', warehouse.id);
    const now = Date.now();
    await setDoc(docRef, {
      ...warehouse,
      businessId,
      updatedAt: now,
      createdAt: warehouse.createdAt || now
    }, { merge: true });
  }

  static async deleteWarehouse(businessId: string, warehouseId: string): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'warehouses', warehouseId);
    await deleteDoc(docRef);
  }

  // Products
  static async getProducts(businessId: string): Promise<Product[]> {
    const colRef = collection(db, 'businesses', businessId, 'products');
    const snap = await getDocs(colRef);
    return snap.docs
      .map(d => ({ ...d.data(), id: d.id } as Product))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  static async getProduct(businessId: string, productId: string): Promise<Product | null> {
    const docRef = doc(db, 'businesses', businessId, 'products', productId);
    const snap = await getDoc(docRef);
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Product) : null;
  }

  /**
   * Create product and if initial stock > 0, log STOCK_IN movement atomically
   */
  static async createProduct(businessId: string, product: Product, createdBy: string = 'Admin'): Promise<void> {
    const now = Date.now();
    const productRef = doc(db, 'businesses', businessId, 'products', product.id);

    const productToSave: Product = {
      ...product,
      businessId,
      createdAt: now,
      updatedAt: now,
    };

    if (product.stock > 0) {
      const movementId = `sm_${now}_${Math.random().toString(36).substring(2, 6)}`;
      const movementRef = doc(db, 'businesses', businessId, 'stock_movements', movementId);
      const movementDoc: StockMovement = {
        id: movementId,
        businessId,
        warehouseId: product.warehouseId,
        productId: product.id,
        productName: product.name,
        type: 'STOCK_IN',
        quantity: product.stock,
        reason: 'Boshlang\'ich qoldiq (Yangi mahsulot)',
        createdAt: now,
        createdBy,
      };

      await runTransaction(db, async (txn) => {
        txn.set(productRef, productToSave);
        txn.set(movementRef, movementDoc);
      });
    } else {
      await setDoc(productRef, productToSave);
    }
  }

  static async updateProduct(businessId: string, product: Product): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'products', product.id);
    await setDoc(docRef, { ...product, businessId, updatedAt: Date.now() }, { merge: true });
  }

  static async deleteProduct(businessId: string, productId: string): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'products', productId);
    await deleteDoc(docRef);
  }

  // Stock Movements
  static async getStockMovements(businessId: string, productId?: string): Promise<StockMovement[]> {
    const colRef = collection(db, 'businesses', businessId, 'stock_movements');
    const snap = await getDocs(colRef);
    let list = snap.docs
      .map(d => ({ ...d.data(), id: d.id } as StockMovement))
      .sort((a, b) => b.createdAt - a.createdAt);

    if (productId) {
      list = list.filter(m => m.productId === productId);
    }
    return list;
  }

  /**
   * Adjust stock (Kirim qilish / Chiqim qilish)
   * atomic transaction with validation: cannot decrease below 0
   */
  static async addStockMovement(
    businessId: string,
    movement: Omit<StockMovement, 'id' | 'businessId' | 'createdAt'>
  ): Promise<void> {
    const now = Date.now();
    const movementId = `sm_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const movementRef = doc(db, 'businesses', businessId, 'stock_movements', movementId);
    const productRef = doc(db, 'businesses', businessId, 'products', movement.productId);

    await runTransaction(db, async (txn) => {
      const prodDoc = await txn.get(productRef);
      if (!prodDoc.exists()) {
        throw new Error('Mahsulot topilmadi');
      }

      const prodData = prodDoc.data() as Product;
      const currentStock = prodData.stock || 0;
      const delta = movement.quantity; // positive for Kirim, negative for Chiqim
      const newStock = currentStock + delta;

      if (newStock < 0) {
        throw new Error(`Omborda yetarli qoldiq mavjud emas! Hozirgi qoldiq: ${currentStock} dona.`);
      }

      txn.update(productRef, {
        stock: newStock,
        warehouseId: movement.warehouseId || prodData.warehouseId,
        updatedAt: now
      });

      const movementDoc: StockMovement = {
        ...movement,
        id: movementId,
        businessId,
        productName: prodData.name,
        createdAt: now,
      };

      txn.set(movementRef, movementDoc);
    });
  }

  // Customers
  static async getCustomers(businessId: string): Promise<Customer[]> {
    const colRef = collection(db, 'businesses', businessId, 'customers');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
  }

  static async saveCustomer(businessId: string, customer: Customer): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'customers', customer.id);
    await setDoc(docRef, { ...customer, businessId }, { merge: true });
  }

  // Orders
  static async getOrders(businessId: string): Promise<Order[]> {
    const colRef = collection(db, 'businesses', businessId, 'orders');
    const snap = await getDocs(colRef);
    return snap.docs
      .map(d => ({ ...d.data(), id: d.id } as Order))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  static async createOrder(businessId: string, order: Order): Promise<void> {
    const orderRef = doc(db, 'businesses', businessId, 'orders', order.id);
    const customerRef = doc(db, 'businesses', businessId, 'customers', order.customerId);

    // Save order
    await setDoc(orderRef, { ...order, businessId });

    // Decrement stock for each item safely
    for (const item of order.items) {
      await this.addStockMovement(businessId, {
        warehouseId: 'wh_default',
        productId: item.productId,
        productName: item.productName,
        type: 'SALE',
        quantity: -item.quantity,
        reason: `Buyurtma #${order.id} sotuv`,
        referenceId: order.id,
        createdBy: 'CRM Order System'
      });
    }

    // Update customer stats
    try {
      const custDoc = await getDoc(customerRef);
      if (custDoc.exists()) {
        const custData = custDoc.data() as Customer;
        await setDoc(customerRef, {
          totalOrders: (custData.totalOrders || 0) + 1,
          totalSpent: (custData.totalSpent || 0) + order.total,
          status: 'Buyurtma berdi',
          leadScore: Math.min(100, (custData.leadScore || 50) + 15),
          lastInteraction: Date.now()
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Customer stats update error:', e);
    }
  }

  static async updateOrderStatus(
    businessId: string,
    orderId: string,
    orderStatus: Order['orderStatus'],
    paymentStatus?: Order['paymentStatus']
  ): Promise<void> {
    const orderRef = doc(db, 'businesses', businessId, 'orders', orderId);
    const updates: Partial<Order> = { orderStatus, updatedAt: Date.now() };
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    await setDoc(orderRef, updates, { merge: true });

    // Also update root orders/{orderId} for M4/M5 orders
    try {
      const rootOrderRef = doc(db, 'orders', orderId);
      const rootSnap = await getDoc(rootOrderRef);
      if (rootSnap.exists() && rootSnap.data()?.businessId === businessId) {
        const rootUpdates: Record<string, any> = { updatedAt: Date.now() };
        if (orderStatus) {
          rootUpdates.orderStatus = orderStatus;
          const s = orderStatus.toLowerCase();
          if (['pending_confirmation', 'confirmed', 'processing', 'completed', 'cancelled'].includes(s)) {
            rootUpdates.status = s;
          }
        }
        if (paymentStatus) rootUpdates.paymentStatus = paymentStatus;
        await setDoc(rootOrderRef, rootUpdates, { merge: true });
      }
    } catch (e) {
      // Non-blocking root sync
    }
  }

  // Update Business Settings
  static async updateBusiness(business: Business): Promise<void> {
    const bizRef = doc(db, 'businesses', business.id);
    await setDoc(bizRef, business, { merge: true });
  }
}
