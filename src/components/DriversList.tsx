import React, { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Phone, CheckCircle2, PackageCheck, FileText, Send, X, RefreshCw, DollarSign, ShoppingBag, ShieldCheck, Search, Printer, Zap, Barcode, Check, Layers, Edit3, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { Driver, Order } from '../services/api';
import { twoWords } from '../utils/textUtils';

const DriversList: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDriverForSheet, setSelectedDriverForSheet] = useState<Driver | null>(null);
  const [printableVoucherDriver, setPrintableVoucherDriver] = useState<Driver | null>(null);

  // حالة تعديل المندوب
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');

  // مرحلة وتبويب الكشف اليومي 3 مراحل: 1. المانفيست | 2. مطابقة الراجع | 3. التصفية المالية
  const [sheetStageTab, setSheetStageTab] = useState<'manifest' | 'return_scan' | 'accounting'>('accounting');
  const [returnScanBarcode, setReturnScanBarcode] = useState('');
  const [returnScanLogs, setReturnScanLogs] = useState<{ id: string; barcode: string; text: string; time: string; success: boolean }[]>([]);
  const returnScanInputRef = useRef<HTMLInputElement>(null);

  // نماذج التعديل اللحظي في تصفية نهاية اليوم
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editReturnedCount, setEditReturnedCount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [targetDriverHandover, setTargetDriverHandover] = useState<string>('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [driversData, ordersData] = await Promise.all([
        api.getDrivers(),
        api.getOrders()
      ]);
      setDrivers(driversData);
      setOrders(ordersData);
    } catch {
      setError('تعذر تحميل البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedDriverForSheet && sheetStageTab === 'return_scan') {
      setTimeout(() => returnScanInputRef.current?.focus(), 100);
    }
  }, [selectedDriverForSheet, sheetStageTab]);

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
    } catch { }
  };

  const printHTMLDocument = (htmlContent: string) => {
    try {
      const printWindow = window.open('', '_blank', 'width=900,height=900');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch { }
        }, 300);
        return;
      }
    } catch { }

    // Fallback: Print via Hidden iFrame (bypasses pop-up blockers 100%)
    let iframe = document.getElementById('global-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'global-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '-9999px';
      iframe.style.bottom = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch { }
      }, 350);
    }
  };

  const handlePrintManifest = (driver: Driver) => {
    const stats = getDriverStats(driver.id);
    const driverOrders = stats.driverOrders;
    const totalAmount = driverOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    const rows = driverOrders.length === 0 ? `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">لا يوجد شحنات بقائمة الخروج لهذا المندوب.</td>
      </tr>
    ` : driverOrders.map((o, idx) => `
      <tr>
        <td style="border: 1px solid #475569; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #475569; padding: 8px; font-weight: 800; color: #0284c7;">${o.barcode}</td>
        <td style="border: 1px solid #475569; padding: 8px;">${o.merchantName || '—'}</td>
        <td style="border: 1px solid #475569; padding: 8px;"><strong>${o.customerName}</strong> (${o.address})</td>
        <td style="border: 1px solid #475569; padding: 8px;" dir="ltr">${o.phone}</td>
        <td style="border: 1px solid #475569; padding: 8px; text-align: left; font-weight: 800; color: #166534;">${Number(o.amount).toLocaleString()} د.ع</td>
        <td style="border: 1px solid #475569; padding: 8px;"></td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>قائمة الخروج - ${driver.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 24px; color: #000; background: #fff; margin: 0; }
          .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { font-size: 22px; margin: 0; font-weight: 800; }
          .header h2 { font-size: 15px; margin: 4px 0 0 0; color: #333; }
          .info-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th { background: #f1f5f9; border: 1.5px solid #000; padding: 10px; text-align: right; font-weight: 800; color: #000; }
          td { border: 1px solid #475569; padding: 8px; text-align: right; color: #000; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 42%; }
          .sig-line { border-bottom: 1.5px solid #000; margin-top: 45px; }
          @media print {
            body { padding: 0; }
            @page { size: A4 portrait; margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>شركة أكسبرس ⚡ للتوصيل السريع</h1>
            <h2>قائمة الخروج الرسمية - الشحنات المجهزة بالميدان</h2>
          </div>
          <div style="text-align: left; font-size: 12px;">
            <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-IQ')}</div>
            <div><strong>المندوب:</strong> ${driver.name}</div>
            <div><strong>الهاتف:</strong> ${driver.phone}</div>
          </div>
        </div>

        <div class="info-box">
          <span><strong>عدد الشحنات المسلمة:</strong> ${driverOrders.length} شحنة</span>
          <span><strong>إجمالي المبالغ التحصيلية:</strong> ${totalAmount.toLocaleString()} د.ع</span>
          <span><strong>حالة القيد:</strong> مجهز للميدان 🚚</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 35px;">ت</th>
              <th>الباركود</th>
              <th>المتجر</th>
              <th>اسم الزبون والعنوان</th>
              <th>رقم الهاتف</th>
              <th style="text-align: left;">المبلغ (د.ع)</th>
              <th style="text-align: center; width: 110px;">توقيع الزبون</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <span style="font-weight: 700; font-size: 13px;">توقيع المندوب الميداني (استلام الذمة)</span>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <span style="font-weight: 700; font-size: 13px;">توقيع أمين المخزن (التسليم)</span>
            <div class="sig-line"></div>
          </div>
        </div>
      </body>
      </html>
    `;

    printHTMLDocument(html);
  };

  const handlePrintVoucher = (driver: Driver) => {
    const stats = getDriverStats(driver.id);
    const voucherId = `VCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${driver.id.substring(0, 4)}`;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>وصل الحساب المالي - ${driver.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 24px; color: #000; background: #fff; margin: 0; }
          .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { font-size: 22px; margin: 0; font-weight: 800; }
          .header h2 { font-size: 15px; margin: 4px 0 0 0; color: #333; }
          .info-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
          th { background: #f1f5f9; border: 1.5px solid #000; padding: 10px; text-align: right; font-weight: 800; color: #000; }
          td { border: 1px solid #475569; padding: 10px; text-align: right; color: #000; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 42%; }
          .sig-line { border-bottom: 1.5px solid #000; margin-top: 45px; }
          @media print {
            body { padding: 0; }
            @page { size: A4 portrait; margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>شركة أكسبرس ⚡ للتوصيل السريع</h1>
            <h2>وصل الحساب المالي وإغلاق اليوم</h2>
          </div>
          <div style="text-align: left; font-size: 12px;">
            <div><strong>رقم الوصل:</strong> ${voucherId}</div>
            <div><strong>تاريخ الحساب:</strong> ${new Date().toLocaleDateString('ar-IQ')}</div>
          </div>
        </div>

        <div class="info-box">
          <div><strong>المندوب:</strong> ${driver.name}</div>
          <div><strong>الهاتف:</strong> ${driver.phone}</div>
          <div><strong>إجمالي القيد:</strong> ${stats.totalAssigned} شحنة</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>البيان المالي</th>
              <th style="text-align: center;">العدد</th>
              <th style="text-align: left;">المبلغ (د.ع)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>إجمالي الكاش المحصل من الزبائن</td>
              <td style="text-align: center;">${stats.deliveredCount} واصل</td>
              <td style="text-align: left; font-weight: 800; color: #166534;">+ ${stats.totalCollected.toLocaleString()} د.ع</td>
            </tr>
            <tr>
              <td>خصم أجور وعمولة المندوب المكتسبة</td>
              <td style="text-align: center;">—</td>
              <td style="text-align: left; font-weight: 800; color: #b91c1c;">- ${stats.driverFees.toLocaleString()} د.ع</td>
            </tr>
            ${stats.damagedPenalties > 0 ? `
            <tr>
              <td>خصم الشحنات المفقودة / التالفة</td>
              <td style="text-align: center;">—</td>
              <td style="text-align: left; font-weight: 800; color: #b45309;">+ ${stats.damagedPenalties.toLocaleString()} د.ع</td>
            </tr>
            ` : ''}
            <tr style="background: #f8fafc; font-size: 15px; font-weight: 800;">
              <td colspan="2" style="border: 2px solid #000;">الصافي المستلم للشركة</td>
              <td style="border: 2px solid #000; text-align: left;">${stats.netToCompany.toLocaleString()} د.ع</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <span style="font-weight: 700; font-size: 13px;">توقيع المحاسب المستلم</span>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <span style="font-weight: 700; font-size: 13px;">توقيع المندوب المسلم</span>
            <div class="sig-line"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printHTMLDocument(html);
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    try {
      await api.createDriver(name, phone);
      setName('');
      setPhone('');
      setShowAddModal(false);
      setSuccessMsg(`تم إضافة [${name}] بنجاح 🎉`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل الإضافة.');
    }
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    try {
      await api.updateDriver(editingDriver.id, editDriverName, editDriverPhone);
      setSuccessMsg(`تم تعديل بيانات المندوب [${editDriverName}] بنجاح!`);
      setEditingDriver(null);
      loadData();
    } catch (err: any) {
      setError('فشل تعديل المندوب: ' + err.message);
    }
  };

  const handleDeleteDriver = async (driver: Driver) => {
    if (!confirm(`⚠️ هل أنت متأكد من حذف المندوب [${driver.name}]؟\nسوف يتم تفريغ عهدته وإعادة شحناته النشطة للمخزن تلقائياً.`)) return;
    try {
      const res = await api.deleteDriver(driver.id);
      setSuccessMsg(res.message || `تم حذف المندوب [${driver.name}] بنجاح`);
      loadData();
    } catch (err: any) {
      setError('فشل حذف المندوب: ' + err.message);
    }
  };

  // حساب إحصائيات تصفية يومية المندوب الكاملة والعهدة
  const getDriverStats = (driverId: string) => {
    const driverOrders = orders.filter(o => o.driverId === driverId);

    const deliveredOrders = driverOrders.filter(o => o.status === 'delivered');
    const returnedOrders = driverOrders.filter(o => o.status === 'returned');
    const postponedOrders = driverOrders.filter(o => o.status === 'postponed');
    const assignedOrders = driverOrders.filter(o => o.status === 'assigned');
    const damagedOrders = driverOrders.filter(o => o.status === 'damaged' && o.notes?.includes('بعد الخروج'));

    const partialReturnedOrders = driverOrders.filter(o => o.status === 'delivered' && o.returnedItemsCount && o.returnedItemsCount > 0);
    const priceChangedOrders = driverOrders.filter(o => o.status === 'delivered' && o.notes?.includes('تعديل سعر'));
    const replacementOrders = driverOrders.filter(o => o.notes?.includes('استبدال'));

    const totalCollected = deliveredOrders.reduce((acc, o) => acc + Number(o.amount), 0);
    const damagedPenalties = damagedOrders.reduce((acc, o) => acc + Number(o.amount), 0);

    const driverFees = deliveredOrders.reduce((sum, o) => {
      const fee = o.packageType === 'large' ? 2000 : 1500;
      return sum + fee;
    }, 0);

    const netToCompany = (totalCollected + damagedPenalties) - driverFees;

    const totalAssigned = driverOrders.length;
    const successRate = totalAssigned > 0 ? Math.round((deliveredOrders.length / totalAssigned) * 100) : 100;

    return {
      driverOrders,
      totalAssigned,
      deliveredCount: deliveredOrders.length,
      returnedCount: returnedOrders.length,
      postponedCount: postponedOrders.length,
      assignedCount: assignedOrders.length,
      damagedCount: damagedOrders.length,
      partialReturnedCount: partialReturnedOrders.length,
      priceChangedCount: priceChangedOrders.length,
      replacementCount: replacementOrders.length,
      damagedPenalties,
      totalCollected,
      driverFees,
      netToCompany,
      successRate
    };
  };

  // مطابقة ومسح الطرود الراجعة بمسدس الباركود
  const handleReturnScanSubmit = async (e: React.FormEvent, driverId: string) => {
    e.preventDefault();
    const code = returnScanBarcode.trim();
    if (!code) return;

    const driverOrders = orders.filter(o => o.driverId === driverId);
    const matchingOrder = driverOrders.find(o =>
      o.barcode.toLowerCase() === code.toLowerCase() ||
      code.toLowerCase().includes(o.barcode.toLowerCase()) ||
      o.barcode.toLowerCase().includes(code.toLowerCase())
    );

    if (!matchingOrder) {
      playAudioFeedback('error');
      setReturnScanLogs(prev => [{
        id: Math.random().toString(),
        barcode: code,
        time: new Date().toLocaleTimeString('ar-IQ'),
        success: false,
        text: `❌ الشحنة [${code}] غير موجودة بالعهدة`
      }, ...prev]);
    } else {
      try {
        await api.updateStatus(matchingOrder.id, 'returned', 'استلام راجع بالمخزن بالمسدس 🏬🟢');
        playAudioFeedback('success');
        setReturnScanLogs(prev => [{
          id: Math.random().toString(),
          barcode: matchingOrder.barcode,
          time: new Date().toLocaleTimeString('ar-IQ'),
          success: true,
          text: `🏬 استلام الطرد [${matchingOrder.barcode}]`
        }, ...prev]);
        loadData();
      } catch {
        playAudioFeedback('error');
        setReturnScanLogs(prev => [{
          id: Math.random().toString(),
          barcode: matchingOrder.barcode,
          time: new Date().toLocaleTimeString('ar-IQ'),
          success: false,
          text: `❌ فشل التحديث بالسيرفر`
        }, ...prev]);
      }
    }

    setReturnScanBarcode('');
    setTimeout(() => returnScanInputRef.current?.focus(), 50);
  };

  // حفظ تعديلات نهاية اليوم على طلب معين من داخل كشف المندوب
  const handleSaveOrderReconciliation = async (order: Order) => {
    try {
      if (targetDriverHandover) {
        await api.assignOrder(order.id, targetDriverHandover);
        setSuccessMsg(`تم التحويل للمندوب بنجاح`);
      } else {
        await api.updateStatus(
          order.id,
          editStatus || order.status,
          editNotes || order.notes || '',
          {
            amount: editAmount !== '' ? parseFloat(editAmount) : order.amount,
            returnedItemsCount: editReturnedCount
          }
        );
        setSuccessMsg(`تم الحفظ بنجاح`);
      }

      setEditingOrderId(null);
      setTargetDriverHandover('');
      setEditNotes('');
      loadData();
    } catch (err: any) {
      setError('فشل الحفظ.');
    }
  };

  const overallAssignedCount = orders.filter(o => o.status === 'assigned').length;
  const overallDeliveredCount = orders.filter(o => o.status === 'delivered' && o.driverId).length;
  const overallPendingCash = orders.filter(o => o.status === 'delivered' && o.driverId).reduce((s, o) => s + (o.amount || 0), 0);

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.phone.includes(searchQuery)
  );

  return (
    <main className="dashboard-container">
      {/* Top Banner Executive Dashboard Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        padding: '1.75rem',
        borderRadius: '20px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        color: '#fff',
        boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
        marginBottom: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#8b5cf6', padding: '10px', borderRadius: '14px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={28} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  إدارة المناديب والتصفية 👥
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
                  تصفية الحسابات والعهدة اليومية
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="action-btn" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} onClick={loadData}>
              <RefreshCw size={18} /> تحديث 🔄
            </button>
            <button className="action-btn" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', fontWeight: 700 }} onClick={() => setShowAddModal(true)}>
              <UserPlus size={18} /> إضافة مندوب 👤
            </button>
          </div>
        </div>

        {/* Quick Executive Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.25rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>المناديب 👥</span>
            <strong style={{ fontSize: '1.3rem', color: '#38bdf8', marginTop: '2px', display: 'block' }}>{drivers.length} مندوب</strong>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>قيد الميدان 🚚</span>
            <strong style={{ fontSize: '1.3rem', color: '#c084fc', marginTop: '2px', display: 'block' }}>{overallAssignedCount} شحنة</strong>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>الكاش 💰</span>
            <strong style={{ fontSize: '1.3rem', color: '#34d399', marginTop: '2px', display: 'block' }}>{overallPendingCash.toLocaleString()} د.ع</strong>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>الواصل 🟢</span>
            <strong style={{ fontSize: '1.3rem', color: '#fba518', marginTop: '2px', display: 'block' }}>{overallDeliveredCount} شحنة</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem', borderRadius: '12px' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', float: 'left' }}>✕</button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1rem', borderRadius: '12px' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', float: 'left' }}>✕</button>
        </div>
      )}

      {/* Search and Filters Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input
            type="text"
            className="input"
            placeholder="البحث بالاسم أو الهاتف..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', height: '42px', paddingRight: '40px', borderRadius: '12px', fontSize: '0.9rem' }}
          />
          <Search size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>عرض {filteredDrivers.length} من أصل {drivers.length} مندوب</span>
      </div>

      {/* Add Driver Modal */}
      {showAddModal && (
        <form onSubmit={handleCreateDriver} className="card" style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>إضافة مندوب 👤</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input
              type="text"
              className="input"
              placeholder="اسم المندوب"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ height: '45px', borderRadius: '10px' }}
            />
            <input
              type="text"
              className="input"
              placeholder="رقم الهاتف"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              style={{ height: '45px', borderRadius: '10px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontWeight: 700 }}>حفظ المندوب</button>
            <button type="button" className="btn" style={{ background: '#64748b', color: '#fff' }} onClick={() => setShowAddModal(false)}>إلغاء</button>
          </div>
        </form>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <form onSubmit={handleUpdateDriver} className="card" style={{ background: '#1e293b', color: '#fff', borderRadius: '16px', border: '1px solid #38bdf8', marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} /> تعديل بيانات المندوب [{editingDriver.name}]:
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>اسم المندوب:</label>
              <input
                type="text"
                className="input"
                placeholder="اسم المندوب..."
                value={editDriverName}
                onChange={e => setEditDriverName(e.target.value)}
                required
                style={{ height: '45px', borderRadius: '10px', background: '#0f172a', color: '#fff', borderColor: '#475569' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>رقم الهاتف:</label>
              <input
                type="text"
                className="input"
                placeholder="رقم الهاتف..."
                value={editDriverPhone}
                onChange={e => setEditDriverPhone(e.target.value)}
                required
                style={{ height: '45px', borderRadius: '10px', background: '#0f172a', color: '#fff', borderColor: '#475569' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontWeight: 700, background: '#10b981' }}>حفظ التعديلات 💾</button>
            <button type="button" className="btn" style={{ background: '#64748b', color: '#fff' }} onClick={() => setEditingDriver(null)}>إلغاء ✕</button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="loading-state">تحميل المناديب...</div>
      ) : filteredDrivers.length === 0 ? (
        <div className="empty-state" style={{ background: 'var(--bg-secondary)', padding: '3rem', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
          <Users size={48} style={{ color: 'var(--text-muted)' }} />
          <p style={{ marginTop: '0.75rem', fontSize: '1rem', color: 'var(--text-muted)' }}>لا يوجد مناديب.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredDrivers.map(driver => {
            const stats = getDriverStats(driver.id);
            return (
              <div key={driver.id} className="card" style={{
                background: 'var(--bg-surface)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease-in-out',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Header Profile Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        color: '#fff',
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        fontWeight: 800
                      }}>
                        {driver.name.charAt(0)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>{driver.name}</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0 0 0' }}>
                          <Phone size={12} />
                          <span dir="ltr">{driver.phone}</span>
                        </p>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span> نشط
                    </span>
                  </div>

                  {/* Delivery Success Rate Progress Bar */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '0.65rem 0.85rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>نسبة النجاح</span>
                      <strong style={{ color: stats.successRate >= 80 ? '#10b981' : '#f59e0b' }}>{stats.successRate}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ width: `${stats.successRate}%`, height: '100%', background: stats.successRate >= 80 ? '#10b981' : '#f59e0b', borderRadius: '10px', transition: 'width 0.5s ease' }}></div>
                    </div>
                  </div>

                  {/* Custody & Delivery Numbers breakdown grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '0.6rem 0.75rem', borderRadius: '10px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>إجمالي القيد</span>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <PackageCheck size={14} /> {stats.totalAssigned} شحنة
                      </strong>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '0.6rem 0.75rem', borderRadius: '10px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>واصل ومكتمل</span>
                      <strong style={{ color: '#10b981', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <CheckCircle2 size={14} /> {stats.deliveredCount} شحنة
                      </strong>
                    </div>
                  </div>

                  {/* Financial Settlement Box */}
                  <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.85rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>أجور المندوب:</span>
                      <strong style={{ color: '#166534' }}>{stats.driverFees.toLocaleString()} د.ع</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '0.4rem', borderTop: '1px dashed rgba(16, 185, 129, 0.3)', paddingTop: '0.4rem' }}>
                      <span>الصافي للشركة:</span>
                      <span>{stats.netToCompany.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>

                {/* Primary Card Action Buttons */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '1.25rem' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => {
                      setSelectedDriverForSheet(driver);
                      setSheetStageTab('accounting');
                    }}
                  >
                    <FileText size={16} /> فتح الكشف 📄
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}
                    title="معاينة السند"
                    onClick={() => setPrintableVoucherDriver(driver)}
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#38bdf8', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}
                    title="تعديل بيانات المندوب"
                    onClick={() => {
                      setEditingDriver(driver);
                      setEditDriverName(driver.name);
                      setEditDriverPhone(driver.phone);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}
                    title="حذف المندوب"
                    onClick={() => handleDeleteDriver(driver)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. Modal: Executive 3-Stage Daily Reconciliation System */}
      {/* ======================================================== */}
      {selectedDriverForSheet && (() => {
        const stats = getDriverStats(selectedDriverForSheet.id);
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
          }}>
            <div style={{
              background: '#0f172a', color: '#f8fafc', width: '100%', maxWidth: '1150px', maxHeight: '92vh',
              borderRadius: '24px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              {/* Header Modal */}
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ background: '#8b5cf6', width: '46px', height: '46px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      تصفية اليوم: {selectedDriverForSheet.name}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                      الهاتف: {selectedDriverForSheet.phone} | التاريخ: {new Date().toLocaleDateString('ar-IQ')}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    className="btn"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '0.45rem 0.9rem', fontSize: '0.82rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handlePrintVoucher(selectedDriverForSheet)}
                  >
                    <Printer size={15} /> طباعة الوصل
                  </button>
                  <button
                    onClick={() => setSelectedDriverForSheet(null)}
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 3-Stage Segmented Control Tabs Header */}
              <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0.85rem 1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  style={{
                    borderRadius: '12px', padding: '0.55rem 1.25rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                    background: sheetStageTab === 'manifest' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                    color: sheetStageTab === 'manifest' ? '#fff' : '#94a3b8',
                    border: sheetStageTab === 'manifest' ? '1px solid #60a5fa' : '1px solid transparent'
                  }}
                  onClick={() => setSheetStageTab('manifest')}
                >
                  <FileText size={16} /> 1. قائمة الخروج 📋 ({stats.totalAssigned})
                </button>

                <button
                  className="btn"
                  style={{
                    borderRadius: '12px', padding: '0.55rem 1.25rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                    background: sheetStageTab === 'return_scan' ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                    color: sheetStageTab === 'return_scan' ? '#fff' : '#94a3b8',
                    border: sheetStageTab === 'return_scan' ? '1px solid #a78bfa' : '1px solid transparent'
                  }}
                  onClick={() => setSheetStageTab('return_scan')}
                >
                  <Zap size={16} /> 2. فحص الراجع ⚡
                </button>

                <button
                  className="btn"
                  style={{
                    borderRadius: '12px', padding: '0.55rem 1.25rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                    background: sheetStageTab === 'accounting' ? '#10b981' : 'rgba(255,255,255,0.05)',
                    color: sheetStageTab === 'accounting' ? '#fff' : '#94a3b8',
                    border: sheetStageTab === 'accounting' ? '1px solid #34d399' : '1px solid transparent'
                  }}
                  onClick={() => setSheetStageTab('accounting')}
                >
                  <DollarSign size={16} /> 3. المحاسبة 💰
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1, background: '#0f172a' }}>

                {/* Stage 1: Outbound Manifest */}
                {sheetStageTab === 'manifest' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>📋 قائمة الخروج</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>الشحنات المجهزة بقائمة الخروج قبل انطلاق المندوب</p>
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: '0.85rem', background: '#3b82f6' }} onClick={() => handlePrintManifest(selectedDriverForSheet)}>
                        <Printer size={16} /> طباعة قائمة الخروج 🖨️
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '14px', background: '#1e293b' }}>
                      <table style={{ width: '100%', fontSize: '0.85rem', margin: 0, color: '#f8fafc' }}>
                        <thead>
                          <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>ت</th>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>الباركود</th>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>المتجر</th>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>الزبون والعنوان</th>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>الهاتف</th>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>المبلغ (د.ع)</th>
                            <th style={{ color: '#94a3b8', padding: '10px' }}>التوقيع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.driverOrders.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>لا يوجد شحنات بقائمة الخروج.</td></tr>
                          ) : (
                            stats.driverOrders.map((o, idx) => (
                              <tr key={o.id} style={{ borderBottom: '1px solid #334155' }}>
                                <td style={{ padding: '10px' }}>{idx + 1}</td>
                                <td style={{ fontWeight: 800, color: '#38bdf8', padding: '10px' }}>{o.barcode}</td>
                                <td style={{ padding: '10px' }}>{o.merchantName || '—'}</td>
                                <td style={{ padding: '10px' }}><strong>{o.customerName}</strong> ({o.address})</td>
                                <td dir="ltr" style={{ textAlign: 'right', padding: '10px' }}>{o.phone}</td>
                                <td style={{ padding: '10px' }}><strong style={{ color: '#34d399' }}>{Number(o.amount).toLocaleString()}</strong></td>
                                <td style={{ color: '#64748b', padding: '10px' }}>________________</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Stage 2: Inbound Barcode Return Verification */}
                {sheetStageTab === 'return_scan' && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)', color: '#fff', borderRadius: '18px', padding: '1.5rem', border: '2px solid #8b5cf6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: '#8b5cf6', padding: '10px', borderRadius: '12px', color: '#fff' }}>
                        <Zap size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          فحص الراجع ⚡
                        </h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>امسح باركود أي طرد راجع لتدقيق دخوله للمخزن</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <form onSubmit={e => handleReturnScanSubmit(e, selectedDriverForSheet.id)}>
                          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#a7f3d0' }}>
                            امسح الباركود بالمسدس:
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              ref={returnScanInputRef}
                              type="text"
                              className="input"
                              placeholder="امسح الباركود..."
                              value={returnScanBarcode}
                              onChange={e => setReturnScanBarcode(e.target.value)}
                              style={{
                                width: '100%',
                                height: '52px',
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                background: '#0f172a',
                                color: '#38bdf8',
                                border: '2px solid #38bdf8',
                                borderRadius: '12px',
                                paddingRight: '45px'
                              }}
                            />
                            <Barcode size={24} style={{ position: 'absolute', right: '12px', top: '14px', color: '#38bdf8' }} />
                          </div>
                          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.85rem', width: '100%', height: '44px', fontWeight: 700, background: '#8b5cf6' }}>
                            تأكيد الراجع ⚡
                          </button>
                        </form>
                      </div>

                      <div style={{ background: '#0f172a', borderRadius: '12px', padding: '1rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', height: '240px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                          سجل الفحص 📋
                        </span>
                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {returnScanLogs.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '2rem' }}>
                              امسح باركود أول طرد راجع بالمسدس...
                            </div>
                          ) : (
                            returnScanLogs.map(log => (
                              <div key={log.id} style={{
                                fontSize: '0.82rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                background: log.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${log.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                color: log.success ? '#6ee7b7' : '#fca5a5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {log.success ? <Check size={14} style={{ color: '#10b981' }} /> : <X size={14} style={{ color: '#ef4444' }} />}
                                  <span>{log.text}</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.time}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 3: Financial Cash Accounting & Reconciliation */}
                {sheetStageTab === 'accounting' && (
                  <div>
                    {/* Dark Glass Breakdown Metric Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>إجمالي القيد</span>
                        <strong style={{ fontSize: '1.2rem', color: '#38bdf8', marginTop: '2px', display: 'block' }}>{stats.totalAssigned} طلب</strong>
                      </div>

                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#34d399', display: 'block', fontWeight: 600 }}>واصل 🟢</span>
                        <strong style={{ fontSize: '1.2rem', color: '#34d399', marginTop: '2px', display: 'block' }}>{stats.deliveredCount} طلب</strong>
                      </div>

                      <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#60a5fa', display: 'block', fontWeight: 600 }}>واصل جزء 📦</span>
                        <strong style={{ fontSize: '1.2rem', color: '#60a5fa', marginTop: '2px', display: 'block' }}>{stats.partialReturnedCount} طلب</strong>
                      </div>

                      <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#fbbf24', display: 'block', fontWeight: 600 }}>استبدال 🏷️</span>
                        <strong style={{ fontSize: '1.2rem', color: '#fbbf24', marginTop: '2px', display: 'block' }}>{stats.priceChangedCount + stats.replacementCount} طلب</strong>
                      </div>

                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#f87171', display: 'block', fontWeight: 600 }}>راجع 🔴</span>
                        <strong style={{ fontSize: '1.2rem', color: '#f87171', marginTop: '2px', display: 'block' }}>{stats.returnedCount + stats.damagedCount} طلب</strong>
                      </div>
                    </div>

                    <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShoppingBag size={20} style={{ color: '#38bdf8' }} /> جدول الشحنات والتسوية المباشرة:
                    </h4>

                    {/* Orders Reconciliation Table */}
                    <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '16px', background: '#1e293b' }}>
                      <table style={{ width: '100%', fontSize: '0.88rem', margin: 0, color: '#f8fafc', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                            <th style={{ padding: '12px 14px', textAlign: 'right', color: '#94a3b8' }}>الباركود</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', color: '#94a3b8' }}>الزبون والعنوان</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', color: '#94a3b8' }}>المبلغ</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', color: '#94a3b8' }}>الحالة</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', color: '#94a3b8' }}>ملاحظات التصفية</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8' }}>إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.driverOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                لا يوجد شحنات بقيد هذا المندوب.
                              </td>
                            </tr>
                          ) : (
                            stats.driverOrders.map(order => {
                              const isEditing = editingOrderId === order.id;
                              return (
                                <React.Fragment key={order.id}>
                                  <tr style={{ borderBottom: isEditing ? 'none' : '1px solid #334155', background: isEditing ? 'rgba(59, 130, 246, 0.08)' : (order.status === 'delivered' ? 'rgba(16, 185, 129, 0.04)' : 'transparent') }}>
                                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#38bdf8' }}>{order.barcode}</td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <strong style={{ color: '#fff' }}>{order.customerName}</strong>
                                      <span style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{order.address} | Tel: {order.phone}</span>
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>{Number(order.amount).toLocaleString()} د.ع</strong>
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <span className={'status-badge ' + order.status}>
                                        {order.status === 'delivered' ? 'واصل 🟢' :
                                          order.status === 'returned' ? 'راجع 🔴' :
                                            order.status === 'postponed' ? 'مؤجل 🟠' :
                                              order.status === 'assigned' ? 'مع المندوب 🚚' : order.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 14px', fontSize: '0.8rem' }}>
                                      {order.notes && <span style={{ color: '#cbd5e1', display: 'block' }}>{order.notes}</span>}
                                      {order.returnedItemsCount && order.returnedItemsCount > 0 ? (
                                        <span style={{ color: '#f87171', fontWeight: 700 }}>📦 رجوع {order.returnedItemsCount} قطعة</span>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      <button
                                        className="btn"
                                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', background: isEditing ? '#ef4444' : '#334155', color: '#fff', border: '1px solid #475569', borderRadius: '8px' }}
                                        onClick={() => {
                                          if (isEditing) {
                                            setEditingOrderId(null);
                                          } else {
                                            setEditingOrderId(order.id);
                                            setEditStatus(order.status);
                                            setEditAmount(order.amount.toString());
                                            setEditReturnedCount(order.returnedItemsCount || 0);
                                            setEditNotes(order.notes || '');
                                            setTargetDriverHandover('');
                                          }
                                        }}
                                      >
                                        {isEditing ? 'إلغاء ✕' : 'تعديل ✏️'}
                                      </button>
                                    </td>
                                  </tr>

                                  {isEditing && (
                                    <tr style={{ background: 'rgba(30, 41, 59, 0.95)', borderBottom: '1px solid #334155' }}>
                                      <td colSpan={6} style={{ padding: '1rem 1.25rem' }}>
                                        <div style={{ background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '12px', padding: '1rem' }}>
                                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: '0.75rem' }}>
                                            {'✏️ تعديل ومطابقة الشحنة [' + order.barcode + ']:'}
                                          </span>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>تعديل الحالة:</label>
                                              <select
                                                className="input"
                                                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: '#1e293b', color: '#fff', borderColor: '#475569' }}
                                                value={editStatus}
                                                onChange={e => setEditStatus(e.target.value)}
                                              >
                                                <option value="delivered">واصل 🟢</option>
                                                <option value="returned">راجع 🔴</option>
                                                <option value="postponed">مؤجل 🟠</option>
                                                <option value="damaged">تالف ⚠️</option>
                                              </select>
                                            </div>

                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>المبلغ التحصيلي (د.ع):</label>
                                              <input
                                                type="number"
                                                className="input"
                                                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: '#1e293b', color: '#fff', borderColor: '#475569' }}
                                                value={editAmount}
                                                onChange={e => setEditAmount(e.target.value)}
                                              />
                                            </div>

                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>السبب / الملاحظة:</label>
                                              <input
                                                type="text"
                                                className="input"
                                                placeholder="سبب التعديل أو التأجيل..."
                                                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: '#1e293b', color: '#fff', borderColor: '#475569' }}
                                                value={editNotes}
                                                onChange={e => setEditNotes(e.target.value)}
                                              />
                                            </div>

                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>تحويل لمندوب آخر:</label>
                                              <select
                                                className="input"
                                                style={{ width: '100%', height: '38px', fontSize: '0.82rem', background: '#1e293b', color: '#38bdf8', borderColor: '#0284c7' }}
                                                value={targetDriverHandover}
                                                onChange={e => setTargetDriverHandover(e.target.value)}
                                              >
                                                <option value="">-- احتفاظ بنفس المندوب --</option>
                                                {drivers.filter(d => d.id !== selectedDriverForSheet.id).map(d => (
                                                  <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                              </select>
                                            </div>

                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <button
                                                className="btn btn-primary"
                                                style={{ height: '38px', flex: 1, padding: '0 0.8rem', fontSize: '0.82rem', background: '#10b981', fontWeight: 700 }}
                                                onClick={() => handleSaveOrderReconciliation(order)}
                                              >
                                                حفظ 💾
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Summary Bar */}
                    <div style={{ background: '#1e293b', borderTop: '1px solid #334155', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderRadius: '0 0 14px 14px' }}>
                      <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>إجمالي الكاش المحصل:</span>
                          <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>{stats.totalCollected.toLocaleString()} د.ع</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>خصم أجور المندوب:</span>
                          <strong style={{ fontSize: '1.15rem', color: '#f87171' }}>- {stats.driverFees.toLocaleString()} د.ع</strong>
                        </div>
                        <div style={{ borderRight: '2px solid #334155', paddingRight: '1.75rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'block' }}>الصافي المسلم للشركة:</span>
                          <strong style={{ fontSize: '1.4rem', color: '#38bdf8' }}>{stats.netToCompany.toLocaleString()} د.ع</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ height: '46px', fontWeight: 700, padding: '0 1.25rem', borderRadius: '12px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: 'none', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="تثبيت الكل واصل وتصفية الحساب بنقرة واحدة"
                          onClick={async () => {
                            try {
                              const unhandled = stats.driverOrders.filter(o => o.status === 'assigned');
                              for (const order of unhandled) {
                                await api.updateStatus(order.id, 'delivered', 'تصفية سريعة بنقرة واحدة');
                              }
                              const res = await api.settleDriver(selectedDriverForSheet.id);
                              setSuccessMsg(res.message || `تمت التصفية السريعة لـ [${selectedDriverForSheet.name}] وتصفير قيده بنجاح!`);
                              setSelectedDriverForSheet(null);
                              loadData();
                            } catch (err: any) {
                              setError('فشل التصفية السريعة: ' + err.message);
                            }
                          }}
                        >
                          <Zap size={18} /> تصفية سريعة ⚡
                        </button>

                        <button
                          className="btn btn-primary"
                          style={{ height: '46px', fontWeight: 700, padding: '0 1.5rem', borderRadius: '12px', fontSize: '0.95rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={async () => {
                            try {
                              const res = await api.settleDriver(selectedDriverForSheet.id);
                              setSuccessMsg(res.message || `تمت تصفية [${selectedDriverForSheet.name}] وإغلاق حسابه اليوم بنجاح!`);
                              setSelectedDriverForSheet(null);
                              loadData();
                            } catch (err: any) {
                              setError('فشل التصفية: ' + err.message);
                            }
                          }}
                        >
                          <ShieldCheck size={20} /> إغلاق اليوم 🔒
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* 2. Modal: Printable Settlement Voucher Preview          */}
      {/* ======================================================== */}
      {printableVoucherDriver && (() => {
        const stats = getDriverStats(printableVoucherDriver.id);
        const voucherId = `VCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${printableVoucherDriver.id.substring(0, 4)}`;

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '1rem'
          }}>
            <div style={{
              background: '#fff', color: '#000', width: '100%', maxWidth: '650px', maxHeight: '90vh',
              borderRadius: '16px', padding: '2rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              overflowY: 'auto', fontFamily: 'Arial, sans-serif'
            }}>
              {/* Header */}
              <div style={{ borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#000' }}>وصل الحساب 📜</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#555' }}>شركة أكسبرس ⚡ للتوصيل السريع</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#8b5cf6' }}>{voucherId}</strong>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#666' }}>التاريخ: {new Date().toLocaleDateString('ar-IQ')}</span>
                </div>
              </div>

              {/* Driver Details Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>المندوب:</span>
                  <strong style={{ fontSize: '1.1rem' }}>{printableVoucherDriver.name}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>الهاتف:</span>
                  <strong style={{ fontSize: '1rem' }}>{printableVoucherDriver.phone}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>القيد:</span>
                  <strong style={{ fontSize: '1rem' }}>{stats.totalAssigned} شحنة</strong>
                </div>
              </div>

              {/* Financial Calculation Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'right', padding: '8px' }}>البيان المالي</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>المبلغ (د.ع)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>إجمالي الكاش المحصل ({stats.deliveredCount} واصل)</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700, color: '#10b981' }}>+ {stats.totalCollected.toLocaleString()} د.ع</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>أجور المندوب المكتسبة</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700, color: '#ef4444' }}>- {stats.driverFees.toLocaleString()} د.ع</td>
                  </tr>
                  {stats.damagedPenalties > 0 && (
                    <tr>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>خصم تالف/مفقود بقيد المندوب</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700, color: '#f59e0b' }}>+ {stats.damagedPenalties.toLocaleString()} د.ع</td>
                    </tr>
                  )}
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td style={{ padding: '10px', fontSize: '1rem' }}>الصافي المستلم للشركة</td>
                    <td style={{ padding: '10px', textAlign: 'left', fontSize: '1.2rem', color: '#1e293b' }}>{stats.netToCompany.toLocaleString()} د.ع</td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '2.5rem' }}>توقيع المحاسب</span>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '2.5rem' }}>توقيع المندوب</span>
                  <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => handlePrintVoucher(printableVoucherDriver)}
                >
                  <Printer size={18} /> طباعة الوصل 🖨️
                </button>
                <button
                  className="btn"
                  style={{ background: '#64748b', color: '#fff', padding: '0.68rem 1.5rem' }}
                  onClick={() => setPrintableVoucherDriver(null)}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
};

export default DriversList;
