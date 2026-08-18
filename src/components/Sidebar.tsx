import { LayoutDashboard, Package, Users, LogOut, Smartphone, FileSpreadsheet } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'orders' | 'drivers' | 'driver-app' | 'phase5-reports';
  setActiveTab: (tab: 'dashboard' | 'orders' | 'drivers' | 'driver-app' | 'phase5-reports') => void;
  userRole?: string;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole, onLogout }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>أكسبرس ⚡</h2>
      </div>
      
      <nav className="sidebar-nav">
        {userRole !== 'driver' && (
          <>
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              style={{ width: '100%', textAlign: 'right', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <LayoutDashboard />
              <span>لوحة التحكم 📊</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
              style={{ width: '100%', textAlign: 'right', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              <Package />
              <span>إدارة الطلبات 📦</span>
            </button>
          </>
        )}

        {userRole === 'driver' && (
          <button
            className={`nav-item ${activeTab === 'driver-app' ? 'active' : ''}`}
            onClick={() => setActiveTab('driver-app')}
            style={{ width: '100%', textAlign: 'right', border: 'none', background: 'none', cursor: 'pointer', color: '#38bdf8' }}
          >
            <Smartphone />
            <span>قيد 📱</span>
          </button>
        )}

        {userRole === 'admin' && (
          <button
            className={`nav-item ${activeTab === 'drivers' ? 'active' : ''}`}
            onClick={() => setActiveTab('drivers')}
            style={{ width: '100%', textAlign: 'right', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <Users />
            <span>المناديب والمحاسبة 👥</span>
          </button>
        )}

        {userRole !== 'driver' && (
          <button
            className={`nav-item ${activeTab === 'phase5-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('phase5-reports')}
            style={{ width: '100%', textAlign: 'right', border: 'none', background: 'none', cursor: 'pointer', color: '#8b5cf6' }}
          >
            <FileSpreadsheet />
            <span>التقارير 📄</span>
          </button>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button
            className="nav-item"
            style={{ color: '#ef4444', width: '100%', textAlign: 'right', border: 'none', background: 'none' }}
            onClick={onLogout}
          >
            <LogOut />
            <span>تسجيل الخروج 🚪</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
