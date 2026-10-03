import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export class CustomerService {
  /**
   * Generates a deterministic customer ID scoped to business and telegram user ID
   * to guarantee idempotency and prevent duplicate customer records.
   */
  static getCustomerId(businessId: string, telegramUserId: string): string {
    const cleanBiz = businessId.replace(/[^a-zA-Z0-9]/g, '_');
    return `cust_${cleanBiz}_${telegramUserId}`;
  }

  /**
   * Upserts a customer based on incoming Telegram user information.
   * If customer exists: updates username, name, phone, and lastMessageAt.
   * If not: creates a new customer profile under customers collection.
   */
  static async upsertTelegramCustomer(params: {
    businessId: string;
    telegramUserId: string;
    telegramChatId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    phone?: string;
  }): Promise<Customer> {
    const { businessId, telegramUserId, telegramChatId, username, firstName, lastName, phone } = params;
    const customerId = this.getCustomerId(businessId, telegramUserId);
    const customerRef = doc(db, 'customers', customerId);
    const now = Date.now();

    try {
      const snap = await getDoc(customerRef);

      if (snap.exists()) {
        const existing = snap.data() as Customer;
        const updatePayload: Partial<Customer> = {
          updatedAt: now,
          lastMessageAt: now,
        };

        if (username && username !== existing.username) updatePayload.username = username;
        if (firstName && firstName !== existing.firstName) updatePayload.firstName = firstName;
        if (lastName && lastName !== existing.lastName) updatePayload.lastName = lastName;
        if (phone && phone !== existing.phone) updatePayload.phone = phone;

        await updateDoc(customerRef, updatePayload);
        return {
          ...existing,
          ...updatePayload,
        };
      } else {
        const newCustomer: Customer = {
          id: customerId,
          businessId,
          telegramUserId,
          telegramChatId,
          username: username || '',
          firstName: firstName || 'Mijoz',
          lastName: lastName || '',
          phone: phone || '',
          source: 'telegram',
          totalOrders: 0,
          totalSpent: 0,
          status: 'Yangi',
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
        };

        await setDoc(customerRef, newCustomer);
        return newCustomer;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `customers/${customerId}`);
    }
  }

  /**
   * Fetch single customer by ID
   */
  static async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const snap = await getDoc(doc(db, 'customers', customerId));
      if (!snap.exists()) return null;
      return snap.data() as Customer;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `customers/${customerId}`);
    }
  }

  /**
   * Fetch all customers belonging to a specific business
   */
  static async getCustomersByBusiness(businessId: string): Promise<Customer[]> {
    try {
      const q = query(collection(db, 'customers'), where('businessId', '==', businessId));
      const snap = await getDocs(q);
      const list: Customer[] = [];
      snap.forEach((d) => list.push(d.data() as Customer));
      return list.sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'customers');
    }
  }

  /**
   * Realtime subscription for customers list in dashboard
   */
  static subscribeCustomers(
    businessId: string,
    onData: (customers: Customer[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, 'customers'), where('businessId', '==', businessId));
    return onSnapshot(
      q,
      (snap) => {
        const list: Customer[] = [];
        snap.forEach((d) => list.push(d.data() as Customer));
        list.sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
        onData(list);
      },
      (err) => {
        console.error('[CustomerService realtime error]', err);
        if (onError) onError(err);
      }
    );
  }
}
