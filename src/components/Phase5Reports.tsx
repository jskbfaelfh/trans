import React, { useState, useEffect } from 'react';
import {
  Share2, FileSpreadsheet, Send, Check, Copy,
  Package, Truck, TrendingUp,
  RefreshCw, BarChart3,
  ChevronDown, ChevronUp, Play, Lock, Clock, Calendar,
  UserCheck, Shield, AlertCircle, PlusCircle, CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import type { Order, Driver, DriverSession } from '../services/api';
import { twoWords } from '../utils/textUtils';

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  pending:      { label: 'في المخزن',     emoji: '🏬', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)' },
  in_warehouse: { label: 'في المخزن',     emoji: '🏬', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)' },
  assigned:     { label: 'مع المندوب',    emoji: '🚚', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.3)' },
  delivered:    { label: 'واصل',          emoji: '🟢', color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
  postponed:    { label: 'مؤجل',          emoji: '🟠', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)' },
  transferred:  { label: 'محوَّل',        emoji: '🔀', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)' },
  returned:     { label: 'راجع',          emoji: '🔴', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)' },
  damaged:      { label: 'تالف / مفقود', emoji: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)' },
};

const DISPLAY_STATUSES = ['delivered', 'assigned', 'postponed', 'transferred', 'returned', 'damaged', 'pending'];

const Phase5Reports: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sessions, setSessions] = useState<DriverSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  const [reportType, setReportType] = useState<'6pm' | '9pm' | '11pm'>('6pm');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions_list' | 'details' | 'whatsapp'>('overview');
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [startDriverId, setStartDriverId] = useState('');
  const [startNotes, setStartNotes] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  const [sessionToClose, setSessionToClose] = useState<DriverSession | null>(null);
  const [closeNotes, setCloseNotes] = useState('');
  const [closingSession, setClosingSession] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [oData, dData, sData] = await Promise.all([
        api.getOrders(),
        api.getDrivers(),
        api.getSessions()
      ]);
      setOrders(oData);
      setDrivers(dData);
      setSessions(sData);
    } catch (err: any) {
      setErrorMsg('تعذر تحميل البيانات من السيرفر: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Selected Session Object
  const currentSelectedSession = sessions.find(s => s.id === selectedSessionId);

  // Filter orders based on selected session and driver
  const filteredOrders = orders.filter(o => {
    if (selectedSessionId !== 'all') {
      return o.sessionId === selectedSessionId;
    }
    if (selectedDriverId !== 'all') {
      return o.driverId === selectedDriverId;
    }
    return true;
  });

  const getOrdersByStatus = (status: string): Order[] => {
    if (status === 'pending') return filteredOrders.filter(o => o.status === 'pending' || o.status === 'in_warehouse');
    return filteredOrders.filter(o => o.status === status);
  };

  const deliveredOrders = getOrdersByStatus('delivered');
  const totalCollected = deliveredOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const driverFees = deliveredOrders.reduce((sum, o) => sum + (o.packageType === 'large' ? 2000 : 1500), 0);
  const netToCompany = totalCollected - driverFees;
  const totalAmount = filteredOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const collectionRate = filteredOrders.length > 0 ? Math.round((deliveredOrders.length / filteredOrders.length) * 100) : 0;

  const statusCounts = DISPLAY_STATUSES.reduce((acc, s) => {
    acc[s] = getOrdersByStatus(s).length;
    return acc;
  }, {} as Record<string, number>);

  // Handle Start Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDriverId) {
      setErrorMsg('يرجى اختيار المندوب لبدء الجلسة');
      return;
    }
    setStartingSession(true);
    setErrorMsg('');
    try {
      const newSession = await api.startSession(startDriverId, startNotes);
      setSuccessMsg(`تم بدء جلسة العمل [${newSession.sessionNumber}] بنجاح!`);
      setShowStartModal(false);
      setStartDriverId('');
      setStartNotes('');
      setSelectedSessionId(newSession.id);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setStartingSession(false);
    }
  };

  // Handle Close Session
  const handleCloseSession = async () => {
    if (!sessionToClose) return;
    setClosingSession(true);
    setErrorMsg('');
    try {
      const closed = await api.closeSession(sessionToClose.id, closeNotes);
      setSuccessMsg(`تم إغلاق وتصفية الجلسة [${closed.sessionNumber}] بنجاح!`);
      setSessionToClose(null);
      setCloseNotes('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setClosingSession(false);
    }
  };

  // Generate WhatsApp Report
  const generateGroupReport = () => {
    const postponed = getOrdersByStatus('postponed');
    const returned = getOrdersByStatus('returned');
    const transferred = getOrdersByStatus('transferred');
    const damaged = getOrdersByStatus('damaged');
    const assigned = getOrdersByStatus('assigned');
    const inWarehouse = getOrdersByStatus('pending');

    const timeLabel = reportType === '6pm' ? '🕕 وجبة التبليغ الأولى (6:00 مساءً)' :
                      reportType === '9pm' ? '🕘 وجبة التبليغ الثانية (9:00 مساءً)' :
                      '🕚 وجبة التبليغ النهائية (11:00 مساءً)';

    let text = '⚡ *تقرير التبليغ الدوري - أكسبرس كربلاء* ⚡\n';
    text += timeLabel + '\n';
    text += '📅 ' + new Date().toLocaleDateString('ar-IQ') + '\n';
    
    if (currentSelectedSession) {
      text += '━━━━━━━━━━━━━━━━━━━━━━━\n';
      text += '🆔 رقم الجلسة: ' + currentSelectedSession.sessionNumber + '\n';
      text += '🚚 المندوب: ' + (currentSelectedSession.driverName || '—') + '\n';
      text += '👤 مشرف/مدير الجلسة: ' + (currentSelectedSession.createdByName || '—') + '\n';
      text += '⏰ وقت البدء: ' + new Date(currentSelectedSession.startedAt).toLocaleTimeString('ar-IQ') + '\n';
      text += '📌 الحالة: ' + (currentSelectedSession.status === 'active' ? '🟢 جارية / مفتوحة' : '🔒 مغلقة ومصفاة') + '\n';
    } else if (selectedDriverId !== 'all') {
      const d = drivers.find(dr => dr.id === selectedDriverId);
      text += '🚚 المندوب: ' + (d?.name || '—') + '\n';
    }

    text += '━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '📦 إجمالي الشحنات: ' + filteredOrders.length + '\n';
    text += '✅ واصل: ' + deliveredOrders.length + '\n';
    text += '🟠 مؤجل: ' + postponed.length + '\n';
    text += '🔴 راجع: ' + returned.length + '\n';
    text += '🔀 محوَّل: ' + transferred.length + '\n';
    text += '⚠️ تالف/مفقود: ' + damaged.length + '\n';
    text += '🚚 مع المندوب: ' + assigned.length + '\n';
    text += '🏬 في المخزن: ' + inWarehouse.length + '\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '💰 المبالغ المحصلة: ' + totalCollected.toLocaleString() + ' د.ع\n';
    text += '💼 أجور المندوب: ' + driverFees.toLocaleString() + ' د.ع\n';
    text += '💵 الصافي للشركة: ' + netToCompany.toLocaleString() + ' د.ع\n';
    text += '📊 نسبة التسليم: ' + collectionRate + '%\n\n';

    if (postponed.length > 0) {
      text += '*📋 تفاصيل المؤجلة (' + postponed.length + '):*\n';
      postponed.forEach(o => {
        text += '• ' + o.barcode + ' | ' + twoWords(o.customerName) + ' (' + twoWords(o.address) + '): ' + (o.notes || 'بدون ملاحظة') + '\n';
      });
      text += '\n';
    }
    if (returned.length > 0) {
      text += '*📋 تفاصيل الراجعة (' + returned.length + '):*\n';
      returned.forEach(o => {
        text += '• ' + o.barcode + ' | ' + twoWords(o.customerName) + ': ' + (o.notes || 'رفض استلام') + '\n';
      });
      text += '\n';
    }
    if (transferred.length > 0) {
      text += '*📋 تفاصيل المحوَّلة (' + transferred.length + '):*\n';
      transferred.forEach(o => {
        text += '• ' + o.barcode + ' | ' + twoWords(o.customerName) + ' ← ' + (o.driverName || '—') + '\n';
      });
      text += '\n';
    }
    if (damaged.length > 0) {
      text += '*📋 تفاصيل التالف/المفقود (' + damaged.length + '):*\n';
      damaged.forEach(o => {
        text += '• ' + o.barcode + ' | ' + twoWords(o.customerName) + ': ' + (o.notes || 'بدون ملاحظة') + '\n';
      });
    }
    return text;
  };

  const handleExportCSV = () => {
    const getLabel = (s: string) => { const c = STATUS_CONFIG[s]; return c ? c.label + ' ' + c.emoji : s; };
    const headers = ['رقم الباركود', 'اسم الزبون', 'رقم الهاتف', 'العنوان', 'المتجر', 'المبلغ', 'الحالة', 'المندوب', 'الجلسة', 'الملاحظات'];
    const rows = filteredOrders.map(o => [
      o.barcode, o.customerName, o.phone, o.address,
      (o as any).merchantName || '', o.amount, getLabel(o.status),
      o.driverName || 'غير مسند',
      o.sessionId || 'عام',
      o.notes || ''
    ]);
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `Express_Report_${currentSelectedSession ? currentSelectedSession.sessionNumber : 'All'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const reportText = generateGroupReport();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Notifications */}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} style={{ color: '#f87171', fontWeight: 700 }}>✕</button>
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} style={{ color: '#34d399', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Top Main Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '20px', padding: '1.5rem 2rem', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <BarChart3 size={22} style={{ color: '#38bdf8' }} />
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', fontWeight: 800 }}>إحصائيات وتقارير جلسات المناديب</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
            متابعة إحصائيات الورديات والجلسات المباشرة التي يبدؤها المدير والمشرف لكل مندوب
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
            onClick={() => setShowStartModal(true)}
          >
            <Play size={16} /> بدء جلسة جديدة لمندوب 🚀
          </button>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
            onClick={handleExportCSV}
          >
            <FileSpreadsheet size={16} /> تصدير Excel
          </button>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', background: '#334155', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={loadData}
          >
            <RefreshCw size={15} /> تحديث
          </button>
        </div>
      </div>

      {/* Session Scope & Filtering Bar */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>تحديد نطاق التقرير والجلسة:</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {sessions.filter(s => s.status === 'active').map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedSessionId(s.id); setSelectedDriverId('all'); }}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: selectedSessionId === s.id ? 'rgba(16, 185, 129, 0.25)' : '#0f172a',
                  border: '1px solid ' + (selectedSessionId === s.id ? '#10b981' : '#334155'),
                  color: selectedSessionId === s.id ? '#34d399' : '#94a3b8',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: selectedSessionId === s.id ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                {s.driverName}: {s.sessionNumber}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {/* Select Session Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>🗂️ اختيار الجلسة / الوردية:</label>
            <select
              style={{ width: '100%', padding: '0.6rem 0.9rem', background: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600 }}
              value={selectedSessionId}
              onChange={e => {
                setSelectedSessionId(e.target.value);
                if (e.target.value !== 'all') setSelectedDriverId('all');
              }}
            >
              <option value="all">-- كل الشحنات العامة (بدون تقييد بجلسة) --</option>
              {sessions.length > 0 && (
                <optgroup label="🟢 الجلسات النشطة حالياً">
                  {sessions.filter(s => s.status === 'active').map(s => (
                    <option key={s.id} value={s.id}>
                      🟢 [نشطة] {s.sessionNumber} - {s.driverName} ({new Date(s.startedAt).toLocaleTimeString('ar-IQ')})
                    </option>
                  ))}
                </optgroup>
              )}
              {sessions.length > 0 && (
                <optgroup label="🔒 الجلسات المؤرشفة والمغلقة">
                  {sessions.filter(s => s.status === 'closed').map(s => (
                    <option key={s.id} value={s.id}>
                      🔒 [مغلقة] {s.sessionNumber} - {s.driverName} ({new Date(s.startedAt).toLocaleDateString('ar-IQ')})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Select Driver Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>🚚 تصفية حسب المندوب:</label>
            <select
              disabled={selectedSessionId !== 'all'}
              style={{ width: '100%', padding: '0.6rem 0.9rem', background: '#0f172a', color: selectedSessionId !== 'all' ? '#64748b' : '#fff', border: '1px solid #334155', borderRadius: '10px', fontSize: '0.88rem' }}
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
            >
              <option value="all">كل المناديب ({orders.length} شحنة)</option>
              {drivers.map(d => {
                const count = orders.filter(o => o.driverId === d.id).length;
                return <option key={d.id} value={d.id}>{d.name} ({count})</option>;
              })}
            </select>
          </div>

          {/* Reporting Meal Times */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>🕐 وجبة التبليغ للجروب:</label>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {(['6pm', '9pm', '11pm'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setReportType(t)}
                  style={{ flex: 1, padding: '0.6rem 0.4rem', background: reportType === t ? '#0284c7' : '#0f172a', color: reportType === t ? '#fff' : '#94a3b8', border: '1px solid ' + (reportType === t ? '#0284c7' : '#334155'), borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: reportType === t ? 700 : 400 }}
                >
                  {t === '6pm' ? '6 م' : t === '9pm' ? '9 م' : '11 م'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Session Active Card (If a session is active/selected) */}
      {currentSelectedSession && (
        <div style={{ background: currentSelectedSession.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(51, 65, 85, 0.3)', border: '1px solid ' + (currentSelectedSession.status === 'active' ? '#10b981' : '#475569'), borderRadius: '16px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.8rem', background: currentSelectedSession.status === 'active' ? '#10b981' : '#64748b', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                  {currentSelectedSession.status === 'active' ? '🟢 جلسة عمل نشطة وجارية' : '🔒 جلسة عمل مغلقة ومصفاة'}
                </span>
                <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{currentSelectedSession.sessionNumber}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginTop: '6px' }}>
                <span>🚚 المندوب: <strong style={{ color: '#fff' }}>{currentSelectedSession.driverName}</strong></span>
                <span>👤 بدأها: <strong style={{ color: '#93c5fd' }}>{currentSelectedSession.createdByName || 'المدير العام'}</strong></span>
                <span>⏰ وقت البدء: <strong style={{ color: '#fff' }}>{new Date(currentSelectedSession.startedAt).toLocaleString('ar-IQ')}</strong></span>
                {currentSelectedSession.closedAt && (
                  <span>🔒 أغلقت في: <strong style={{ color: '#f87171' }}>{new Date(currentSelectedSession.closedAt).toLocaleString('ar-IQ')}</strong></span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {currentSelectedSession.status === 'active' && (
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.65rem 1.25rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                  onClick={() => setSessionToClose(currentSelectedSession)}
                >
                  <Lock size={16} /> إنهاء وتصفية الجلسة 🔒
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', background: '#1e293b', borderRadius: '12px', padding: '4px', border: '1px solid #334155' }}>
        {[
          { key: 'overview',      label: '📊 الإحصائيات الشاملة' },
          { key: 'sessions_list', label: `🗂️ سجل الجلسات (${sessions.length})` },
          { key: 'details',       label: `📋 تفاصيل الشحنات (${filteredOrders.length})` },
          { key: 'whatsapp',      label: '💬 تقرير الواتساب' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{ flex: 1, padding: '0.65rem 0.5rem', background: activeTab === tab.key ? '#0f172a' : 'transparent', color: activeTab === tab.key ? '#38bdf8' : '#64748b', border: 'none', borderRadius: '9px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: activeTab === tab.key ? 700 : 400, transition: 'all 0.2s' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          <p>جاري تحميل البيانات...</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: OVERVIEW & STATS                                 */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {DISPLAY_STATUSES.map(status => {
                  const cfg = STATUS_CONFIG[status];
                  const count = statusCounts[status] || 0;
                  const pct = filteredOrders.length > 0 ? Math.round((count / filteredOrders.length) * 100) : 0;
                  return (
                    <div
                      key={status}
                      onClick={() => { setActiveTab('details'); setExpandedStatus(status); }}
                      style={{ background: cfg.bg, border: '1px solid ' + cfg.border, borderRadius: '14px', padding: '1rem', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>{cfg.emoji}</div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
                      <div style={{ fontSize: '0.75rem', color: cfg.color, marginTop: '0.25rem', fontWeight: 600 }}>{cfg.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>{pct}% من الجلسة</div>
                      <div style={{ marginTop: '0.5rem', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: pct + '%', background: cfg.color, borderRadius: '2px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Financial Breakdown */}
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={18} style={{ color: '#34d399' }} /> 
                  الحساب المالي {currentSelectedSession ? `للجلسة (${currentSelectedSession.sessionNumber})` : 'العام'}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: 'إجمالي الشحنات', value: filteredOrders.length + ' شحنة', color: '#60a5fa' },
                    { label: 'المبالغ المحصلة (كاش)', value: totalCollected.toLocaleString() + ' د.ع', color: '#34d399' },
                    { label: 'خصم أجور المندوب', value: '- ' + driverFees.toLocaleString() + ' د.ع', color: '#f87171' },
                    { label: 'الصافي المسلم للشركة', value: netToCompany.toLocaleString() + ' د.ع', color: '#38bdf8' },
                    { label: 'نسبة التسليم والنجاح', value: collectionRate + '%', color: collectionRate >= 70 ? '#34d399' : collectionRate >= 40 ? '#fb923c' : '#f87171' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: '#0f172a', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem' }}>{item.label}</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown by drivers (if all selected) */}
              {selectedSessionId === 'all' && selectedDriverId === 'all' && drivers.length > 0 && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Truck size={18} style={{ color: '#60a5fa' }} /> تفصيل المناديب والجلسات النشطة
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', color: '#f8fafc' }}>
                      <thead>
                        <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                          {['المندوب', 'حالة الجلسة', 'واصل 🟢', 'مع المندوب 🚚', 'مؤجل 🟠', 'راجع 🔴', 'محوَّل 🔀', 'تالف ⚠️', 'المحصَّل', 'إجراء'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map(d => {
                          const activeS = sessions.find(s => s.driverId === d.id && s.status === 'active');
                          const dOrds = orders.filter(o => o.driverId === d.id);
                          if (dOrds.length === 0 && !activeS) return null;
                          const dDel = dOrds.filter(o => o.status === 'delivered');
                          const col = dDel.reduce((s, o) => s + Number(o.amount || 0), 0);
                          return (
                            <tr key={d.id} style={{ borderBottom: '1px solid #334155' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#fff', textAlign: 'right' }}>{d.name}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {activeS ? (
                                  <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    🟢 نشطة ({activeS.sessionNumber})
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>لا توجد جلسة</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#34d399', fontWeight: 700 }}>{dDel.length}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#60a5fa' }}>{dOrds.filter(o => o.status === 'assigned').length}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#fb923c' }}>{dOrds.filter(o => o.status === 'postponed').length}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#f87171' }}>{dOrds.filter(o => o.status === 'returned').length}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#a78bfa' }}>{dOrds.filter(o => o.status === 'transferred').length}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#fbbf24' }}>{dOrds.filter(o => o.status === 'damaged').length}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#34d399', fontWeight: 700, fontSize: '0.8rem' }}>{col.toLocaleString()} د.ع</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {activeS ? (
                                  <button
                                    onClick={() => setSelectedSessionId(activeS.id)}
                                    style={{ padding: '0.3rem 0.6rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                                  >
                                    عرض الجلسة 👁️
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setStartDriverId(d.id); setShowStartModal(true); }}
                                    style={{ padding: '0.3rem 0.6rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                                  >
                                    بدء جلسة 🚀
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: SESSIONS LIST & ARCHIVE                          */}
          {/* ======================================================== */}
          {activeTab === 'sessions_list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>سجل وإدارة جلسات العمل والورديات:</h3>
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
                  onClick={() => setShowStartModal(true)}
                >
                  <PlusCircle size={15} /> فتح جلسة عمل جديدة
                </button>
              </div>

              {sessions.length === 0 ? (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <Clock size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                  <p style={{ margin: '0 0 0.75rem 0' }}>لم يتم فتح أي جلسات عمل حتى الآن.</p>
                  <button
                    onClick={() => setShowStartModal(true)}
                    style={{ padding: '0.6rem 1.2rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    بدء أول جلسة لمندوب الآن 🚀
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.85rem' }}>
                  {sessions.map(s => {
                    const isActive = s.status === 'active';
                    return (
                      <div
                        key={s.id}
                        style={{
                          background: '#1e293b',
                          border: '1px solid ' + (selectedSessionId === s.id ? '#38bdf8' : isActive ? '#10b981' : '#334155'),
                          borderRadius: '16px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          boxShadow: selectedSessionId === s.id ? '0 0 15px rgba(56, 189, 248, 0.2)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', background: isActive ? '#10b981' : '#475569', color: '#fff', padding: '0.15rem 0.55rem', borderRadius: '8px', fontWeight: 700 }}>
                              {isActive ? '🟢 جارية الآن' : '🔒 مغلقة ومصفاة'}
                            </span>
                            <h4 style={{ margin: '6px 0 2px 0', fontSize: '1rem', color: '#38bdf8' }}>{s.sessionNumber}</h4>
                            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>{s.driverName}</span>
                          </div>
                          <div style={{ textAlign: 'left', fontSize: '0.75rem', color: '#94a3b8' }}>
                            <div>{new Date(s.startedAt).toLocaleDateString('ar-IQ')}</div>
                            <div>{new Date(s.startedAt).toLocaleTimeString('ar-IQ')}</div>
                          </div>
                        </div>

                        <div style={{ background: '#0f172a', borderRadius: '10px', padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>إجمالي</span>
                            <strong style={{ fontSize: '0.95rem', color: '#60a5fa' }}>{s.totalOrders || 0}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>واصل</span>
                            <strong style={{ fontSize: '0.95rem', color: '#34d399' }}>{s.deliveredCount || 0}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>المحصل</span>
                            <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>{(s.totalCollected || 0).toLocaleString()}</strong>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          بدأها المشرف/المدير: <span style={{ color: '#cbd5e1' }}>{s.createdByName || 'المدير العام'}</span>
                          {s.notes && <div style={{ color: '#fbbf24', marginTop: '2px' }}>ملاحظة: {s.notes}</div>}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                          <button
                            onClick={() => { setSelectedSessionId(s.id); setActiveTab('overview'); }}
                            style={{ flex: 1, padding: '0.5rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            عرض الإحصائيات 📊
                          </button>
                          {isActive && (
                            <button
                              onClick={() => setSessionToClose(s)}
                              style={{ padding: '0.5rem 0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              إغلاق 🔒
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: DETAILS (ACCORDION PER STATUS)                   */}
          {/* ======================================================== */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {DISPLAY_STATUSES.map(status => {
                const cfg = STATUS_CONFIG[status];
                const statusOrders = getOrdersByStatus(status);
                if (statusOrders.length === 0) return null;
                const isExpanded = expandedStatus === status;
                return (
                  <div key={status} style={{ background: '#1e293b', border: '1px solid ' + (isExpanded ? cfg.border : '#334155'), borderRadius: '14px', overflow: 'hidden' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer', background: isExpanded ? cfg.bg : 'transparent' }}
                      onClick={() => setExpandedStatus(isExpanded ? null : status)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>{cfg.emoji}</span>
                        <span style={{ fontWeight: 700, color: cfg.color, fontSize: '0.95rem' }}>{cfg.label}</span>
                        <span style={{ background: cfg.color, color: '#000', borderRadius: '20px', padding: '0.1rem 0.55rem', fontSize: '0.78rem', fontWeight: 800 }}>{statusOrders.length}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {status === 'delivered' && (
                          <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700 }}>
                            {statusOrders.reduce((s, o) => s + Number(o.amount || 0), 0).toLocaleString()} د.ع
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={18} style={{ color: '#64748b' }} /> : <ChevronDown size={18} style={{ color: '#64748b' }} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', color: '#f8fafc' }}>
                          <thead>
                            <tr style={{ background: '#0f172a', borderTop: '1px solid #334155' }}>
                              {['الباركود', 'الزبون', 'العنوان', 'الهاتف', 'المبلغ', 'المندوب', 'الملاحظات'].map(h => (
                                <th key={h} style={{ padding: '9px 12px', textAlign: 'right', color: '#94a3b8' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {statusOrders.map((o, idx) => (
                              <tr key={o.id} style={{ borderBottom: '1px solid #334155', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '9px 12px', fontWeight: 800, color: '#38bdf8' }}>{o.barcode}</td>
                                <td style={{ padding: '9px 12px', color: '#fff' }}>{o.customerName}</td>
                                <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: '0.78rem' }}>{o.address}</td>
                                <td style={{ padding: '9px 12px', color: '#94a3b8', direction: 'ltr', fontSize: '0.8rem' }}>{o.phone}</td>
                                <td style={{ padding: '9px 12px', color: '#34d399', fontWeight: 700 }}>{Number(o.amount || 0).toLocaleString()}</td>
                                <td style={{ padding: '9px 12px', color: '#a78bfa' }}>{o.driverName || '—'}</td>
                                <td style={{ padding: '9px 12px', color: '#f87171', fontSize: '0.78rem' }}>{o.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {DISPLAY_STATUSES.every(s => getOrdersByStatus(s).length === 0) && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <Package size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                  <p>لا توجد شحنات ضمن هذه الجلسة أو الفلتر</p>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: WHATSAPP DISPATCH REPORT                         */}
          {/* ======================================================== */}
          {activeTab === 'whatsapp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Share2 size={18} style={{ color: '#25D366' }} /> معاينة تقرير الواتساب المخصص للجلسة
                </h4>
                <textarea
                  readOnly
                  style={{ width: '100%', minHeight: '340px', padding: '1rem', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.85rem', direction: 'rtl', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }}
                  value={reportText}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '140px', padding: '0.75rem 1rem', background: '#25D366', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', justifyContent: 'center' }}
                    onClick={() => window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(reportText), '_blank')}
                  >
                    <Send size={18} /> إرسال لجروب الواتساب الآن
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.2rem', background: copied ? '#16a34a' : '#334155', color: '#fff', border: '1px solid #475569', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', transition: 'background 0.2s' }}
                    onClick={() => { navigator.clipboard.writeText(reportText); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'تم النسخ ✓' : 'نسخ التقرير'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL: START NEW SESSION                                */}
      {/* ======================================================== */}
      {showStartModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={20} style={{ color: '#38bdf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>بدء جلسة عمل جديدة للمندوب</h3>
              </div>
              <button onClick={() => setShowStartModal(false)} style={{ color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
            </div>

            <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>اختر المندوب المستلم للوردية:</label>
                <select
                  required
                  style={{ width: '100%', padding: '0.75rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '10px', fontSize: '0.9rem' }}
                  value={startDriverId}
                  onChange={e => setStartDriverId(e.target.value)}
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
                  value={startNotes}
                  onChange={e => setStartNotes(e.target.value)}
                />
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', color: '#7dd3fc' }}>
                💡 سيتم ربط كافة الشحنات التي تُسند لهذا المندوب بعد بدء الجلسة مباشرة برقم هذه الجلسة تلقائياً.
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
                  onClick={() => setShowStartModal(false)}
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
      {/* MODAL: CLOSE & SETTLE SESSION                           */}
      {/* ======================================================== */}
      {sessionToClose && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={20} style={{ color: '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>إنهاء وتصفية جلسة العمل</h3>
              </div>
              <button onClick={() => setSessionToClose(null)} style={{ color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
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
                placeholder="تم استلام المبلغ نقداً وتصفية العهدة..."
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button
                disabled={closingSession}
                onClick={handleCloseSession}
                style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {closingSession ? 'جاري الإغلاق والتصفية...' : 'تأكيد إغلاق الجلسة وتجميد التقرير 🔒'}
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

    </div>
  );
};

export default Phase5Reports;
