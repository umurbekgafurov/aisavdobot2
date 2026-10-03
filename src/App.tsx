import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  LogOut,
  RefreshCw,
  Store,
  User as UserIcon,
  ShieldCheck,
  CheckCircle2,
  Database
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { WarehousesPage } from './pages/WarehousesPage';
import { ProductsListPage } from './pages/ProductsListPage';
import { ProductNewPage } from './pages/ProductNewPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { WarehouseView } from './components/WarehouseView';
import { CustomersView } from './components/CustomersView';
import { ConversationsView } from './components/ConversationsView';
import { OrdersView } from './components/OrdersView';
import { TelegramBotView } from './components/TelegramBotView';
import { AIRecommendationsView } from './components/AIRecommendationsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

import {
  Product,
  Warehouse,
  Customer,
  Conversation,
  Order,
  StockMovement,
  AIFollowupRecommendation,
  Business
} from './types';
import { AuthService, FirestoreService, UserDocument, AppAuthUser } from './services/firebaseService';
import { CustomerService } from './services/customerService';
import { ConversationService } from './services/conversationService';
import { OrderService } from './services/orderService';
import {
  INITIAL_WAREHOUSES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_FOLLOWUPS
} from './data/mockData';

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | AppAuthUser | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Path routing: supports '/', '/login', '/register', '/dashboard', '/warehouses', '/products', '/products/new', '/products/:id'
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Core business & Firestore data state
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [followups, setFollowups] = useState<AIFollowupRecommendation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const activeSubscriptionsRef = useRef<Array<() => void>>([]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);

    // Sync sidebar currentTab if applicable
    if (path === '/warehouses') setCurrentTab('warehouse');
    else if (path.startsWith('/products')) setCurrentTab('products');
    else if (path === '/dashboard') setCurrentTab('dashboard');
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname || '/';
      setCurrentPath(p);
      if (p === '/warehouses') setCurrentTab('warehouse');
      else if (p.startsWith('/products')) setCurrentTab('products');
      else if (p === '/dashboard') setCurrentTab('dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Firebase Auth state listener with persistence
  useEffect(() => {
    const unsubscribe = AuthService.onAuthChange(async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserData(user.uid);
        // If user was on /login or /register, redirect to /dashboard
        if (window.location.pathname === '/login' || window.location.pathname === '/register') {
          navigate('/dashboard');
        }
      } else {
        // Clean up any active realtime listeners on logout
        activeSubscriptionsRef.current.forEach((unsub) => unsub());
        activeSubscriptionsRef.current = [];
        setUserDoc(null);
        setBusiness(null);
        setProducts([]);
        setWarehouses([]);
        setCustomers([]);
        setOrders([]);
        setMovements([]);
        setFollowups([]);
      }
      setIsAuthChecking(false);
    });

    return () => {
      unsubscribe();
      activeSubscriptionsRef.current.forEach((unsub) => unsub());
      activeSubscriptionsRef.current = [];
    };
  }, []);

  // 2. Fetch user's business and Firestore collections
  const loadUserData = async (uid: string) => {
    setIsLoadingData(true);
    try {
      const { userDoc: uDoc, business: biz } = await AuthService.getUserProfileAndBusiness(uid);
      if (uDoc && biz) {
        setUserDoc(uDoc);
        setBusiness(biz);

        // Fetch subcollections for this specific business from Firestore with template fallback
        try {
          const [prods, whs, custs, ords, movs] = await Promise.all([
            FirestoreService.getProducts(biz.id),
            FirestoreService.getWarehouses(biz.id),
            FirestoreService.getCustomers(biz.id),
            FirestoreService.getOrders(biz.id),
            FirestoreService.getStockMovements(biz.id)
          ]);

          setProducts(prods && prods.length > 0 ? prods : INITIAL_PRODUCTS.map(p => ({ ...p, businessId: biz.id })));
          setWarehouses(whs && whs.length > 0 ? whs : INITIAL_WAREHOUSES.map(w => ({ ...w, businessId: biz.id })));
          setCustomers(custs && custs.length > 0 ? custs : INITIAL_CUSTOMERS.map(c => ({ ...c, businessId: biz.id })));
          setOrders(ords && ords.length > 0 ? ords : INITIAL_ORDERS.map(o => ({ ...o, businessId: biz.id })));
          setMovements(movs && movs.length > 0 ? movs : INITIAL_STOCK_MOVEMENTS.map((m: StockMovement) => ({ ...m, businessId: biz.id })));
        } catch (fErr) {
          console.warn('Notice loading Firestore subcollections, using template data:', fErr);
          setProducts(INITIAL_PRODUCTS.map(p => ({ ...p, businessId: biz.id })));
          setWarehouses(INITIAL_WAREHOUSES.map(w => ({ ...w, businessId: biz.id })));
          setCustomers(INITIAL_CUSTOMERS.map(c => ({ ...c, businessId: biz.id })));
          setOrders(INITIAL_ORDERS.map(o => ({ ...o, businessId: biz.id })));
          setMovements(INITIAL_STOCK_MOVEMENTS.map((m: StockMovement) => ({ ...m, businessId: biz.id })));
        }
        setFollowups(INITIAL_FOLLOWUPS);

        // Realtime Firestore listeners for customers, conversations, and orders
        try {
          // Unsubscribe any previous listeners before registering new ones
          activeSubscriptionsRef.current.forEach((unsub) => unsub());
          activeSubscriptionsRef.current = [];

          const unsubCust = CustomerService.subscribeCustomers(biz.id, (realtimeCusts) => {
            if (realtimeCusts && realtimeCusts.length > 0) {
              setCustomers(realtimeCusts);
            }
          });

          const unsubConv = ConversationService.subscribeConversations(biz.id, (realtimeConvs) => {
            setConversations(realtimeConvs);
          });

          const unsubOrd = OrderService.subscribeOrders(biz.id, (realtimeOrds) => {
            if (realtimeOrds && realtimeOrds.length > 0) {
              setOrders(realtimeOrds);
            }
          });

          activeSubscriptionsRef.current = [unsubCust, unsubConv, unsubOrd];
        } catch (subErr) {
          console.warn('Realtime subscription notice:', subErr);
        }
      }
    } catch (err) {
      console.warn('Notice loading business data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handlers for Warehouses
  const handleCreateWarehouse = async (data: { name: string; address: string }) => {
    if (!business) return;
    const now = Date.now();
    const newWh: Warehouse = {
      id: `wh_${now}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: business.id,
      name: data.name,
      address: data.address,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await FirestoreService.saveWarehouse(business.id, newWh);
      const updated = await FirestoreService.getWarehouses(business.id);
      setWarehouses(updated);
    } catch {
      setWarehouses((prev) => [newWh, ...prev]);
    }
  };

  const handleUpdateWarehouse = async (warehouse: Warehouse) => {
    if (!business) return;
    try {
      await FirestoreService.saveWarehouse(business.id, warehouse);
      const updated = await FirestoreService.getWarehouses(business.id);
      setWarehouses(updated);
    } catch {
      setWarehouses((prev) => prev.map((w) => (w.id === warehouse.id ? warehouse : w)));
    }
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    if (!business) return;
    try {
      await FirestoreService.deleteWarehouse(business.id, warehouseId);
      const updated = await FirestoreService.getWarehouses(business.id);
      setWarehouses(updated);
    } catch {
      setWarehouses((prev) => prev.filter((w) => w.id !== warehouseId));
    }
  };

  // Handlers for Products
  const handleCreateProduct = async (prod: Product) => {
    if (!business) return;
    try {
      await FirestoreService.createProduct(business.id, prod, currentUser?.displayName || 'Admin');
      const [updatedProds, updatedMovs] = await Promise.all([
        FirestoreService.getProducts(business.id),
        FirestoreService.getStockMovements(business.id),
      ]);
      setProducts(updatedProds);
      setMovements(updatedMovs);
    } catch {
      setProducts((prev) => [prod, ...prev]);
    }
  };

  const handleUpdateProduct = async (prod: Product) => {
    if (!business) return;
    try {
      await FirestoreService.updateProduct(business.id, prod);
      const updated = await FirestoreService.getProducts(business.id);
      setProducts(updated);
    } catch {
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!business) return;
    try {
      await FirestoreService.deleteProduct(business.id, id);
      const updated = await FirestoreService.getProducts(business.id);
      setProducts(updated);
    } catch {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Handlers for Stock Movements
  const handleAddStockMovement = async (movement: StockMovement) => {
    if (!business) return;
    try {
      await FirestoreService.addStockMovement(business.id, movement);
      const [movs, prods] = await Promise.all([
        FirestoreService.getStockMovements(business.id),
        FirestoreService.getProducts(business.id)
      ]);
      setMovements(movs);
      setProducts(prods);
    } catch {
      setMovements((prev) => [movement, ...prev]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === movement.productId
            ? { ...p, stock: Math.max(0, p.stock + (movement.type === 'STOCK_IN' ? movement.quantity : -movement.quantity)) }
            : p
        )
      );
    }
  };

  // Handlers for Customers
  const handleSaveCustomer = async (cust: Customer) => {
    if (!business) return;
    try {
      await FirestoreService.saveCustomer(business.id, cust);
      const updated = await FirestoreService.getCustomers(business.id);
      setCustomers(updated);
    } catch {
      setCustomers((prev) => {
        const exists = prev.some((c) => c.id === cust.id);
        return exists ? prev.map((c) => (c.id === cust.id ? cust : c)) : [cust, ...prev];
      });
    }
  };

  // Handlers for Orders
  const handleCreateOrder = async (order: Order) => {
    if (!business) return;
    try {
      await FirestoreService.createOrder(business.id, order);
      const [ords, prods, custs, movs] = await Promise.all([
        FirestoreService.getOrders(business.id),
        FirestoreService.getProducts(business.id),
        FirestoreService.getCustomers(business.id),
        FirestoreService.getStockMovements(business.id),
      ]);
      setOrders(ords);
      setProducts(prods);
      setCustomers(custs);
      setMovements(movs);
    } catch {
      setOrders((prev) => [order, ...prev]);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    orderStatus: Order['orderStatus'],
    paymentStatus?: Order['paymentStatus']
  ) => {
    if (!business) return;
    try {
      await FirestoreService.updateOrderStatus(business.id, orderId, orderStatus, paymentStatus);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: orderStatus,
                orderStatus,
                ...(paymentStatus ? { paymentStatus } : {}),
                updatedAt: Date.now(),
              }
            : o
        )
      );
    } catch {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: orderStatus,
                orderStatus,
                ...(paymentStatus ? { paymentStatus } : {}),
                updatedAt: Date.now(),
              }
            : o
        )
      );
    }
  };

  // Handlers for Followups
  const handleUpdateFollowupStatus = async (id: string, status: 'sent' | 'dismissed') => {
    setFollowups((prev) => prev.filter(f => f.id !== id));
  };

  // Handlers for Settings
  const handleSaveBusiness = async (b: Business) => {
    await FirestoreService.updateBusiness(b);
    setBusiness(b);
  };

  // Logout handler
  const handleLogout = async () => {
    await AuthService.logoutUser();
    navigate('/login');
  };

  // Auth checking initial splash
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Firebase ulanishi tekshirilmoqda...</p>
      </div>
    );
  }

  // 1. Landing Page route (remains unchanged as required)
  if (currentPath === '/') {
    return (
      <LandingPage
        onStart={() => {
          if (currentUser) navigate('/dashboard');
          else navigate('/login');
        }}
        onExploreDemo={() => {
          if (currentUser) navigate('/dashboard');
          else navigate('/register');
        }}
      />
    );
  }

  // 2. /login Page
  if (currentPath === '/login') {
    if (currentUser) {
      navigate('/dashboard');
      return null;
    }
    return (
      <LoginPage
        onSuccess={() => navigate('/dashboard')}
        onNavigateRegister={() => navigate('/register')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 3. /register Page
  if (currentPath === '/register') {
    if (currentUser) {
      navigate('/dashboard');
      return null;
    }
    return (
      <RegisterPage
        onSuccess={() => navigate('/dashboard')}
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 4. Protected Route: Unauthenticated users are redirected to /login
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  // Helper to extract productId from /products/:id
  const productDetailMatch = currentPath.match(/^\/products\/([^/]+)$/);
  const detailProductId =
    productDetailMatch && productDetailMatch[1] !== 'new'
      ? productDetailMatch[1]
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'warehouse') navigate('/warehouses');
          else if (tab === 'products') navigate('/products');
          else if (tab === 'dashboard') navigate('/dashboard');
          else navigate('/dashboard');
        }}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        pendingAlertCount={0}
        businessName={business?.name || "Do'kon"}
        userEmail={currentUser.email || undefined}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm hidden sm:inline">
                {business?.name || "Yuklanmoqda..."}
              </span>
              {currentUser && (currentUser as any).isDemo ? (
                <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 rounded-full border border-amber-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Sinov / Demo Rejimi
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Cloud Firestore Ulangan
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => currentUser && loadUserData(currentUser.uid)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              title="Firestore ma'lumotlarini yangilash"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-all"
            >
              Landing
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>

            <div className="h-4 w-px bg-slate-200"></div>

            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : currentUser.email?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentUser.email}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page View Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isLoadingData ? (
            <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Cloud Firestore dan ma'lumotlar yuklanmoqda...</span>
            </div>
          ) : (
            <>
              {/* Route: /warehouses */}
              {currentPath === '/warehouses' && (
                <WarehousesPage
                  warehouses={warehouses}
                  products={products}
                  onCreateWarehouse={handleCreateWarehouse}
                  onUpdateWarehouse={handleUpdateWarehouse}
                  onDeleteWarehouse={handleDeleteWarehouse}
                />
              )}

              {/* Route: /products/new */}
              {currentPath === '/products/new' && (
                <ProductNewPage
                  warehouses={warehouses}
                  onBack={() => navigate('/products')}
                  onSubmit={handleCreateProduct}
                />
              )}

              {/* Route: /products/:id */}
              {detailProductId && business && (
                <ProductDetailPage
                  productId={detailProductId}
                  businessId={business.id}
                  warehouses={warehouses}
                  onBack={() => navigate('/products')}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              )}

              {/* Route: /products list */}
              {currentPath === '/products' && (
                <ProductsListPage
                  products={products}
                  warehouses={warehouses}
                  onNavigateNew={() => navigate('/products/new')}
                  onNavigateDetail={(id) => navigate(`/products/${id}`)}
                  onDeleteProduct={handleDeleteProduct}
                />
              )}

              {/* Tab: dashboard */}
              {currentPath === '/dashboard' && currentTab === 'dashboard' && (
                <DashboardView
                  products={products}
                  customers={customers}
                  orders={orders}
                  followups={followups}
                  onOpenCustomer={() => setCurrentTab('customers')}
                  onOpenOrder={() => setCurrentTab('orders')}
                  onNavigateTab={(tab) => {
                    setCurrentTab(tab);
                    if (tab === 'warehouse') navigate('/warehouses');
                    else if (tab === 'products') navigate('/products');
                  }}
                  onTriggerTelegramDemo={() => setCurrentTab('telegram')}
                />
              )}

              {/* Conversations tab */}
              {currentPath === '/dashboard' && currentTab === 'conversations' && business && (
                <ConversationsView
                  businessId={business.id}
                  conversations={conversations}
                  customers={customers}
                  orders={orders}
                  onRefresh={() => currentUser && loadUserData(currentUser.uid)}
                />
              )}

              {/* Other tabs within dashboard */}
              {currentPath === '/dashboard' && currentTab === 'customers' && (
                <CustomersView
                  customers={customers}
                  orders={orders}
                  onSaveCustomer={handleSaveCustomer}
                />
              )}

              {currentPath === '/dashboard' && currentTab === 'orders' && (
                <OrdersView
                  orders={orders}
                  products={products}
                  customers={customers}
                  onUpdateStatus={handleUpdateOrderStatus}
                />
              )}

              {currentPath === '/dashboard' && currentTab === 'telegram' && (
                <TelegramBotView
                  products={products}
                  customers={customers}
                  onOrderCreated={handleCreateOrder}
                  onCustomerUpdated={handleSaveCustomer}
                />
              )}

              {currentPath === '/dashboard' && currentTab === 'ai' && (
                <AIRecommendationsView
                  customers={customers}
                  followups={followups}
                  products={products}
                  onUpdateFollowupStatus={handleUpdateFollowupStatus}
                />
              )}

              {currentPath === '/dashboard' && currentTab === 'analytics' && (
                <AnalyticsView
                  products={products}
                  orders={orders}
                  customers={customers}
                />
              )}

              {currentPath === '/dashboard' && currentTab === 'settings' && business && (
                <SettingsView
                  business={business}
                  onSaveBusiness={handleSaveBusiness}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
