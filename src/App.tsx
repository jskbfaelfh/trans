import './App.css';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import OrdersManagement from './components/OrdersManagement';
import DriversList from './components/DriversList';
import DriverMobileApp from './components/DriverMobileApp';
import Phase5Reports from './components/Phase5Reports';
import LoginModal from './components/LoginModal';
import type { User } from './services/api';
import { Truck, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'drivers' | 'driver-app' | 'phase5-reports'>('orders');

  // استعادة الجلسة والتحقق من فتح رابط المندوب المباشر
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isDirectDriverMode = urlParams.get('mode') === 'driver' || window.location.hash.includes('driver');

    if (isDirectDriverMode) {
      const driverUser: User = {
        id: 'yi35u16xmsntg8mc',
        username: 'driver_hussein',
        name: 'حسين لفته',
        role: 'driver'
      };
      setCurrentUser(driverUser);
      setActiveTab('driver-app');
      localStorage.setItem('nanax_user', JSON.stringify(driverUser));
      return;
    }

    const savedUserStr = localStorage.getItem('nanax_user');
    if (savedUserStr) {
      try {
        const savedUser: User = JSON.parse(savedUserStr);
        setCurrentUser(savedUser);
        if (savedUser.role === 'driver') {
          setActiveTab('driver-app');
        } else {
          setActiveTab('orders');
        }
      } catch {
        localStorage.removeItem('nanax_user');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('nanax_user');
    setCurrentUser(null);
  };

  const handleSwitchRole = (role: 'admin' | 'supervisor' | 'driver') => {
    let mockUser: User;
    if (role === 'admin') {
      mockUser = { id: 'u1', username: 'admin', name: 'المدير العام', role: 'admin' };
      setActiveTab('orders');
    } else if (role === 'supervisor') {
      mockUser = { id: 'u2', username: 'supervisor', name: 'مشرف المتابعة', role: 'supervisor' };
      setActiveTab('orders');
    } else {
      mockUser = { id: 'yi35u16xmsntg8mc', username: 'driver_hussein', name: 'حسين لفته', role: 'driver' };
      setActiveTab('driver-app');
    }
    setCurrentUser(mockUser);
    localStorage.setItem('nanax_user', JSON.stringify(mockUser));
  };

  if (!currentUser) {
    return <LoginModal onLoginSuccess={(user) => {
      setCurrentUser(user);
      if (user.role === 'driver') {
        setActiveTab('driver-app');
      } else {
        setActiveTab('orders');
      }
    }} />;
  }

  // إذا كان المستخدم هو المندوب (Driver Mobile Standalone Layout)
  if (currentUser.role === 'driver') {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1329', color: '#f8fafc', padding: '0.75rem', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Mobile App Standalone Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid #334155', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Truck size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Nanax Express Driver</span>
              <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{currentUser.name} 🛵</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => handleSwitchRole('admin')}
              style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              title="التبديل لحساب الإدارة"
            >
              👑 الإدارة
            </button>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.35rem 0.55rem', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}
              title="تسجيل الخروج"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        <DriverMobileApp />
      </div>
    );
  }

  // إذا كان المستخدم مديراً أو مشرفاً (Desktop Management Layout)
  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={currentUser.role} onLogout={handleLogout} />
      <div className="main-content">
        <Header user={currentUser} onSwitchRole={handleSwitchRole} />
        {activeTab === 'dashboard' && <Dashboard onNavigateToOrders={() => setActiveTab('orders')} />}
        {activeTab === 'orders' && <OrdersManagement />}
        {activeTab === 'drivers' && currentUser.role === 'admin' && <DriversList />}
        {activeTab === 'drivers' && currentUser.role !== 'admin' && (
          <div className="card" style={{ marginTop: '1.5rem', color: '#ef4444' }}>
            ⚠️ لا تملك الصلاحية المالية للوصول لجدول التصفية والمناديب (خاص بالحساب الإداري فقط).
          </div>
        )}
        {activeTab === 'driver-app' && <DriverMobileApp />}
        {activeTab === 'phase5-reports' && <div className="reports-container"><Phase5Reports /></div>}
      </div>
    </div>
  );
}

export default App;
