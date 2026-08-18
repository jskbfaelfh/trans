import { Package, Plus, RefreshCw, ScanLine, Truck, Send, Zap, Barcode, Check, X, Warehouse, CheckCircle2, Clock, XCircle, Layers, Share2, Search, Edit3, Trash2, Eye, Phone, MapPin, User, Store, Calendar, DollarSign, Printer, Play, Lock, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { Order, Driver, Stats, DriverSession } from '../services/api';
import SmartScan from './SmartScan';
import { twoWords } from '../utils/textUtils';

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'in_warehouse':
    case 'pending': return 'المخزن 🏬';
    case 'assigned': return 'مع المندوب 🚚';
    case 'delivered': return 'واصل 🟢';
    case 'postponed': return 'مؤجل 🟠';
    case 'transferred': return 'تحويل 🔀';
    case 'returned': return 'راجع 🔴';
    case 'damaged': return 'تالف ⚠️';
    default: return status;
  }
};

const OrdersManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sessions, setSessions] = useState<DriverSession[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, delivered: 0, pending: 0, returned: 0, postponed: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showSmartScan, setShowSmartScan] = useState(true);
  const [showExpressScanner, setShowExpressScanner] = useState(false);
  const [expressDriverId, setExpressDriverId] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scanLogs, setScanLogs] = useState<{ id: string; barcode: string; driverName: string; time: string; success: boolean; text: string }[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // حالة بدء وإغلاق الجلسات من صفحة الطلبات
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [startSessionDriverId, setStartSessionDriverId] = useState('');
  const [startSessionNotes, setStartSessionNotes] = useState('');
  const [startingSession, setStartingSession] = useState(false);
  const [sessionSuccessMsg, setSessionSuccessMsg] = useState('');

  const [sessionToClose, setSessionToClose] = useState<DriverSession | null>(null);
  const [closeSessionNotes, setCloseSessionNotes] = useState('');
  const [closingSession, setClosingSession] = useState(false);

  // حالة بطاقة تفاصيل الطلب المثبتة
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // حالة البحث الشامل بالباركود والهاتف
  const [searchTerm, setSearchTerm] = useState('');

  // حالة تعديل كامل بيانات الشحنة
  const [editingFullOrder, setEditingFullOrder] = useState<Order | null>(null);
  const [editOrderForm, setEditOrderForm] = useState({
    barcode: '',
    customerName: '',
    phone: '',
    merchantName: '',
    address: '',
    amount: ''
  });

  const [filterStatus, setFilterStatus] = useState<'all' | 'in_warehouse' | 'assigned' | 'delivered' | 'postponed' | 'transferred' | 'returned'>('all');
  const [selectedDriverMap, setSelectedDriverMap] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ barcode: '', customerName: '', phone: '', address: '', amount: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, driversData, statsData, sessionsData] = await Promise.all([
        api.getOrders(),
        api.getDrivers(),
        api.getStats(),
        api.getSessions()
      ]);
      setOrders(ordersData);
      setDrivers(driversData);
      setStats(statsData);
      setSessions(sessionsData);
    } catch {
      setError('تعذر الاتصال بالسيرفر.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startSessionDriverId) {
      setError('يرجى اختيار المندوب لبدء الجلسة');
      return;
    }
    setStartingSession(true);
    setError('');
    try {
      const newSession = await api.startSession(startSessionDriverId, startSessionNotes);
      setSessionSuccessMsg(`تم بدء جلسة العمل [${newSession.sessionNumber}] بنجاح!`);
      setShowStartSessionModal(false);
      setStartSessionDriverId('');
      setStartSessionNotes('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStartingSession(false);
    }
  };

  const handleCloseSession = async () => {
    if (!sessionToClose) return;
    setClosingSession(true);
    setError('');
    try {
      const closed = await api.closeSession(sessionToClose.id, closeSessionNotes);
      setSessionSuccessMsg(`تم إغلاق وتصفية الجلسة [${closed.sessionNumber}] بنجاح!`);
      setSessionToClose(null);
      setCloseSessionNotes('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClosingSession(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // مزامنة لحظية في الخلفية مع حركة المندوب في الشارع
      loadData();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showExpressScanner) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [showExpressScanner]);

  const playAudioFeedback = (type: 'success' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.value = 300;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  };

  const handleExpressBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scannedBarcode.trim();
    if (!code) return;

    if (!expressDriverId) {
      playAudioFeedback('error');
      setScanLogs(prev => [{
        id: Math.random().toString(),
        barcode: code,
        driverName: '—',
        time: new Date().toLocaleTimeString('ar-IQ'),
        success: false,
        text: '⚠️ حدد المندوب أولاً'
      }, ...prev]);
      setScannedBarcode('');
      return;
    }

    const driver = drivers.find(d => d.id === expressDriverId);
    const driverName = driver ? driver.name : 'المندوب';

    const matchingOrder = orders.find(o => 
      o.barcode.toLowerCase() === code.toLowerCase() || 
      code.toLowerCase().includes(o.barcode.toLowerCase()) || 
      o.barcode.toLowerCase().includes(code.toLowerCase())
    );

    if (!matchingOrder) {
      playAudioFeedback('error');
      setScanLogs(prev => [{
        id: Math.random().toString(),
        barcode: code,
        driverName,
        time: new Date().toLocaleTimeString('ar-IQ'),
        success: false,
        text: `❌ الشحنة [${code}] غير مسجلة`
      }, ...prev]);
    } else if (matchingOrder.status === 'assigned') {
      playAudioFeedback('error');
      setScanLogs(prev => [{
        id: Math.random().toString(),
        barcode: matchingOrder.barcode,
        driverName,
        time: new Date().toLocaleTimeString('ar-IQ'),
        success: false,
        text: `⚠️ الشحنة [${matchingOrder.barcode}] مسندة سابقاً`
      }, ...prev]);
    } else {
      try {
        await api.assignOrder(matchingOrder.id, expressDriverId);
        playAudioFeedback('success');
        setScanLogs(prev => [{
          id: Math.random().toString(),
          barcode: matchingOrder.barcode,
          driverName,
          time: new Date().toLocaleTimeString('ar-IQ'),
          success: true,
          text: `⚡ تحويل [${matchingOrder.barcode}] لـ [${driverName}]`
        }, ...prev]);
        loadData();
      } catch {
        playAudioFeedback('error');
        setScanLogs(prev => [{
          id: Math.random().toString(),
          barcode: matchingOrder.barcode,
          driverName,
          time: new Date().toLocaleTimeString('ar-IQ'),
          success: false,
          text: `❌ فشل التحويل بالسيرفر`
        }, ...prev]);
      }
    }

    setScannedBarcode('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createOrder({
        barcode: form.barcode,
        customerName: form.customerName,
        phone: form.phone,
        address: form.address,
        amount: parseFloat(form.amount),
      });
      setForm({ barcode: '', customerName: '', phone: '', address: '', amount: '' });
      setShowAddOrder(false);
      loadData();
    } catch {
      setError('فشل إضافة الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDriver = async (orderId: string) => {
    const driverId = selectedDriverMap[orderId];
    if (!driverId) return;
    try {
      await api.assignOrder(orderId, driverId);
      loadData();
    } catch {
      setError('فشل التحويل للمندوب.');
    }
  };

  const handleUpdateFullOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFullOrder) return;
    try {
      await api.updateOrder(editingFullOrder.id, {
        barcode: editOrderForm.barcode,
        customerName: editOrderForm.customerName,
        phone: editOrderForm.phone,
        merchantName: editOrderForm.merchantName,
        address: editOrderForm.address,
        amount: parseFloat(editOrderForm.amount) || 0
      });
      setEditingFullOrder(null);
      loadData();
    } catch (err: any) {
      setError('فشل تعديل الشحنة: ' + err.message);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`⚠️ هل أنت أخصائي بتأكيد حذف الشحنة [${order.barcode}] نهائياً من السيستم؟`)) return;
    try {
      await api.deleteOrder(order.id);
      loadData();
    } catch (err: any) {
      setError('فشل حذف الشحنة: ' + err.message);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = !searchTerm.trim() || 
      o.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.phone?.includes(searchTerm) ||
      o.merchantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.address?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'in_warehouse') return o.status === 'in_warehouse' || o.status === 'pending';
    if (filterStatus === 'assigned') return o.status === 'assigned';
    if (filterStatus === 'delivered') return o.status === 'delivered';
    if (filterStatus === 'postponed') return o.status === 'postponed';
    if (filterStatus === 'transferred') return o.status === 'transferred';
    if (filterStatus === 'returned') return o.status === 'returned' || o.status === 'damaged';
    return true;
  });

  const successfulSessionScanCount = scanLogs.filter(l => l.success).length;

  return (
    <main className="dashboard-container">

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Session Success Banner */}
      {sessionSuccessMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{sessionSuccessMsg}</span>
          </div>
          <button onClick={() => setSessionSuccessMsg('')} style={{ color: '#34d399', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📦 إدارة الطلبات
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            إدارة الشحنات والورديات الميدانية 🚚
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="action-btn"
            style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
            onClick={() => setShowStartSessionModal(true)}
          >
            <Play size={17} />
            بدء جلسة لمندوب 🚀
          </button>
          <button
            className="action-btn"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: '#fff', border: 'none', fontWeight: 700 }}
            onClick={() => setShowExpressScanner(!showExpressScanner)}
          >
            <Zap size={18} />
            {showExpressScanner ? 'إخفاء الإسناد' : 'إسناد الباركود ⚡'}
          </button>
          <button className="action-btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={() => setShowSmartScan(!showSmartScan)}>
            <ScanLine size={18} />
            {showSmartScan ? 'إخفاء OCR' : 'قراءة الوصل 📸'}
          </button>
        </div>
      </div>

      {/* Active Sessions Bar */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Clock size={16} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>الورديات والجلسات المفتوحة:</span>
          {sessions.filter(s => s.status === 'active').length === 0 ? (
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>لا توجد جلسات نشطة حالياً</span>
          ) : (
            sessions.filter(s => s.status === 'active').map(s => {
              const count = orders.filter(o => o.sessionId === s.id).length;
              return (
                <div
                  key={s.id}
                  style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '0.2rem 0.5rem 0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{s.driverName} ({s.sessionNumber}) • {count} شحنة</span>
                  <button
                    onClick={() => setSessionToClose(s)}
                    style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '12px', padding: '0.15rem 0.45rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    title="إنهاء وتصفية جلسة هذا المندوب الآن"
                  >
                    🔒 إنهاء وتصفية
                  </button>
                </div>
              );
            })
          )}
        </div>
        <button
          onClick={() => setShowStartSessionModal(true)}
          style={{ background: 'transparent', border: '1px dashed #0284c7', color: '#38bdf8', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <Plus size={14} /> فتح جلسة جديدة
        </button>
      </div>

      {/* Universal Search Bar */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <input
          type="text"
          className="input"
          placeholder="🔍 بحث بالباركود، الهاتف، أو الاسم..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            height: '50px',
            fontSize: '1rem',
            paddingRight: '48px',
            borderRadius: '14px',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            color: 'var(--text-main)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
          }}
        />
        <Search size={22} style={{ position: 'absolute', right: '15px', top: '14px', color: 'var(--primary-color)' }} />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{ position: 'absolute', left: '15px', top: '14px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Smart Scan Section Toggle */}
      {showSmartScan && (
        <SmartScan drivers={drivers} onOrderCreated={loadData} />
      )}

      {/* Express Barcode Scanner Dispatch Widget */}
      {showExpressScanner && (
        <div className="card" style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)', color: '#fff', borderRadius: '16px', border: '2px solid #8b5cf6', boxShadow: '0 10px 30px rgba(139, 92, 246, 0.25)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#8b5cf6', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Zap size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  الإسناد بالباركود ⚡
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>امسح الباركود بالمسدس للتحويل الفوري للمندوب</p>
              </div>
            </div>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowExpressScanner(false)}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#38bdf8' }}>
                  1. المندوب المستلم:
                </label>
                <select
                  className="input"
                  style={{ width: '100%', height: '45px', fontSize: '1rem', background: '#0f172a', color: '#fff', borderColor: expressDriverId ? '#10b981' : '#475569' }}
                  value={expressDriverId}
                  onChange={e => {
                    setExpressDriverId(e.target.value);
                    setTimeout(() => barcodeInputRef.current?.focus(), 50);
                  }}
                >
                  <option value="">-- اختر المندوب المستلم --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>

                {/* Session Status for Selected Driver */}
                {expressDriverId && (() => {
                  const activeS = sessions.find(s => s.driverId === expressDriverId && s.status === 'active');
                  return (
                    <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', padding: '0.35rem 0.65rem', borderRadius: '8px', background: activeS ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', border: '1px solid ' + (activeS ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)') }}>
                      {activeS ? (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>
                          🟢 مرتبط بالجلسة النشطة: <strong>{activeS.sessionNumber}</strong> (ستُربط الشحنة بها فوراً)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#fbbf24' }}>
                            ⚠️ لا توجد جلسة نشطة مفتوحة لهذا المندوب.
                          </span>
                          <button
                            type="button"
                            onClick={() => { setStartSessionDriverId(expressDriverId); setShowStartSessionModal(true); }}
                            style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            [بدء جلسة الآن 🚀]
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <form onSubmit={handleExpressBarcodeSubmit}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#a7f3d0' }}>
                  2. امسح الباركود:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    className="input"
                    placeholder="امسح الباركود بالمسدس..."
                    value={scannedBarcode}
                    onChange={e => setScannedBarcode(e.target.value)}
                    style={{
                      width: '100%',
                      height: '52px',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      background: '#0f172a',
                      color: '#38bdf8',
                      border: '2px solid #38bdf8',
                      borderRadius: '12px',
                      paddingRight: '45px',
                      letterSpacing: '1px'
                    }}
                  />
                  <Barcode size={24} style={{ position: 'absolute', right: '12px', top: '14px', color: '#38bdf8' }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem', width: '100%', height: '44px', fontWeight: 700, background: '#8b5cf6' }}>
                  تحويل للمندوب ⚡
                </button>
              </form>

              {successfulSessionScanCount > 0 && (
                <div style={{ marginTop: '1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>الشحنات المحولة:</span>
                  <span style={{ fontSize: '1.2rem', background: '#10b981', color: '#fff', padding: '2px 10px', borderRadius: '8px' }}>{successfulSessionScanCount} شحنة</span>
                </div>
              )}
            </div>

            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '1rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', height: '270px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>سجل المسح 📋</span>
                {scanLogs.length > 0 && (
                  <button onClick={() => setScanLogs([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}>تفريغ السجل</button>
                )}
              </div>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scanLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '2rem' }}>
                    امسح أول باركود بالمسدس...
                  </div>
                ) : (
                  scanLogs.map(log => (
                    <div key={log.id} style={{
                      fontSize: '0.82rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: log.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${log.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      color: log.success ? '#6ee7b7' : '#fca5a5',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {log.success ? <Check size={14} style={{ color: '#10b981' }} /> : <X size={14} style={{ color: '#ef4444' }} />}
                        <span>{log.text}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7, color: '#94a3b8' }}>{log.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table Container */}
      <section className="table-container" style={{ marginTop: '1.5rem' }}>
        <div className="table-header-row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <h3>جدول الشحنات 📋</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="action-btn" style={{ background: 'var(--text-secondary)' }} onClick={loadData}>
              <RefreshCw size={18} />
              تحديث 🔄
            </button>
            <button className="action-btn" onClick={() => setShowAddOrder(!showAddOrder)}>
              <Plus size={20} />
              إضافة طلب ➕
            </button>
          </div>
        </div>

        {/* بطاقات الفلترة التفاعلية للحالات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
          
          {/* 1. كافة الشحنات */}
          <div
            onClick={() => setFilterStatus('all')}
            style={{
              background: filterStatus === 'all' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'all' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'all' ? '2px solid #6366f1' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'all' ? '0 10px 25px rgba(99, 102, 241, 0.25)' : 'none',
              transform: filterStatus === 'all' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'all' ? '#a5b4fc' : 'var(--text-muted)' }}>الكل 📋</span>
              <div style={{ background: filterStatus === 'all' ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'all' ? '#818cf8' : 'var(--text-muted)' }}>
                <Layers size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block' }}>{orders.length}</strong>
          </div>

          {/* 2. شحنات المخزن */}
          <div
            onClick={() => setFilterStatus('in_warehouse')}
            style={{
              background: filterStatus === 'in_warehouse' ? 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'in_warehouse' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'in_warehouse' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'in_warehouse' ? '0 10px 25px rgba(59, 130, 246, 0.25)' : 'none',
              transform: filterStatus === 'in_warehouse' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'in_warehouse' ? '#93c5fd' : 'var(--text-muted)' }}>المخزن 🏬</span>
              <div style={{ background: filterStatus === 'in_warehouse' ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'in_warehouse' ? '#60a5fa' : '#3b82f6' }}>
                <Warehouse size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block', color: filterStatus === 'in_warehouse' ? '#fff' : '#3b82f6' }}>
              {orders.filter(o => o.status === 'in_warehouse' || o.status === 'pending').length}
            </strong>
          </div>

          {/* 3. مع المندوب */}
          <div
            onClick={() => setFilterStatus('assigned')}
            style={{
              background: filterStatus === 'assigned' ? 'linear-gradient(135deg, #4c1d95 0%, #1e293b 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'assigned' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'assigned' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'assigned' ? '0 10px 25px rgba(139, 92, 246, 0.25)' : 'none',
              transform: filterStatus === 'assigned' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'assigned' ? '#c4b5fd' : 'var(--text-muted)' }}>مع المندوب 🚚</span>
              <div style={{ background: filterStatus === 'assigned' ? 'rgba(139, 92, 246, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'assigned' ? '#a78bfa' : '#8b5cf6' }}>
                <Truck size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block', color: filterStatus === 'assigned' ? '#fff' : '#8b5cf6' }}>
              {orders.filter(o => o.status === 'assigned').length}
            </strong>
          </div>

          {/* 4. واصل */}
          <div
            onClick={() => setFilterStatus('delivered')}
            style={{
              background: filterStatus === 'delivered' ? 'linear-gradient(135deg, #064e3b 0%, #1e293b 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'delivered' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'delivered' ? '2px solid #10b981' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'delivered' ? '0 10px 25px rgba(16, 185, 129, 0.25)' : 'none',
              transform: filterStatus === 'delivered' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'delivered' ? '#6ee7b7' : 'var(--text-muted)' }}>واصل 🟢</span>
              <div style={{ background: filterStatus === 'delivered' ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'delivered' ? '#34d399' : '#10b981' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block', color: filterStatus === 'delivered' ? '#fff' : '#10b981' }}>
              {orders.filter(o => o.status === 'delivered').length}
            </strong>
          </div>

          {/* 5. مؤجل */}
          <div
            onClick={() => setFilterStatus('postponed')}
            style={{
              background: filterStatus === 'postponed' ? 'linear-gradient(135deg, #78350f 0%, #1e293b 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'postponed' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'postponed' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'postponed' ? '0 10px 25px rgba(245, 158, 11, 0.25)' : 'none',
              transform: filterStatus === 'postponed' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'postponed' ? '#fde68a' : 'var(--text-muted)' }}>مؤجل 🟠</span>
              <div style={{ background: filterStatus === 'postponed' ? 'rgba(245, 158, 11, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'postponed' ? '#fbbf24' : '#f59e0b' }}>
                <Clock size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block', color: filterStatus === 'postponed' ? '#fff' : '#f59e0b' }}>
              {orders.filter(o => o.status === 'postponed').length}
            </strong>
          </div>

          {/* 6. تحويل */}
          <div
            onClick={() => setFilterStatus('transferred')}
            style={{
              background: filterStatus === 'transferred' ? 'linear-gradient(135deg, #0e7490 0%, #1e293b 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'transferred' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'transferred' ? '2px solid #06b6d4' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'transferred' ? '0 10px 25px rgba(6, 182, 212, 0.25)' : 'none',
              transform: filterStatus === 'transferred' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'transferred' ? '#a5f3fc' : 'var(--text-muted)' }}>تحويل 🔀</span>
              <div style={{ background: filterStatus === 'transferred' ? 'rgba(6, 182, 212, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'transferred' ? '#22d3ee' : '#06b6d4' }}>
                <Share2 size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block', color: filterStatus === 'transferred' ? '#fff' : '#06b6d4' }}>
              {orders.filter(o => o.status === 'transferred').length}
            </strong>
          </div>

          {/* 7. راجع */}
          <div
            onClick={() => setFilterStatus('returned')}
            style={{
              background: filterStatus === 'returned' ? 'linear-gradient(135deg, #7f1d1d 0%, #1e293b 100%)' : 'var(--bg-secondary)',
              color: filterStatus === 'returned' ? '#fff' : 'var(--text-main)',
              border: filterStatus === 'returned' ? '2px solid #ef4444' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '0.9rem 1rem',
              cursor: 'pointer',
              boxShadow: filterStatus === 'returned' ? '0 10px 25px rgba(239, 68, 68, 0.25)' : 'none',
              transform: filterStatus === 'returned' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: filterStatus === 'returned' ? '#fca5a5' : 'var(--text-muted)' }}>راجع 🔴</span>
              <div style={{ background: filterStatus === 'returned' ? 'rgba(239, 68, 68, 0.25)' : 'var(--bg-surface)', padding: '5px', borderRadius: '8px', color: filterStatus === 'returned' ? '#f87171' : '#ef4444' }}>
                <XCircle size={16} />
              </div>
            </div>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, display: 'block', color: filterStatus === 'returned' ? '#fff' : '#ef4444' }}>
              {orders.filter(o => o.status === 'returned' || o.status === 'damaged').length}
            </strong>
          </div>

        </div>

        {/* Add Order Form */}
        {showAddOrder && (
          <form className="add-order-form" onSubmit={handleAddOrder} style={{ marginTop: '1rem' }}>
            <h4>إضافة طلب ➕</h4>
            <div className="form-grid">
              <input required placeholder="الباركود" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
              <input required placeholder="اسم الزبون" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
              <input required placeholder="رقم الهاتف" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input required placeholder="العنوان" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <input required type="number" placeholder="المبلغ" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="action-btn" disabled={submitting}>
                {submitting ? 'حفظ...' : 'حفظ الشحنة 💾'}
              </button>
              <button type="button" className="action-btn" style={{ background: '#6b7280' }} onClick={() => setShowAddOrder(false)}>
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Full Order Edit Modal */}
        {editingFullOrder && (
          <form className="add-order-form" onSubmit={handleUpdateFullOrder} style={{ marginTop: '1rem', background: '#1e293b', color: '#fff', border: '1px solid #38bdf8', padding: '1.5rem', borderRadius: '16px' }}>
            <h4 style={{ color: '#38bdf8', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} /> تعديل بيانات الشحنة [{editingFullOrder.barcode}] ✏️
            </h4>
            <div className="form-grid">
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>الباركود:</label>
                <input required value={editOrderForm.barcode} onChange={e => setEditOrderForm({ ...editOrderForm, barcode: e.target.value })} style={{ background: '#0f172a', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>اسم الزبون:</label>
                <input required value={editOrderForm.customerName} onChange={e => setEditOrderForm({ ...editOrderForm, customerName: e.target.value })} style={{ background: '#0f172a', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>رقم الهاتف:</label>
                <input required value={editOrderForm.phone} onChange={e => setEditOrderForm({ ...editOrderForm, phone: e.target.value })} style={{ background: '#0f172a', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>اسم المتجر:</label>
                <input value={editOrderForm.merchantName} onChange={e => setEditOrderForm({ ...editOrderForm, merchantName: e.target.value })} style={{ background: '#0f172a', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>العنوان:</label>
                <input required value={editOrderForm.address} onChange={e => setEditOrderForm({ ...editOrderForm, address: e.target.value })} style={{ background: '#0f172a', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>المبلغ (د.ع):</label>
                <input required type="number" value={editOrderForm.amount} onChange={e => setEditOrderForm({ ...editOrderForm, amount: e.target.value })} style={{ background: '#0f172a', color: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="action-btn" style={{ background: '#10b981', color: '#fff' }}>
                حفظ التعديلات 💾
              </button>
              <button type="button" className="action-btn" style={{ background: '#64748b', color: '#fff' }} onClick={() => setEditingFullOrder(null)}>
                إلغاء ✕
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="loading-state">تحميل الشحنات...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>لا توجد شحنات.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'right', padding: '12px' }}>الباركود والتفاصيل 📦</th>
                <th style={{ textAlign: 'right', padding: '12px' }}>المبلغ (د.ع) 💰</th>
                <th style={{ textAlign: 'right', padding: '12px' }}>المندوب 🚚</th>
                <th style={{ textAlign: 'right', padding: '12px' }}>الحالة 🏷️</th>
                <th style={{ textAlign: 'center', padding: '12px' }}>إجراءات ⚡</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrderDetail(order)}
                  style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                  className="clickable-order-row"
                >
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                        {order.barcode}
                      </strong>
                      <span style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>
                        • {twoWords(order.customerName)}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                      📍 {twoWords(order.address)}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>
                      {Number(order.amount).toLocaleString()} د.ع
                    </strong>
                  </td>
                  <td style={{ padding: '12px' }} onClick={e => e.stopPropagation()}>
                    {order.driverName ? (
                      <span style={{ fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Truck size={14} /> {order.driverName}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          className="input"
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', minWidth: '130px' }}
                          value={selectedDriverMap[order.id] || ''}
                          onChange={e => setSelectedDriverMap({ ...selectedDriverMap, [order.id]: e.target.value })}
                        >
                          <option value="">اختر مندوب...</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          disabled={!selectedDriverMap[order.id]}
                          onClick={() => handleAssignDriver(order.id)}
                        >
                          <Send size={12} /> تحويل ⚡
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span className={`status-badge ${order.status}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        className="btn"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}
                        title="معاينة بطاقة الطلب"
                        onClick={() => setSelectedOrderDetail(order)}
                      >
                        <Eye size={13} /> بطاقة
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px' }}
                        title="تعديل الشحنة"
                        onClick={() => {
                          setEditingFullOrder(order);
                          setEditOrderForm({
                            barcode: order.barcode,
                            customerName: order.customerName,
                            phone: order.phone,
                            merchantName: order.merchantName || '',
                            address: order.address,
                            amount: order.amount.toString()
                          });
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}
                        title="حذف الشحنة"
                        onClick={() => handleDeleteOrder(order)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {/* Pinned Order Details Card Modal */}
      {selectedOrderDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a', color: '#f8fafc', width: '100%', maxWidth: '650px',
            borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#38bdf8', padding: '10px', borderRadius: '12px', color: '#0f172a' }}>
                  <Package size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', fontWeight: 800 }}>
                    {selectedOrderDetail.barcode}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    تاريخ الإنشاء: {new Date(selectedOrderDetail.createdAt).toLocaleString('ar-IQ')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-badge ${selectedOrderDetail.status}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                  {getStatusLabel(selectedOrderDetail.status)}
                </span>
                <button
                  onClick={() => setSelectedOrderDetail(null)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Detailed Information Card Grid */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#0f172a' }}>
              
              {/* Customer & Address Card Box */}
              <div style={{ background: '#1e293b', borderRadius: '16px', padding: '1.1rem', border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                  <User size={16} /> معلومات الزبون والتوصيل:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>اسم الزبون:</span>
                    <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{selectedOrderDetail.customerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>رقم الهاتف:</span>
                    <a href={`tel:${selectedOrderDetail.phone}`} style={{ color: '#38bdf8', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }} dir="ltr">
                      <Phone size={14} /> {selectedOrderDetail.phone}
                    </a>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>العنوان والموقع:</span>
                    <strong style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <MapPin size={16} style={{ color: '#f43f5e' }} /> {selectedOrderDetail.address}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Financial & Delivery Details Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, display: 'block' }}>المبلغ التحصيلي:</span>
                  <strong style={{ fontSize: '1.35rem', color: '#34d399', display: 'block', marginTop: '4px' }}>
                    {Number(selectedOrderDetail.amount).toLocaleString()} د.ع
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    نوع الطرد: {selectedOrderDetail.packageType === 'large' ? 'طرد كبير (2,000 د.ع)' : 'طرد صغير (1,500 د.ع)'}
                  </span>
                </div>

                <div style={{ background: '#1e293b', borderRadius: '16px', padding: '1rem', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, display: 'block' }}>المتجر والتاجر:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#c084fc', display: 'block', marginTop: '4px' }}>
                    <Store size={14} style={{ display: 'inline', marginLeft: '4px' }} />
                    {selectedOrderDetail.merchantName || 'بدون اسم متجر'}
                  </strong>
                  {selectedOrderDetail.merchantPhone && (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }} dir="ltr">
                      Tel: {selectedOrderDetail.merchantPhone}
                    </span>
                  )}
                </div>
              </div>

              {/* Driver & Status Details Box */}
              <div style={{ background: '#1e293b', borderRadius: '16px', padding: '1rem', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>المندوب المسؤول:</span>
                    <strong style={{ fontSize: '1rem', color: selectedOrderDetail.driverName ? '#38bdf8' : '#f59e0b', marginTop: '2px', display: 'block' }}>
                      {selectedOrderDetail.driverName ? `🚚 ${selectedOrderDetail.driverName}` : 'لم يتم الإسناد للمندوب بعد (بالمخزن)'}
                    </strong>
                  </div>
                  {selectedOrderDetail.sessionId && (
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>الجلسة المرتبطة:</span>
                      <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                        🔗 {selectedOrderDetail.sessionId.substring(0, 12)}...
                      </span>
                    </div>
                  )}
                </div>

                {selectedOrderDetail.notes && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #334155', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>الملاحظات والتحديثات الميدانية:</span>
                    <span style={{ fontSize: '0.88rem', color: '#fbbf24', fontWeight: 600 }}>{selectedOrderDetail.notes}</span>
                  </div>
                )}

                {/* Proof Screenshot Attachment View */}
                {selectedOrderDetail.proofScreenshot && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #334155', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                      📸 إثبات المندوب المرفوع (سكرين شوت المكالمة / المحادثة):
                    </span>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={selectedOrderDetail.proofScreenshot}
                        alt="إثبات المندوب"
                        style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '10px', border: '2px solid #10b981', cursor: 'pointer', objectFit: 'cover' }}
                        onClick={() => window.open(selectedOrderDetail.proofScreenshot, '_blank')}
                        title="انقر لفتح الصورة بالحجم الكامل"
                      />
                      <span style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                        🔍 انقر للتكبير
                      </span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div style={{ background: '#1e293b', padding: '1rem 1.5rem', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700, padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    const orderToEdit = selectedOrderDetail;
                    setSelectedOrderDetail(null);
                    setEditingFullOrder(orderToEdit);
                    setEditOrderForm({
                      barcode: orderToEdit.barcode,
                      customerName: orderToEdit.customerName,
                      phone: orderToEdit.phone,
                      merchantName: orderToEdit.merchantName || '',
                      address: orderToEdit.address,
                      amount: orderToEdit.amount.toString()
                    });
                  }}
                >
                  <Edit3 size={15} /> تعديل الشحنة ✏️
                </button>
                <button
                  className="btn"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  onClick={() => {
                    const orderToDelete = selectedOrderDetail;
                    setSelectedOrderDetail(null);
                    handleDeleteOrder(orderToDelete);
                  }}
                >
                  <Trash2 size={15} /> حذف الشحنة 🗑️
                </button>
              </div>

              <button
                className="btn"
                style={{ background: '#475569', color: '#fff', padding: '0.45rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }}
                onClick={() => setSelectedOrderDetail(null)}
              >
                إغلاق ✕
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL: START NEW DRIVER SESSION                          */}
      {/* ======================================================== */}
      {showStartSessionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={20} style={{ color: '#38bdf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>بدء جلسة عمل جديدة للمندوب</h3>
              </div>
              <button onClick={() => setShowStartSessionModal(false)} style={{ color: '#94a3b8', fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>اختر المندوب المستلم للوردية:</label>
                <select
                  required
                  style={{ width: '100%', padding: '0.75rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '10px', fontSize: '0.9rem' }}
                  value={startSessionDriverId}
                  onChange={e => setStartSessionDriverId(e.target.value)}
                >
                  <option value="">-- اختر المندوب --</option>
                  {drivers.map(d => {
                    const hasActive = sessions.some(s => s.driverId === d.id && s.status === 'active');
                    return (
                      <option key={d.id} value={d.id} disabled={hasActive}>
                        {d.name} {hasActive ? '(لديه جلسة نشطة بالفعل)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>ملاحظات أو تعليمات الجلسة (اختياري):</label>
                <textarea
                  style={{ width: '100%', padding: '0.75rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '10px', fontSize: '0.88rem', minHeight: '80px', resize: 'vertical' }}
                  placeholder="مثال: الوجبة المسائية - منطقة الحر والموظفين..."
                  value={startSessionNotes}
                  onChange={e => setStartSessionNotes(e.target.value)}
                />
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', color: '#7dd3fc' }}>
                💡 سيتم ربط كافة الشحنات التي تُسند لهذا المندوب بعد بدء الجلسة مباشرة برقم هذه الجلسة تلقائياً للمطابقة والتصفية.
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={startingSession}
                  style={{ flex: 1, padding: '0.75rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {startingSession ? 'جاري البدء...' : 'بدء وتفعيل الجلسة 🚀'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartSessionModal(false)}
                  style={{ padding: '0.75rem 1.25rem', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CLOSE & SETTLE DRIVER SESSION                     */}
      {/* ======================================================== */}
      {sessionToClose && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={20} style={{ color: '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>إنهاء وتصفية جلسة العمل</h3>
              </div>
              <button onClick={() => setSessionToClose(null)} style={{ color: '#94a3b8', fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>رقم الجلسة:</span>
                <strong style={{ color: '#38bdf8' }}>{sessionToClose.sessionNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>المندوب:</span>
                <strong style={{ color: '#fff' }}>{sessionToClose.driverName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>الشحنات المحصلة (واصل):</span>
                <strong style={{ color: '#34d399' }}>{sessionToClose.deliveredCount || 0} شحنة</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700 }}>الصافي المسلم للشركة:</span>
                <strong style={{ color: '#38bdf8', fontSize: '1.05rem' }}>{(sessionToClose.netToCompany || 0).toLocaleString()} د.ع</strong>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>ملاحظات التصفية النهائية (اختياري):</label>
              <textarea
                style={{ width: '100%', padding: '0.75rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '10px', fontSize: '0.88rem', minHeight: '70px', resize: 'vertical' }}
                placeholder="تم استلام المبلغ وتصفية حساب الجلسة..."
                value={closeSessionNotes}
                onChange={e => setCloseSessionNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button
                disabled={closingSession}
                onClick={handleCloseSession}
                style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {closingSession ? 'جاري الإغلاق...' : 'تأكيد إغلاق الجلسة وتصفية الحساب 🔒'}
              </button>
              <button
                type="button"
                onClick={() => setSessionToClose(null)}
                style={{ padding: '0.75rem 1.25rem', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      </section>
    </main>
  );
};

export default OrdersManagement;
