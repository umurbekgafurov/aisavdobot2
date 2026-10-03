import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  ShoppingBag,
  Warehouse,
  Boxes,
  BarChart3,
  Bot,
  Send,
  Settings,
  HelpCircle,
  Menu,
  X,
  LogOut
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'conversations'
  | 'customers'
  | 'orders'
  | 'warehouse'
  | 'products'
  | 'analytics'
  | 'ai'
  | 'telegram'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onToggle: () => void;
  pendingAlertCount?: number;
  businessName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onToggle,
  pendingAlertCount = 1,
  businessName = "Telefon Market & Gadgets",
  userEmail,
  onLogout,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Bosh sahifa', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'conversations', label: 'Suhbatlar', icon: <MessageSquare className="w-5 h-5 text-indigo-600" /> },
    { id: 'customers', label: 'Mijozlar', icon: <Users className="w-5 h-5" /> },
    { id: 'orders', label: 'Buyurtmalar', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'warehouse', label: 'Ombor', icon: <Warehouse className="w-5 h-5" /> },
    { id: 'products', label: 'Mahsulotlar', icon: <Boxes className="w-5 h-5" /> },
    { id: 'analytics', label: 'Statistika', icon: <BarChart3 className="w-5 h-5" /> },
    {
      id: 'ai',
      label: 'AI Tavsiyalar',
      icon: <Bot className="w-5 h-5 text-indigo-500" />,
      badge: pendingAlertCount > 0 ? pendingAlertCount : undefined,
    },
    { id: 'telegram', label: 'Telegram Bot', icon: <Send className="w-5 h-5 text-sky-500" /> },
    { id: 'settings', label: 'Sozlamalar', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-slate-200 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 text-white rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-md shadow-sky-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">AI SavdoBot</h1>
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Telegram CRM
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Store Quick Badge */}
        <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Do'kon</div>
          <div className="text-sm font-semibold text-slate-800 truncate">{businessName}</div>
          {userEmail && (
            <div className="text-[11px] text-slate-400 truncate mt-0.5">{userEmail}</div>
          )}
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Firestore Ulangan
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-sky-600' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold text-white bg-amber-500 rounded-full animate-bounce">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Helper & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              Tizimdan chiqish
            </button>
          )}
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-sky-50 rounded-xl border border-indigo-100/60 text-xs">
            <div className="font-semibold text-indigo-900 flex items-center gap-1.5 mb-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
              Firebase Database
            </div>
            <p className="text-indigo-700/80 leading-relaxed">
              Ma'lumotlar Cloud Firestore bazasida xavfsiz saqlanmoqda.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
