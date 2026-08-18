import React, { useState } from 'react';
import { Upload, Scan, CheckCircle2, AlertCircle, Sparkles, UserCheck, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';
import type { Driver } from '../services/api';
import { twoWords } from '../utils/textUtils';

interface SmartScanProps {
  drivers: Driver[];
  onOrderCreated: () => void;
}

const SmartScan: React.FC<SmartScanProps> = ({ drivers, onOrderCreated }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState({
    barcode: '',
    merchantName: '',
    merchantPhone: '',
    customerName: '',
    phone: '',
    address: '',
    amount: '',
    itemsCount: 1,
    itemsDetail: [] as any[],
    packageType: 'small' as 'small' | 'large'
  });
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ضغط تسريع الصورة قبل رفعها لقراءة الـ OCR
  const compressImageForOCR = (dataUrl: string, maxDimension = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // اختيار صورة أو سحبها
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawData = reader.result as string;
        setImagePreview(rawData);
        const compressedData = await compressImageForOCR(rawData);
        simulateOCRScan(compressedData);
      };
      reader.readAsDataURL(file);
    }
  };

  // قراءة ضوئية حقيقية بنموذج Gemini AI الفائق من جوجل مع تطبيق قاعدة الكلمتين
  const simulateOCRScan = async (imageData: string) => {
    setIsScanning(true);
    setStatusMessage(null);

    try {
      // 1. تجربة النموذج الفائق Gemini AI أولاً
      const geminiResult: any = await api.ocrGemini(imageData);
      const rawCustName = geminiResult.customerName || geminiResult.customer_name || '';
      const rawAddress = geminiResult.address || '';
      const rawMerchant = geminiResult.merchantName || geminiResult.merchant_name || '';

      setExtractedData({
        barcode: geminiResult.barcode || geminiResult.order_number || '',
        merchantName: twoWords(rawMerchant, 2) || rawMerchant,
        merchantPhone: geminiResult.merchantPhone || geminiResult.merchant_phone || '',
        customerName: twoWords(rawCustName, 2) || rawCustName,
        phone: geminiResult.phone || '',
        address: twoWords(rawAddress, 2) || rawAddress,
        amount: geminiResult.amount !== null && geminiResult.amount !== undefined ? geminiResult.amount.toString() : '',
        itemsCount: geminiResult.itemsCount || (geminiResult.items ? geminiResult.items.length : 1),
        itemsDetail: geminiResult.items || [],
        packageType: 'small'
      });

      setIsScanning(false);
      setStatusMessage({ type: 'success', text: '✨ تمت قراءة الوصل وتطبيق (قاعدة الكلمتين) لاختصار العناوين والأسماء بدقة!' });
    } catch (geminiError: any) {
      console.warn('Gemini OCR unavailable, falling back to local Tesseract:', geminiError.message);

      // 2. المحرك الاحتياطي المحلي Tesseract.js في حال غياب المفتاح
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('ara+eng');
        const ret = await worker.recognize(imageData);
        const text = ret.data.text;
        await worker.terminate();

        const phoneMatch = text.match(/(07\d{9})/);
        const amountMatch = text.match(/(\d{2,3}[,.\s]?000)/);
        const barcodeMatch = text.match(/([A-Z0-9]{4,12})/i);
        const lines = text.split('\n').filter(l => l.trim().length > 0);

        setExtractedData({
          barcode: barcodeMatch ? barcodeMatch[0] : '',
          merchantName: '',
          merchantPhone: '',
          customerName: twoWords(lines[0] || '', 2),
          phone: phoneMatch ? phoneMatch[0] : '',
          address: twoWords(lines[1] || '', 2),
          amount: amountMatch ? amountMatch[0].replace(/[,.\s]/g, '') : '',
          itemsCount: 1,
          itemsDetail: [],
          packageType: 'small'
        });

        setIsScanning(false);
        setStatusMessage({
          type: 'success',
          text: `تمت القراءة بالمحرك المحلي. (${geminiError.message})`
        });
      } catch (err: any) {
        setIsScanning(false);
        setStatusMessage({ type: 'error', text: 'تعذر التحليل التلقائي، يمكنك إدخال البيانات يدوياً' });
      }
    }
  };

  const handleSaveAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedData.barcode || !extractedData.customerName || !extractedData.phone) {
      setStatusMessage({ type: 'error', text: 'يرجى التأكد من استخراج أو إدخال البيانات الأساسية' });
      return;
    }

    try {
      // 1. إنشاء الطلب وأرشفة صورة الوصل الممسوح بجميع الحقول
      const newOrder = await api.createOrder({
        barcode: extractedData.barcode,
        customerName: extractedData.customerName,
        phone: extractedData.phone,
        merchantName: extractedData.merchantName,
        merchantPhone: extractedData.merchantPhone,
        address: extractedData.address,
        amount: parseFloat(extractedData.amount) || 0,
        itemsCount: extractedData.itemsCount,
        itemsDetail: extractedData.itemsDetail,
        packageType: extractedData.packageType,
        receiptImage: imagePreview || ''
      });

      // 2. إسناد للمندوب إذا تم اختياره
      if (selectedDriverId && newOrder.id) {
        await api.assignOrder(newOrder.id, selectedDriverId);
        setStatusMessage({ type: 'success', text: 'تم أرشفة الوصل وقراءة التفاصيل وتعيين المندوب بنجاح! 🚚' });
      } else {
        setStatusMessage({ type: 'success', text: 'تم أرشفة الوصل وقراءة التفاصيل وتسجيل الشحنة بالمخزن بنجاح! 🏬' });
      }
      
      // تفريغ الشاشة
      setImagePreview(null);
      setExtractedData({
        barcode: '',
        merchantName: '',
        merchantPhone: '',
        customerName: '',
        phone: '',
        address: '',
        amount: '',
        itemsCount: 1,
        itemsDetail: [],
        packageType: 'small'
      });
      setSelectedDriverId('');
      onOrderCreated();

    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ الطلب' });
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>قراءة الوصل 📸</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>رفع وتحليل ⚡</p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`alert ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.25rem' }}>
        {/* رفع وعرض صورة الوصل */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label className="upload-box" style={{
            border: '2px dashed var(--primary-color)',
            borderRadius: '16px',
            padding: '1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'var(--bg-secondary)',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '340px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            
            {imagePreview ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <img src={imagePreview} alt="Receipt preview" style={{ maxHeight: '310px', width: '100%', borderRadius: '10px', objectFit: 'contain' }} />
                {isScanning && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.85)', borderRadius: '10px', backdropFilter: 'blur(4px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff'
                  }}>
                    <Scan className="spin-animation" size={48} style={{ color: '#38bdf8' }} />
                    <p style={{ marginTop: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>جاري القراءة ⚡</p>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>استخراج البيانات 📋</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                  <Upload size={32} />
                </div>
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem' }}>رفع صورة 📷</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>اختر ملف 📂</p>
              </>
            )}
          </label>
        </div>

        {/* نموذج الـ Template المستخرج المعتمد */}
        <form onSubmit={handleSaveAndAssign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)', display: 'block', marginBottom: '0.75rem' }}>
              البيانات المستخرجة 📋
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>رقم الوصل (الباركود)</label>
                <input
                  type="text"
                  className="input"
                  value={extractedData.barcode}
                  onChange={e => setExtractedData({ ...extractedData, barcode: e.target.value })}
                  placeholder="EXP-XXXXX"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>المبلغ الكلي (د.ع)</label>
                <input
                  type="number"
                  className="input"
                  value={extractedData.amount}
                  onChange={e => setExtractedData({ ...extractedData, amount: e.target.value })}
                  placeholder="25000"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>عدد القطع</label>
                <input
                  type="number"
                  className="input"
                  value={extractedData.itemsCount}
                  onChange={e => setExtractedData({ ...extractedData, itemsCount: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  required
                />
              </div>
            </div>

            {/* بيانات المتجر والعميل الاصلي */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent-color)' }}>اسم العميل (صاحب المتجر)</label>
                <input
                  type="text"
                  className="input"
                  value={extractedData.merchantName}
                  onChange={e => setExtractedData({ ...extractedData, merchantName: e.target.value })}
                  placeholder="اسم البيج / المتجر"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent-color)' }}>هاتف المتجر</label>
                <input
                  type="text"
                  className="input"
                  value={extractedData.merchantPhone}
                  onChange={e => setExtractedData({ ...extractedData, merchantPhone: e.target.value })}
                  placeholder="07XXXXXXXXX"
                />
              </div>
            </div>

            {/* بيانات الزبون المستلم */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>اسم الزبون المستلم</label>
                <input
                  type="text"
                  className="input"
                  value={extractedData.customerName}
                  onChange={e => setExtractedData({ ...extractedData, customerName: e.target.value })}
                  placeholder="الاسم الكامل"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>هاتف الزبون</label>
                <input
                  type="text"
                  className="input"
                  value={extractedData.phone}
                  onChange={e => setExtractedData({ ...extractedData, phone: e.target.value })}
                  placeholder="077XXXXXXXX"
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>عنوان التوصيل التفصيلي</label>
              <input
                type="text"
                className="input"
                value={extractedData.address}
                onChange={e => setExtractedData({ ...extractedData, address: e.target.value })}
                placeholder="المحافظة - المنطقة - نقطة دالة"
                required
              />
            </div>
          </div>

          {/* تفكيك قطع الطلب والـ Item Codes */}
          {extractedData.itemsDetail && extractedData.itemsDetail.length > 0 && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '0.35rem' }}>
                📦 مصفوفة القطع المسجلة:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {extractedData.itemsDetail.map((item: any, idx: number) => (
                  <div key={idx} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                    <span>• {item.name || `قطعة ${idx + 1}`} {item.code ? `(كود: ${item.code})` : ''}</span>
                    <strong>العدد: {item.quantity || 1} {item.price ? `| السعر: ${item.price} د.ع` : ''}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* نوع الشحنة والمندوب */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>نوع الشحنة (الأجور):</label>
              <select
                className="input"
                value={extractedData.packageType}
                onChange={e => setExtractedData({ ...extractedData, packageType: e.target.value as any })}
              >
                <option value="small">📦 صغيرة (أجور المندوب: 1,500 د.ع)</option>
                <option value="large">📦 كبيرة (أجور المندوب: 2,000 د.ع)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent-color)' }}>
                <UserCheck size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} />
                إسناد مباشر إلى المندوب:
              </label>
              <select
                className="input"
                value={selectedDriverId}
                onChange={e => setSelectedDriverId(e.target.value)}
              >
                <option value="">-- الأرشفة بالمخزن الرئيسي (تحويل لاحقاً) --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem', width: '100%', height: '44px', borderRadius: '10px', fontWeight: 700 }} disabled={isScanning}>
            <ImageIcon size={18} />
            حفظ الوصل وأرشفة الشحنة بالمخزن الرئيسي 🏬
          </button>
        </form>
      </div>
    </div>
  );
};

export default SmartScan;
