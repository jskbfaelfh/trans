import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, Copy, Check, Filter } from 'lucide-react';
import { api } from '../services/api';
import type { Order, Driver } from '../services/api';

const NotificationCenter: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersData, driversData] = await Promise.all([
          api.getOrders(),
          api.getDrivers()
        ]);
        setOrders(ordersData);
        setDrivers(driversData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredOrders = orders.filter(o => {
    const matchDriver = selectedDriverId === 'all' || o.driverId === selectedDriverId;
    const matchStatus = selectedStatus === 'all' || o.status === selectedStatus;
    return matchDriver && matchStatus;
  });

  // صياغة رسالة الواتساب الجاهزة لكل طلب
  const generateWhatsAppMessage = (order: Order) => {
    const statusLabel = 
      order.status === 'delivered' ? '✅ تم التسليم/واصل' :
      order.status === 'postponed' ? '⏳ مؤجل' :
      order.status === 'returned' ? '❌ راجع' :
      order.status === 'assigned' ? '🚚 قيد التوصيل مع المندوب' : '📦 قيد الانتظار';

    return `*تحديث طلب أكسبرس ⚡*
📍 الباركود: ${order.barcode}
👤 الزبون: ${order.customerName}
📞 الهاتف: ${order.phone}
🏠 العنوان: ${order.address}
💰 المبلغ: ${Number(order.amount).toLocaleString()} د.ع
📊 الحالة: ${statusLabel}
${order.driverName ? `🚚 المندوب: ${order.driverName}` : ''}
${order.notes ? `📝 ملاحظات: ${order.notes}` : ''}`;
  };

  const handleSendWhatsApp = (order: Order) => {
    const message = generateWhatsAppMessage(order);
    const encodedMsg = encodeURIComponent(message);
    // إرسال عبر الواتساب للمندوب أو جروب التبليغ
    window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
  };

  const handleCopyMessage = (order: Order) => {
    const message = generateWhatsAppMessage(order);
    navigator.clipboard.writeText(message);
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare style={{ color: '#25D366' }} />
          <h3>مركز التبليغات الذكية ومشاركتها مع الواتساب</h3>
        </div>
      </div>

      {/* شريط الفلترة */}
      <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            <Filter size={14} style={{ display: 'inline', marginLeft: '4px' }} />
            فلترة حسب المندوب:
          </label>
          <select
            className="input"
            value={selectedDriverId}
            onChange={e => setSelectedDriverId(e.target.value)}
          >
            <option value="all">كل المناديب</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>فلترة حسب الحالة:</label>
          <select
            className="input"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="delivered">واصل</option>
            <option value="assigned">مع المندوب</option>
            <option value="postponed">مؤجل</option>
            <option value="returned">راجع</option>
          </select>
        </div>
      </div>

      {/* قائمة الطلبات ومشاركتها */}
      {loading ? (
        <div className="loading-state">جاري تحميل بيانات التبليغات...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={48} />
          <p>لا توجد طلبات مطابقة للفلتر المباشر</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredOrders.map(order => (
            <div key={order.id} className="card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #25D366' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--primary-color)' }}>{order.barcode}</strong>
                <span className={`status-badge ${order.status}`}>{order.status}</span>
              </div>
              <p style={{ margin: '0.25rem 0', fontWeight: 600 }}>{order.customerName} ({order.phone})</p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.address}</p>

              <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '0.75rem 0' }} />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn"
                  style={{ background: '#25D366', color: '#fff', flex: 1, fontSize: '0.85rem' }}
                  onClick={() => handleSendWhatsApp(order)}
                >
                  <Send size={14} />
                  إرسال للواتساب
                </button>
                <button
                  className="btn"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  onClick={() => handleCopyMessage(order)}
                >
                  {copiedId === order.id ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                  {copiedId === order.id ? 'تم النسخ' : 'نسخ النص'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
