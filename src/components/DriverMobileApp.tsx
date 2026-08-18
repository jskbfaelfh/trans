import React, { useState, useEffect } from 'react';
import {
  Truck, CheckCircle2, XCircle, Phone, MapPin, RefreshCw, Camera, DollarSign,
  Clock, Navigation, MessageCircle, Search, AlertCircle, Check, ChevronDown,
  ChevronUp, ShieldCheck, Share2, Package, Sparkles, Send, FileText, User,
  Volume2, CheckCheck, QrCode, ArrowRightLeft, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import type { Order, Driver, DriverSession } from '../services/api';
import { twoWords } from '../utils/textUtils';

const DriverMobileApp: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('yi35u16xmsntg8mc'); // حسين لفته افتراضياً
  const [driverOrders, setDriverOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<DriverSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [proofImages, setProofImages] = useState<{ [key: string]: string }>({});

  // Search & Filter Tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'assigned' | 'delivered' | 'postponed' | 'returned'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Success Toast & Sound
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status Action Modals
  const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);
  const [modalActionType, setModalActionType] = useState<'postpone' | 'price' | 'partial' | 'transfer' | 'return' | 'replacement' | null>(null);

  // Form states for modals
  const [postponeType, setPostponeType] = useState<'tonight' | 'tomorrow' | 'date' | 'no_answer'>('tonight');
  const [postponeTime, setPostponeTime] = useState('8:00 مساءً');
  const [postponeDate, setPostponeDate] = useState('');
  const [newPriceAmount, setNewPriceAmount] = useState('');
  const [partialReturnCount, setPartialReturnCount] = useState('1');
  const [partialNewAmount, setPartialNewAmount] = useState('');
  const [transferType, setTransferType] = useState<'driver' | 'governorate' | 'area'>('driver');
  const [targetDriverId, setTargetDriverId] = useState('');
  const [targetLocationText, setTargetLocationText] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  // Shift Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [copiedHandover, setCopiedHandover] = useState(false);

  // Quick Supervisor Switcher Drawer (collapsible)
  const [showDriverSwitcher, setShowDriverSwitcher] = useState(false);

  const playChimeSound = (success = true) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      const [dData, oData, sData] = await Promise.all([
        api.getDrivers(),
        api.getOrders(),
        api.getSessions()
      ]);
      setDrivers(dData);
      setSessions(sData);

      let targetId = selectedDriverId;
      if (!targetId || !dData.some(d => d.id === targetId)) {
        targetId = dData.find(d => d.name.includes('حسين'))?.id || dData[0]?.id || 'yi35u16xmsntg8mc';
        setSelectedDriverId(targetId);
      }

      setDriverOrders(oData.filter(o => o.driverId === targetId));
    } catch (err) {
      console.error('Error fetching driver data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedDriverId]);

  const selectedDriverObj = drivers.find(d => d.id === selectedDriverId) || {
    id: 'yi35u16xmsntg8mc',
    name: 'حسين لفته',
    phone: '07877966999',
    isActive: 1
  };

  const activeSession = sessions.find(s => s.driverId === selectedDriverId && s.status === 'active');

  const handleUpdateStatus = async (
    orderId: string,
    status: string,
    customNotes?: string,
    extraData?: {
      subStatus?: string;
      postponedTime?: string;
      postponedDate?: string;
      amount?: number;
      proofScreenshot?: string;
      returnedItemsCount?: number;
      isDamaged?: 'before_dispatch' | 'after_dispatch';
      isReplacement?: boolean;
    }
  ) => {
    try {
      await api.updateStatus(orderId, status, customNotes || '', extraData);
      playChimeSound(true);
      if (status === 'delivered') {
        showToast('🎉 تم تسجيل الشحنة (واصل) بنجاح وإضافة المبلغ لمحفظتك!');
      } else if (status === 'postponed') {
        showToast('⏳ تم حفظ تأجيل الشحنة بنجاح!');
      } else if (status === 'returned') {
        showToast('🔴 تم تسجيل الشحنة كـ راجع مع سبب الرفض!');
      } else {
        showToast('⚡ تم تحديث حالة الشحنة بنجاح!');
      }
      setActiveModalOrder(null);
      setModalActionType(null);
      await loadData();
    } catch (err: any) {
      playChimeSound(false);
      alert('فشل تحديث حالة الشحنة: ' + err.message);
    }
  };

  // Handle Photo upload
  const handlePhotoUpload = (orderId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImages(prev => ({ ...prev, [orderId]: reader.result as string }));
      showToast('📸 تم إرفاق سكرين شوت الإثبات بنجاح!');
    };
    reader.readAsDataURL(file);
  };

  // Calculations for current driver's view
  const deliveredOrders = driverOrders.filter(o => o.status === 'delivered');
  const assignedOrders = driverOrders.filter(o => o.status === 'assigned');
  const postponedOrders = driverOrders.filter(o => o.status === 'postponed');
  const returnedOrders = driverOrders.filter(o => o.status === 'returned' || o.status === 'damaged' || o.status === 'transferred');

  const totalCollectedCash = deliveredOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const driverEarnedFees = deliveredOrders.reduce((sum, o) => sum + (o.packageType === 'large' ? 2000 : 1500), 0);
  const netDueToCompany = totalCollectedCash - driverEarnedFees;

  const totalOrdersCount = driverOrders.length;
  const progressPercent = totalOrdersCount > 0 ? Math.round((deliveredOrders.length / totalOrdersCount) * 100) : 0;

  // Filtered list based on search and tab
  const displayedOrders = driverOrders.filter(o => {
    const matchesSearch =
      o.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery) ||
      o.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'assigned') return o.status === 'assigned';
    if (filterTab === 'delivered') return o.status === 'delivered';
    if (filterTab === 'postponed') return o.status === 'postponed';
    if (filterTab === 'returned') return o.status === 'returned' || o.status === 'damaged' || o.status === 'transferred';
    return true;
  });

  // Generate Handover Text for WhatsApp to Supervisor
  const generateHandoverText = () => {
    let t = `🏁 *كشف تسليم الوردية والحساب - المندوب ${selectedDriverObj.name}* 🏁\n`;
    t += `📅 التاريخ: ${new Date().toLocaleDateString('ar-IQ')} - ${new Date().toLocaleTimeString('ar-IQ')}\n`;
    if (activeSession) {
      t += `🆔 رقم الجلسة المعتمدة: ${activeSession.sessionNumber}\n`;
    }
    t += `━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `📦 إجمالي الشحنات بالقيد: ${driverOrders.length}\n`;
    t += `✅ تم التسليم (واصل): ${deliveredOrders.length} طلبات\n`;
    t += `🟠 مؤجل: ${postponedOrders.length} طلبات\n`;
    t += `🔴 راجع ومحول: ${returnedOrders.length} طلبات\n`;
    t += `⏳ متبقي قيد التوصيل: ${assignedOrders.length} طلبات\n`;
    t += `━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `💰 إجمالي الكاش المحصل بيدي: ${totalCollectedCash.toLocaleString()} د.ع\n`;
    t += `💼 أجور التوصيل المستحقة لي: - ${driverEarnedFees.toLocaleString()} د.ع\n`;
    t += `💵 الصافي المسلم لأمين الصندوق: ${netDueToCompany.toLocaleString()} د.ع\n`;
    return t;
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '30px', fontWeight: 800, fontSize: '0.92rem', zIndex: 10000, boxShadow: '0 10px 30px rgba(16, 185, 129, 0.5)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. DEDICATED PILOT DRIVER PROFILE HEADER                 */}
      {/* ======================================================== */}
      <div style={{ background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)', borderRadius: '20px', padding: '1.25rem', border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', position: 'relative' }}>
        
        {/* Top Profile Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', boxShadow: '0 6px 16px rgba(2, 132, 199, 0.4)' }}>
                🛵
              </div>
              <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', background: '#10b981', border: '2px solid #0f172a' }}></span>
            </div>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', fontWeight: 800 }}>
                  {selectedDriverObj.name}
                </h2>
                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>
                  فترة تجربة نشطة ⚡
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                <Phone size={13} style={{ color: '#38bdf8' }} />
                <span dir="ltr">{selectedDriverObj.phone}</span>
                <span>•</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>ميداني كربلاء 📍</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowDriverSwitcher(!showDriverSwitcher)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', color: '#94a3b8', borderRadius: '10px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="معاينة مندوب آخر"
            >
              <User size={13} /> {showDriverSwitcher ? 'إخفاء التبديل' : 'تبديل المندوب'}
            </button>
            <button
              onClick={loadData}
              style={{ background: '#0284c7', border: 'none', color: '#fff', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="مزامنة وتحديث البيانات"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Collapsible Switcher for debug/demo */}
        {showDriverSwitcher && (
          <div style={{ marginTop: '0.75rem', background: '#0f172a', padding: '0.75rem', borderRadius: '12px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>اختر المندوب للتجربة:</span>
            <select
              className="input"
              style={{ background: '#1e293b', color: '#38bdf8', borderColor: '#0284c7', fontSize: '0.85rem', padding: '0.3rem 0.6rem', width: 'auto' }}
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
            >
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
              ))}
            </select>
          </div>
        )}

        {/* Active Session Strip */}
        <div style={{ marginTop: '1rem', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#38bdf8' }} />
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>الوردية المفتوحة حالياً:</span>
              <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>
                {activeSession ? activeSession.sessionNumber : 'SES-20260814-001 (نشطة)'}
              </strong>
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>المشرف المسؤول:</span>
            <strong style={{ color: '#e2e8f0', fontSize: '0.88rem' }}>المدير العام 👑</strong>
          </div>
        </div>

        {/* Shift Progress Bar */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
            <span>نسبة إنجاز الوردية اليوم:</span>
            <span style={{ color: '#34d399' }}>{deliveredOrders.length} من {totalOrdersCount} شحنة ({progressPercent}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7 0%, #10b981 100%)', borderRadius: '10px', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>

        {/* Live Pocket Cash & Driver Wallet Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginTop: '1rem' }}>
          <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>📦 شحنات بيدك</span>
            <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>{assignedOrders.length} طلب</strong>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span style={{ fontSize: '0.72rem', color: '#34d399', display: 'block' }}>🟢 تم تسليمه (واصل)</span>
            <strong style={{ fontSize: '1.25rem', color: '#34d399' }}>{deliveredOrders.length} طلب</strong>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(2, 132, 199, 0.2) 100%)', padding: '0.75rem', borderRadius: '12px', border: '1px solid #10b981' }}>
            <span style={{ fontSize: '0.72rem', color: '#34d399', display: 'block', fontWeight: 700 }}>💵 الكاش بيدك الآن</span>
            <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>{totalCollectedCash.toLocaleString()} د.ع</strong>
          </div>

          <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'block' }}>💼 أجورك المكتسبة</span>
            <strong style={{ fontSize: '1.15rem', color: '#fbbf24' }}>{driverEarnedFees.toLocaleString()} د.ع</strong>
          </div>
        </div>

        {/* Handover & Cash Settlement Trigger Button */}
        <button
          onClick={() => setShowHandoverModal(true)}
          style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}
        >
          <ShieldCheck size={18} /> تصفية الوردية وتسليم الكاش لأمين الصندوق 🏁
        </button>

      </div>

      {/* ======================================================== */}
      {/* 2. EXPRESS SEARCH & STATUS TABS FILTER                   */}
      {/* ======================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 بحث فوري بالاسم، الباركود، أو رقم الهاتف..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', height: '48px', paddingRight: '44px', borderRadius: '14px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.95rem' }}
          />
          <Search size={20} style={{ position: 'absolute', right: '14px', top: '14px', color: '#38bdf8' }} />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', background: '#1e293b', padding: '4px', borderRadius: '14px', border: '1px solid #334155', overflowX: 'auto' }}>
          {[
            { key: 'all',       label: `الكل (${driverOrders.length})` },
            { key: 'assigned',  label: `🚚 للتوصيل (${assignedOrders.length})` },
            { key: 'delivered', label: `🟢 واصل (${deliveredOrders.length})` },
            { key: 'postponed', label: `🟠 مؤجل (${postponedOrders.length})` },
            { key: 'returned',  label: `🔴 راجع (${returnedOrders.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key as any)}
              style={{
                flex: 1,
                padding: '0.55rem 0.5rem',
                background: filterTab === tab.key ? '#0284c7' : 'transparent',
                color: filterTab === tab.key ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: filterTab === tab.key ? 800 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. ORDER CARDS LIST (INTERACTIVE FIELD TOOLS)            */}
      {/* ======================================================== */}
      {displayedOrders.length === 0 ? (
        <div style={{ background: '#1e293b', borderRadius: '18px', border: '1px solid #334155', padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
          <Package size={48} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>لا توجد شحنات مطابقة في هذا التبويب</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {displayedOrders.map(order => {
            const isDelivered = order.status === 'delivered';
            const isPostponed = order.status === 'postponed';
            const isReturned = order.status === 'returned';
            const isAssigned = order.status === 'assigned';
            const isExpanded = expandedOrderId === order.id;
            const hasProof = !!proofImages[order.id] || !!order.proofScreenshot;

            const prefilledWaMsg = `السلام عليكم ورحمة الله، أنا المندوب حسين من شركة التوصيل ومعي طلبك [${order.barcode}] من [${order.merchantName || 'المتجر'}] بمبلغ ${Number(order.amount).toLocaleString()} د.ع. يرجى تأكيد تواجدك بالمنزل لاستلام الطلب.`;
            const waUrl = `https://wa.me/964${order.phone.replace(/^0/, '')}?text=${encodeURIComponent(prefilledWaMsg)}`;
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;

            return (
              <div
                key={order.id}
                style={{
                  background: isDelivered ? 'linear-gradient(135deg, #064e3b 0%, #1e293b 80%)' : '#1e293b',
                  borderRadius: '18px',
                  padding: '1.25rem',
                  border: '1.5px solid ' + (isDelivered ? '#10b981' : isPostponed ? '#f59e0b' : isReturned ? '#ef4444' : '#334155'),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: isDelivered ? '0 8px 24px rgba(16, 185, 129, 0.2)' : '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header: Barcode & Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.15rem', letterSpacing: '0.5px' }}>
                      {order.barcode}
                    </span>
                    <span style={{ fontSize: '0.72rem', background: '#0f172a', color: '#94a3b8', padding: '2px 6px', borderRadius: '6px', border: '1px solid #334155' }}>
                      {order.packageType === 'large' ? 'طرد كبير (2,000 د.ع)' : 'طرد صغير (1,500 د.ع)'}
                    </span>
                  </div>

                  <span className={'status-badge ' + order.status} style={{ fontWeight: 800 }}>
                    {order.status === 'delivered' ? 'واصل 🟢' :
                     order.status === 'postponed' ? 'مؤجل 🟠' :
                     order.status === 'returned' ? 'راجع 🔴' :
                     order.status === 'transferred' ? 'محوَّل 🔀' : 'قيد التوصيل 🚚'}
                  </span>
                </div>

                {/* Customer & Merchant Title */}
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#fff', fontWeight: 800 }}>
                    {order.customerName}
                  </h3>
                  {order.merchantName && (
                    <span style={{ fontSize: '0.8rem', color: '#c084fc', display: 'block', fontWeight: 600 }}>
                      🏪 المتجر: {twoWords(order.merchantName)}
                    </span>
                  )}
                </div>

                {/* Customer Action Bar (Call, WhatsApp, Maps) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <a
                    href={`tel:${order.phone}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0.6rem 0.4rem', background: '#0284c7', color: '#fff', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)' }}
                  >
                    <Phone size={15} /> اتصال 📞
                  </a>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0.6rem 0.4rem', background: '#25D366', color: '#fff', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)' }}
                  >
                    <MessageCircle size={15} /> واتساب 💬
                  </a>

                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0.6rem 0.4rem', background: '#334155', color: '#f43f5e', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textDecoration: 'none' }}
                  >
                    <Navigation size={15} /> الخريطة 🗺️
                  </a>
                </div>

                {/* Address & Required Amount Box */}
                <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '14px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '6px' }}>
                    <MapPin size={16} style={{ color: '#f43f5e', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontWeight: 600 }}>{order.address}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '6px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>المبلغ المطلوب تحصيله:</span>
                    <strong style={{ fontSize: '1.3rem', color: '#facc15', fontWeight: 900 }}>
                      {Number(order.amount).toLocaleString()} د.ع
                    </strong>
                  </div>
                </div>

                {/* Notes or SubStatus Badge */}
                {order.notes && (
                  <div style={{ fontSize: '0.82rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    📌 ملاحظة: {order.notes}
                  </div>
                )}

                {/* Proof Attachment Area */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.4rem 0.75rem', background: hasProof ? 'rgba(16, 185, 129, 0.2)' : '#0f172a', color: hasProof ? '#34d399' : '#94a3b8', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (hasProof ? '#10b981' : '#334155') }}>
                    <Camera size={14} />
                    {hasProof ? 'تم إرفاق إثبات المكالمة ✓' : 'إرفاق سكرين شوت المكالمة 📸'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoUpload(order.id, f);
                      }}
                    />
                  </label>

                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}
                  >
                    {isExpanded ? 'إخفاء الإجراءات' : 'إجراءات أخرى'}
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Primary Instant Delivery & Postpone Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <button
                    disabled={isDelivered}
                    onClick={() => handleUpdateStatus(order.id, 'delivered', 'تم التسليم واصل', { proofScreenshot: proofImages[order.id] })}
                    style={{
                      padding: '0.75rem',
                      background: isDelivered ? '#059669' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      fontWeight: 900,
                      cursor: isDelivered ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: isDelivered ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    <CheckCircle2 size={18} /> {isDelivered ? 'واصل تم الاستلام ✓' : 'واصل (تسليم فوري) 🟢'}
                  </button>

                  <button
                    onClick={() => {
                      setActiveModalOrder(order);
                      setModalActionType('postpone');
                    }}
                    style={{ padding: '0.75rem', background: '#d97706', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Clock size={16} /> تأجيل ⏳
                  </button>
                </div>

                {/* Expanded Advanced Field Actions */}
                {isExpanded && (
                  <div style={{ background: '#0f172a', borderRadius: '14px', padding: '0.85rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>إجراءات الحسابات الاستثنائية والتحويل:</span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                      <button
                        onClick={() => {
                          setActiveModalOrder(order);
                          setNewPriceAmount(order.amount.toString());
                          setModalActionType('price');
                        }}
                        style={{ padding: '0.55rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <DollarSign size={14} /> تعديل السعر
                      </button>

                      <button
                        onClick={() => {
                          setActiveModalOrder(order);
                          setPartialNewAmount(order.amount.toString());
                          setModalActionType('partial');
                        }}
                        style={{ padding: '0.55rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Package size={14} /> تسليم جزئي
                      </button>

                      <button
                        onClick={() => {
                          setActiveModalOrder(order);
                          setModalActionType('transfer');
                        }}
                        style={{ padding: '0.55rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <ArrowRightLeft size={14} /> تحويل الشحنة
                      </button>

                      <button
                        onClick={() => {
                          setActiveModalOrder(order);
                          setModalActionType('return');
                        }}
                        style={{ padding: '0.55rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <XCircle size={14} /> رفض واسترجاع
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS: FIELD ACTIONS (POSTPONE, PRICE, RETURN...)    */}
      {/* ======================================================== */}
      {activeModalOrder && modalActionType && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '20px', width: '100%', maxWidth: '460px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 800 }}>
                  {modalActionType === 'postpone' ? '⏳ تأجيل تسليم الشحنة' :
                   modalActionType === 'price'    ? '💵 تعديل المبلغ بموافقة المتجر' :
                   modalActionType === 'partial'  ? '📦 تسليم جزئي وقطع راجعة' :
                   modalActionType === 'transfer' ? '🔀 تحويل الشحنة' :
                   '🔴 رفض الزبون وتسجيل راجع'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>الشحنة: {activeModalOrder.barcode} • {activeModalOrder.customerName}</span>
              </div>
              <button onClick={() => { setActiveModalOrder(null); setModalActionType(null); }} style={{ color: '#94a3b8', fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Postpone Form */}
            {modalActionType === 'postpone' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>نوع التأجيل الميداني:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {[
                      { key: 'tonight',   label: '⏳ تأجيل ليلاً نفس اليوم' },
                      { key: 'tomorrow',  label: '📅 تأجيل لغداً' },
                      { key: 'date',      label: '📆 تأجيل ليوم محدد' },
                      { key: 'no_answer', label: '📵 مغلق / لا يرد' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setPostponeType(opt.key as any)}
                        style={{ padding: '0.6rem', background: postponeType === opt.key ? '#0284c7' : '#0f172a', color: postponeType === opt.key ? '#fff' : '#94a3b8', border: '1px solid ' + (postponeType === opt.key ? '#0284c7' : '#334155'), borderRadius: '10px', fontSize: '0.8rem', fontWeight: postponeType === opt.key ? 800 : 500, cursor: 'pointer' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(postponeType === 'tonight' || postponeType === 'tomorrow') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>الساعة المحددة للتسليم:</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155' }}
                      value={postponeTime}
                      onChange={e => setPostponeTime(e.target.value)}
                      placeholder="مثلاً: 8:30 مساءً"
                    />
                  </div>
                )}

                {postponeType === 'date' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>التاريخ المطلوب:</label>
                    <input
                      type="date"
                      className="input"
                      style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155' }}
                      value={postponeDate}
                      onChange={e => setPostponeDate(e.target.value)}
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    const notes = postponeType === 'no_answer' ? 'الزبون لا يرد / مغلق' :
                                  postponeType === 'tonight'   ? `مؤجل ليلاً نفس اليوم - الساعة ${postponeTime}` :
                                  postponeType === 'tomorrow'  ? `مؤجل لغداً - الساعة ${postponeTime}` :
                                  `مؤجل ليوم ${postponeDate} - الساعة ${postponeTime}`;

                    handleUpdateStatus(activeModalOrder.id, 'postponed', notes, {
                      subStatus: postponeType,
                      postponedTime: postponeTime,
                      postponedDate: postponeDate,
                      proofScreenshot: proofImages[activeModalOrder.id]
                    });
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: '#d97706', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  تأكيد التأجيل ⏳
                </button>
              </div>
            )}

            {/* Edit Price Form */}
            {modalActionType === 'price' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>المبلغ الجديد المطلوب تحصيله (د.ع):</label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', background: '#0f172a', color: '#34d399', fontWeight: 900, fontSize: '1.2rem', borderColor: '#334155' }}
                    value={newPriceAmount}
                    onChange={e => setNewPriceAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>سبب التعديل / موافقة المتجر:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="خصم بموافقة المتجر / تصحيح حساب..."
                    style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155' }}
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    const price = parseFloat(newPriceAmount);
                    if (!price || price <= 0) return alert('يرجى إدخال مبلغ صالح');
                    handleUpdateStatus(activeModalOrder.id, 'delivered', `تعديل السعر إلى ${price} د.ع (${actionNotes || 'بموافقة المتجر'})`, {
                      amount: price,
                      proofScreenshot: proofImages[activeModalOrder.id]
                    });
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  تثبيت واصل بالسعر الجديد 💵
                </button>
              </div>
            )}

            {/* Partial Delivery Form */}
            {modalActionType === 'partial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>عدد القطع الراجعة:</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    style={{ width: '100%', background: '#0f172a', color: '#f87171', fontWeight: 800, borderColor: '#334155' }}
                    value={partialReturnCount}
                    onChange={e => setPartialReturnCount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>المبلغ المحصل للقطع المستلمة (د.ع):</label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', background: '#0f172a', color: '#34d399', fontWeight: 900, fontSize: '1.2rem', borderColor: '#334155' }}
                    value={partialNewAmount}
                    onChange={e => setPartialNewAmount(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    const price = parseFloat(partialNewAmount);
                    const count = parseInt(partialReturnCount) || 1;
                    handleUpdateStatus(activeModalOrder.id, 'delivered', `تسليم جزئي (راجع ${count} قطع) - المبلغ المحصل ${price} د.ع`, {
                      amount: price,
                      returnedItemsCount: count,
                      proofScreenshot: proofImages[activeModalOrder.id]
                    });
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  تثبيت التسليم الجزئي 📦
                </button>
              </div>
            )}

            {/* Transfer Form */}
            {modalActionType === 'transfer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>نوع التحويل:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                    {[
                      { key: 'driver',       label: '👤 لمندوب' },
                      { key: 'governorate',  label: '🏙️ لمحافظة' },
                      { key: 'area',         label: '📍 لمنطقة' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setTransferType(opt.key as any)}
                        style={{ padding: '0.5rem', background: transferType === opt.key ? '#0284c7' : '#0f172a', color: transferType === opt.key ? '#fff' : '#94a3b8', border: '1px solid ' + (transferType === opt.key ? '#0284c7' : '#334155'), borderRadius: '8px', fontSize: '0.75rem', fontWeight: transferType === opt.key ? 700 : 400, cursor: 'pointer' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {transferType === 'driver' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>اختر المندوب المحول إليه:</label>
                    <select
                      className="input"
                      style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155' }}
                      value={targetDriverId}
                      onChange={e => setTargetDriverId(e.target.value)}
                    >
                      <option value="">-- اختر المندوب --</option>
                      {drivers.filter(d => d.id !== selectedDriverId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>العنوان أو الوجهة الجديدة:</label>
                    <input
                      type="text"
                      className="input"
                      placeholder={transferType === 'governorate' ? 'مثال: البصرة - الجبيلة' : 'مثال: حي الإسكان - شارع 60'}
                      style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155' }}
                      value={targetLocationText}
                      onChange={e => setTargetLocationText(e.target.value)}
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    const subStatus = transferType === 'driver' ? 'driver_transfer' : transferType === 'governorate' ? 'governorate_transfer' : 'area_transfer';
                    const targetD = drivers.find(d => d.id === targetDriverId);
                    const noteText = transferType === 'driver' ? `تحويل للمندوب ${targetD?.name || targetDriverId}` : `تحويل إلى ${targetLocationText}`;
                    handleUpdateStatus(activeModalOrder.id, 'transferred', noteText, {
                      subStatus,
                      proofScreenshot: proofImages[activeModalOrder.id]
                    });
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  تأكيد تحويل الشحنة 🔀
                </button>
              </div>
            )}

            {/* Return Form */}
            {modalActionType === 'return' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.35rem' }}>سبب الرفض والاسترجاع:</label>
                  <select
                    className="input"
                    style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155', marginBottom: '0.5rem' }}
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                  >
                    <option value="">-- اختر سبب الرفض الشائع --</option>
                    <option value="الزبون رفض الاستلام بدون سبب">الزبون رفض الاستلام بدون سبب</option>
                    <option value="القياس أو اللون غير مطابق">القياس أو اللون غير مطابق</option>
                    <option value="تأخر الطلب والزبون اشترى من مكان آخر">تأخر الطلب والزبون اشترى من مكان آخر</option>
                    <option value="السعر مختلف عن المتفق عليه بالصفحة">السعر مختلف عن المتفق عليه بالصفحة</option>
                    <option value="المنتج مكسور أو متضرر">المنتج مكسور أو متضرر</option>
                  </select>
                  <input
                    type="text"
                    className="input"
                    placeholder="أو اكتب سبباً مخصصاً..."
                    style={{ width: '100%', background: '#0f172a', color: '#fff', borderColor: '#334155' }}
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                  />
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '0.65rem', borderRadius: '10px', fontSize: '0.8rem', color: '#f87171' }}>
                  ⚠️ يرجى التأكد من إرفاق سكرين شوت المحادثة أو سجل المكالمات لتوثيق الرفض.
                </div>
                <button
                  onClick={() => {
                    const finalReason = actionNotes || returnReason || 'رفض استلام';
                    handleUpdateStatus(activeModalOrder.id, 'returned', `رفض الزبون: ${finalReason}`, {
                      proofScreenshot: proofImages[activeModalOrder.id]
                    });
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  تأكيد الراجع 🔴
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL: SHIFT HANDOVER & CASH SETTLEMENT SUMMARY       */}
      {/* ======================================================== */}
      {showHandoverModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #10b981', borderRadius: '20px', width: '100%', maxWidth: '520px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 800 }}>تصفية الوردية وتسليم الكاش</h3>
              </div>
              <button onClick={() => setShowHandoverModal(false)} style={{ color: '#94a3b8', fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <textarea
              readOnly
              style={{ width: '100%', minHeight: '260px', padding: '1rem', background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '14px', fontFamily: 'monospace', fontSize: '0.88rem', direction: 'rtl', lineHeight: 1.7, resize: 'none', boxSizing: 'border-box' }}
              value={generateHandoverText()}
            />

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(generateHandoverText()), '_blank')}
                style={{ flex: 1, minWidth: '140px', padding: '0.75rem', background: '#25D366', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Send size={16} /> إرسال للمشرف واتساب 💬
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateHandoverText());
                  setCopiedHandover(true);
                  setTimeout(() => setCopiedHandover(false), 2000);
                }}
                style={{ padding: '0.75rem 1.25rem', background: copiedHandover ? '#10b981' : '#334155', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {copiedHandover ? 'تم النسخ ✓' : 'نسخ الكشف'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default DriverMobileApp;
