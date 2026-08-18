import { Package, CheckCircle, AlertTriangle, Warehouse, Truck, ArrowLeft, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Stats, Order } from '../services/api';

interface DashboardProps {
  onNavigateToOrders?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToOrders }) => {
  const [stats, setStats] = useState<Stats>({ total: 0, delivered: 0, pending: 0, returned: 0, postponed: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, ordersData] = await Promise.all([
        api.getStats(),
        api.getOrders()
      ]);
      setStats(statsData);
      setRecentOrders(ordersData.slice(0, 5));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalAmount = recentOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

  return (
    <main className="dashboard-container">
      {/* Header Summary */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', color: '#fff', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 الإحصائيات
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            متابعة فورية ⚡
          </p>
        </div>
        {onNavigateToOrders && (
          <button
            className="btn btn-primary"
            style={{ fontWeight: 700, height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={onNavigateToOrders}
          >
            <span>إدارة الطلبات 📦</span>
            <ArrowLeft size={18} />
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon primary"><Package size={26} /></div>
          <div className="stat-details">
            <h3>الكل 📦</h3>
            <p>{loading ? '...' : stats.total}</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderRight: '4px solid #3b82f6' }}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}><Warehouse size={26} /></div>
          <div className="stat-details">
            <h3>المخزن 🏬</h3>
            <p>{loading ? '...' : (stats.inWarehouse || stats.pending)}</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderRight: '4px solid #8b5cf6' }}>
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}><Truck size={26} /></div>
          <div className="stat-details">
            <h3>قيد الميدان 🚚</h3>
            <p>{loading ? '...' : (stats.assigned || 0)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><CheckCircle size={26} /></div>
          <div className="stat-details">
            <h3>واصل 🟢</h3>
            <p>{loading ? '...' : stats.delivered}</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderRight: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}><Clock size={26} /></div>
          <div className="stat-details">
            <h3>مؤجل 🟠</h3>
            <p>{loading ? '...' : (stats.postponed || 0)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger"><AlertTriangle size={26} /></div>
          <div className="stat-details">
            <h3>راجع 🔴</h3>
            <p>{loading ? '...' : stats.returned + (stats.damaged || 0)}</p>
          </div>
        </div>
      </section>

      {/* Quick Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* Recent Orders Overview */}
        <div className="card" style={{ borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>أحدث الشحنات ⚡</h3>
            {onNavigateToOrders && (
              <button onClick={onNavigateToOrders} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                الكل ⬅️
              </button>
            )}
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>لا توجد شحنات.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <div>
                    <strong style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>{o.barcode}</strong>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.customerName} ({o.address})</span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{Number(o.amount).toLocaleString()} د.ع</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>{o.merchantName || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Operations Panel */}
        <div className="card" style={{ borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>العمليات 🚀</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              وصول سريع ⚡
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '44px', fontWeight: 700, borderRadius: '10px' }}
                onClick={onNavigateToOrders}
              >
                إدارة الطلبات 📦
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>إجمالي المبالغ:</span>
            <strong style={{ fontSize: '1.3rem', color: 'var(--primary-color)' }}>{totalAmount.toLocaleString()} د.ع</strong>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
