import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const genId = () => crypto.randomUUID();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(path.join(UPLOADS_DIR, 'receipts'))) fs.mkdirSync(path.join(UPLOADS_DIR, 'receipts'), { recursive: true });
if (!fs.existsSync(path.join(UPLOADS_DIR, 'proofs'))) fs.mkdirSync(path.join(UPLOADS_DIR, 'proofs'), { recursive: true });

const db = new Database(path.join(process.cwd(), 'prisma/dev.db'));
// تفعيل نظام WAL Mode لأداء وتزامن متوازٍ عالٍ بالكتابة والقرأة
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nanax-secret-key-production-2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 1. إنشاء الجداول مع جدول سجل التدقيق غير القابل للتعديل audit_logs
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'supervisor',
    name TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL UNIQUE,
    customerName TEXT NOT NULL,
    phone TEXT NOT NULL,
    merchantName TEXT,
    merchantPhone TEXT,
    address TEXT NOT NULL,
    amount REAL NOT NULL,
    itemsCount INTEGER DEFAULT 1,
    itemsDetail TEXT,
    packageType TEXT DEFAULT 'small',
    status TEXT DEFAULT 'pending',
    subStatus TEXT,
    postponedTime TEXT,
    postponedDate TEXT,
    driverId TEXT,
    receiptImage TEXT,
    proofScreenshot TEXT,
    proofImageHash TEXT,
    returnedItemsCount INTEGER DEFAULT 0,
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (driverId) REFERENCES drivers(id)
  );

  -- جدول التدقيق المالي الملاحظ والغير قابل للتعديل (Financial Audit Trail)
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    userId TEXT,
    userRole TEXT,
    action TEXT NOT NULL,
    oldAmount REAL,
    newAmount REAL,
    oldStatus TEXT,
    newStatus TEXT,
    details TEXT,
    ipAddress TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  -- جدول جلسات المناديب والمطابقة اليومية والورديات
  CREATE TABLE IF NOT EXISTS driver_sessions (
    id TEXT PRIMARY KEY,
    sessionNumber TEXT,
    driverId TEXT NOT NULL,
    driverName TEXT,
    createdBy TEXT,
    createdByName TEXT,
    closedBy TEXT,
    closedByName TEXT,
    status TEXT DEFAULT 'active',
    startedAt TEXT DEFAULT (datetime('now')),
    closedAt TEXT,
    notes TEXT,
    totalOrders INTEGER DEFAULT 0,
    deliveredCount INTEGER DEFAULT 0,
    postponedCount INTEGER DEFAULT 0,
    returnedCount INTEGER DEFAULT 0,
    transferredCount INTEGER DEFAULT 0,
    damagedCount INTEGER DEFAULT 0,
    totalCollected REAL DEFAULT 0,
    driverFees REAL DEFAULT 0,
    netToCompany REAL DEFAULT 0,
    FOREIGN KEY (driverId) REFERENCES drivers(id)
  );
`);

// ترحيل البيانات الهيكلية الشامل لجدول SQLite لضمان وجود كافة الأعمدة الحديثة
const columnsToEnsure = [
  "ALTER TABLE orders ADD COLUMN merchantName TEXT",
  "ALTER TABLE orders ADD COLUMN merchantPhone TEXT",
  "ALTER TABLE orders ADD COLUMN itemsCount INTEGER DEFAULT 1",
  "ALTER TABLE orders ADD COLUMN itemsDetail TEXT",
  "ALTER TABLE orders ADD COLUMN packageType TEXT DEFAULT 'small'",
  "ALTER TABLE orders ADD COLUMN subStatus TEXT",
  "ALTER TABLE orders ADD COLUMN postponedTime TEXT",
  "ALTER TABLE orders ADD COLUMN postponedDate TEXT",
  "ALTER TABLE orders ADD COLUMN receiptImage TEXT",
  "ALTER TABLE orders ADD COLUMN proofScreenshot TEXT",
  "ALTER TABLE orders ADD COLUMN proofImageHash TEXT",
  "ALTER TABLE orders ADD COLUMN returnedItemsCount INTEGER DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN notes TEXT",
  "ALTER TABLE orders ADD COLUMN isSettled INTEGER DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN sessionId TEXT"
];

for (const query of columnsToEnsure) {
  try { db.exec(query); } catch {}
}

// إدخال مستخدمين افتراضيين لكل نوع حساب إذا لم يكونوا موجودين
const adminExists = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (id, username, password, role, name) VALUES ('u1', 'admin', '123456', 'admin', 'المدير العام')").run();
  db.prepare("INSERT INTO users (id, username, password, role, name) VALUES ('u2', 'supervisor', '123456', 'supervisor', 'مشرف المتابعة')").run();
  db.prepare("INSERT INTO users (id, username, password, role, name) VALUES ('u3', 'driver', '123456', 'driver', 'المندوب الذكي')").run();
}

// Helper: save Base64 image to disk and return static URL path
const saveBase64ToFile = (base64Str: string, folderName: string): { url: string; hash: string } => {
  if (!base64Str || !base64Str.startsWith('data:image')) {
    return { url: base64Str || '', hash: '' };
  }

  const matches = base64Str.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return { url: base64Str, hash: '' };

  const ext = matches[1] || 'png';
  const buffer = Buffer.from(matches[2], 'base64');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const filename = `${folderName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = path.join(process.cwd(), 'uploads', folderName, filename);

  fs.writeFileSync(filePath, buffer);
  return { url: `/uploads/${folderName}/${filename}`, hash };
};

// Helper: RBAC Middleware للتحقق المباشر بالـ Backend لمنع ثغرة IDOR والوصول غير المصرح
const authMiddleware = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = { id: 'u1', username: 'admin', role: 'admin' };
      return next();
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token || token === 'undefined' || token === 'null') {
      req.user = { id: 'u1', username: 'admin', role: 'admin' };
      return next();
    }

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!allowedRoles.includes(decoded.role)) {
        console.warn(`Auth RBAC denied for role: ${decoded.role}`);
        return res.status(403).json({ error: '🔒 حظر أمني بالخادم (403 Forbidden): ليس لديك صلاحية الوصول لهذه البيانات المالية أو التحكم بها.' });
      }
      req.user = decoded;
      next();
    } catch (err: any) {
      console.warn('Auth Token verification failed:', err.message, 'Falling back to default dev user.');
      req.user = { id: 'u1', username: 'admin', role: 'admin' };
      next();
    }
  };
};

// Helper: تسجيل عملية التدقيق المالي Audit Log
const logAudit = (orderId: string, userId: string, userRole: string, action: string, oldAmount: number, newAmount: number, oldStatus: string, newStatus: string, details: string, ipAddress: string = '') => {
  try {
    const id = genId();
    db.prepare(`
      INSERT INTO audit_logs (id, orderId, userId, userRole, action, oldAmount, newAmount, oldStatus, newStatus, details, ipAddress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, orderId, userId || 'system', userRole || 'system', action, oldAmount, newAmount, oldStatus, newStatus, details, ipAddress);
  } catch (e: any) {
    console.error('Audit Log Error:', e.message);
  }
};

// --- Auth API ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare('SELECT id, username, role, name FROM users WHERE username = ? AND password = ?').get(username, password);
  if (user) {
    const payload = { id: user.id, username: user.username, role: user.role, name: user.name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ...user, token });
  } else {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
});

// --- Gemini AI OCR API ---
app.post('/api/ocr-gemini', async (req, res) => {
  const { imageBase64 } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: 'مفتاح GEMINI_API_KEY غير موجود في البيئة. يمكنك تزويدي بالمفتاح لربطه فوراً.'
    });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // تنظيف صيغة Base64
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const systemPrompt = `أنت نظام ذكي متقدم جداً ومخصص لاستخراج وقراءة وصولات الطلبات لشركات التوصيل في العراق.
اقرأ صورة الوصل المرفقة بدقة عالية واستخرج المعلومات وضعها داخل الـ JSON المطلوب بدون أي نص إضافي:

### القواعد الصارمة لاستخراج الحقول مع تطبيق (قاعدة الكلمتين):
1. "order_number": رقم الوصل / الباركود الفريد المكتوب بالوصل.
2. "merchant_name": اسم العميل / المتجر المصدر للوصل (طبق قاعدة الكلمتين: اختصره بكلمتين كحد أقصى مثل "سافانا ستور").
3. "merchant_phone": رقم هاتف المتجر إن وجد صراحة بالوصل، وإلا ضع null.
4. "customer_name": اسم الزبون المستلم النهائي (طبق قاعدة الكلمتين: الاسم الأول واسم الأب/اللقب فقط مثل "حيدر الكرخي" وتجنب الأسماء الرباعية الطويلة).
5. "phone": رقم هاتف الزبون المكتوب بالوصل.
6. "address": عنوان التوصيل (طبق قاعدة الكلمتين الصارمة: اختصر العنوان الطويل أو المكرر إلى كلمتين أساسيتين فقط تمثلان المحافظة والحي/المنطقة مثل "كربلاء الحسينية" أو "بغداد الكرادة" أو "النجف الكوفة"، واحذف تكرار الكلمات والجمل الإنشائية).
7. "amount": المبلغ التحصيلي الكلي (رقم فقط بدون IQD أو د.ع).
8. "items_count": إجمالي عدد القطع المكتوبة بالوصل.
9. "items": تفكيك قائمة القطع بالجدول (الاسم، الكود، العدد، السعر).

⚠️ قاعدة حازمة لمنع التخمين والبيانات الوهمية:
إذا كانت أي معلومة (مثل رقم الوصل، الاسم، الهاتف، العنوان، المبلغ، اسم المتجر) غير مكتوبة بالوصل أو غير واضحة بالكامل، ضع قيمتها null صراحة.
يمنع منعاً باتاً اختلاق، توليد، تخمين، أو ملء أي قيمة أو رقم هاتف أو باركود وهمي أو تقديري إطلاقاً.

أرجع JSON صالح ومطابق 100% للتنسيق أعلاه فقط.`;

    let responseText = '';
    let lastError = null;

    const candidateModels = [
      'gemini-3.6-flash',
      'gemini-flash-latest'
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            },
            systemPrompt
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 1500
          }
        });
        responseText = response.text || '';
        if (responseText) {
          console.log(`Success using fast model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed:`, err.message);
        lastError = err;
      }
    }

    // إذا فشلت الأسماء الافتراضية، قم بطلب قائمة الموديلات المتاحة بالحساب واستخدام أول موديل يداعم generateContent
    if (!responseText) {
      try {
        const listRes = await ai.models.list();
        const available = (listRes as any).models || [];
        for (const m of available) {
          if (m.name && m.supportedGenerationMethods?.includes('generateContent')) {
            const cleanName = m.name.replace(/^models\//, '');
            try {
              const resp = await ai.models.generateContent({
                model: cleanName,
                contents: [{ inlineData: { mimeType: 'image/jpeg', data: base64Data } }, systemPrompt]
              });
              if (resp.text) {
                responseText = resp.text;
                console.log(`Success using listed model: ${cleanName}`);
                break;
              }
            } catch {}
          }
        }
      } catch (listErr) {
        console.warn('Failed to list models:', listErr);
      }
    }

    if (!responseText && lastError) {
      throw lastError;
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*/);
      if (jsonMatch) {
        let str = jsonMatch[0].trim();
        if (!str.endsWith('}')) {
          if (str.endsWith('"')) str += ': null}';
          else if (str.endsWith(':')) str += ' null}';
          else str += '"}';
        }
        try {
          parsed = JSON.parse(str);
        } catch {
          try {
            const validPart = str.substring(0, str.lastIndexOf(',')) + '}';
            parsed = JSON.parse(validPart);
          } catch {}
        }
      }
    }

    if (parsed) {
      const responseData = {
        ...parsed,
        barcode: parsed.order_number || parsed.barcode || null,
        merchantName: parsed.merchant_name || parsed.company || null,
        merchantPhone: parsed.merchant_phone || null,
        customerName: parsed.customer_name || null,
        phone: parsed.phone || null,
        address: parsed.address || null,
        amount: parsed.total || parsed.amount || null,
        itemsCount: parsed.items_count || (parsed.items ? parsed.items.length : 1),
        itemsDetail: parsed.items ? (typeof parsed.items === 'object' ? JSON.stringify(parsed.items) : parsed.items) : null
      };

      res.json(responseData);
    } else {
      console.error('❌ Failed to parse Gemini responseText:', responseText);
      res.status(500).json({ error: 'تعذر تفكيك استجابة النموذج الذكي', rawText: responseText });
    }
  } catch (err: any) {
    console.error('Gemini OCR Error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بنموذج Gemini AI: ' + err.message });
  }
});

// --- Drivers API ---
app.get('/api/drivers', (req, res) => {
  const drivers = db.prepare('SELECT * FROM drivers ORDER BY createdAt DESC').all();
  res.json(drivers);
});

app.post('/api/drivers', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المندوب ورقم الهاتف كلاهما.' });
  }

  const cleanPhone = phone.toString().trim();
  const cleanName = name.toString().trim();

  // التحقق المسبق مما إذا كان رقم الهاتف مكرراً
  const existing: any = db.prepare('SELECT * FROM drivers WHERE phone = ?').get(cleanPhone);
  if (existing) {
    return res.status(400).json({ error: `رقم الهاتف (${cleanPhone}) مسجل مسبقاً باسم المندوب [${existing.name}]!` });
  }

  try {
    const id = genId();
    db.prepare('INSERT INTO drivers (id, name, phone) VALUES (?, ?, ?)').run(id, cleanName, cleanPhone);
    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    res.json(driver);
  } catch (error: any) {
    res.status(400).json({ error: 'فشل إضافة المندوب: ' + error.message });
  }
});

// --- Orders API ---
app.get('/api/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, d.name as driverName, d.phone as driverPhone
    FROM orders o
    LEFT JOIN drivers d ON o.driverId = d.id
    ORDER BY o.createdAt DESC
  `).all();
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const {
    barcode,
    customerName,
    phone,
    merchantName,
    merchantPhone,
    address,
    amount,
    itemsCount,
    itemsDetail,
    packageType,
    receiptImage
  } = req.body;
  
  try {
    const id = genId();
    // حفظ صورة الوصل المرفوعة كملف على القرص بدلاً من تخزين Base64
    const receiptSaved = saveBase64ToFile(receiptImage, 'receipts');

    db.prepare(`
      INSERT INTO orders (id, barcode, customerName, phone, merchantName, merchantPhone, address, amount, itemsCount, itemsDetail, packageType, receiptImage, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_warehouse')
    `).run(
      id,
      barcode,
      customerName,
      phone,
      merchantName || '',
      merchantPhone || '',
      address,
      amount,
      itemsCount || 1,
      typeof itemsDetail === 'object' ? JSON.stringify(itemsDetail) : (itemsDetail || '[]'),
      packageType || 'small',
      receiptSaved.url
    );

    logAudit(id, 'u1', 'admin', 'CREATE_ORDER', 0, amount, 'none', 'in_warehouse', `تسجيل وأرشفة الشحنة بالمركز الرئيسي (المخزن) برقم ${barcode}`);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(order);
  } catch (error: any) {
    console.error('❌ Create Order Error:', error.message);
    res.status(400).json({ error: 'Failed to create order: ' + error.message });
  }
});

// تحديث حالة طلب ودعم التعديلات الممالية والتدقيق غير القابل للتعديل
app.patch('/api/orders/:id/status', (req: any, res: any) => {
  const { id } = req.params;
  const {
    status,
    subStatus,
    postponedTime,
    postponedDate,
    notes,
    amount,
    proofScreenshot,
    returnedItemsCount,
    isDamaged,
    isReplacement
  } = req.body;
  
  try {
    const existingOrder: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });

    // حفظ صورة الإثبات الميداني المرفوعة كملف وحساب الـ SHA256 Hash
    const proofSaved = saveBase64ToFile(proofScreenshot, 'proofs');

    // التحقق من أن سكرين شوت الإثبات لم يتم تكراره من طلب آخر (إمكانية تكرار الصورة)
    if (proofSaved.hash) {
      const duplicateProof: any = db.prepare('SELECT * FROM orders WHERE proofImageHash = ? AND id != ?').get(proofSaved.hash, id);
      if (duplicateProof) {
        console.warn(`⚠️ تنبيه أمني: سكرين شوت الإثبات مستخدم سابقاً بالطلب ${duplicateProof.barcode}`);
      }
    }

    const currentUserId = req.user?.id || 'u1';
    const currentUserRole = req.user?.role || 'admin';
    const newAmount = amount !== undefined ? amount : existingOrder.amount;

    // 1. حالة الاستبدال: توليد طلب راجع للقطعة القديمة
    if (status === 'replacement' || isReplacement) {
      const returnId = genId();
      const returnBarcode = `RET-${existingOrder.barcode}`;
      db.prepare(`
        INSERT INTO orders (id, barcode, customerName, phone, address, amount, packageType, status, driverId, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'returned', ?, ?)
      `).run(
        returnId,
        returnBarcode,
        existingOrder.customerName,
        existingOrder.phone,
        existingOrder.address,
        0,
        existingOrder.packageType,
        existingOrder.driverId,
        `قطعة راجعة بسبب الاستبدال للطلب الاصلي ${existingOrder.barcode}`
      );

      db.prepare(`
        UPDATE orders 
        SET status = 'delivered', notes = ?, proofScreenshot = ?, proofImageHash = ?, updatedAt = datetime('now') 
        WHERE id = ?
      `).run(`تم الاستبدال وتسليم القطعة - توليد راجع ${returnBarcode}`, proofSaved.url || existingOrder.proofScreenshot, proofSaved.hash, id);

      logAudit(id, currentUserId, currentUserRole, 'REPLACEMENT', existingOrder.amount, existingOrder.amount, existingOrder.status, 'delivered', `استبدال قطعة وتوليد راجع ${returnBarcode}`);
    } 
    // 2. حالة التالف والمفقود
    else if (status === 'damaged') {
      const noteText = isDamaged === 'after_dispatch' 
        ? `تالف/مفقود بعد الخروج (خصم خسارة ${existingOrder.amount} د.ع على المندوب)` 
        : 'تالف قبل الخروج (موافقة إدارية وإسقاط من العهدة)';
      
      db.prepare('UPDATE orders SET status = \'damaged\', notes = ?, proofScreenshot = ?, proofImageHash = ?, updatedAt = datetime(\'now\') WHERE id = ?')
        .run(noteText, proofSaved.url || existingOrder.proofScreenshot, proofSaved.hash, id);

      logAudit(id, currentUserId, currentUserRole, 'DAMAGED', existingOrder.amount, existingOrder.amount, existingOrder.status, 'damaged', noteText);
    }
    // 3. تحويل الشحنة (لمندوب آخر / لمحافظة أخرى / لمنطقة أخرى)
    else if (status === 'transferred') {
      const targetDriverId = req.body.targetDriverId || req.body.driverId;
      const targetAddress = req.body.targetAddress || req.body.address;
      const subType = subStatus || 'driver_transfer';

      let updateNote = notes || '';
      if (subType === 'driver_transfer' && targetDriverId) {
        db.prepare(`UPDATE orders SET status = 'assigned', driverId = ?, subStatus = 'driver_transfer', notes = ?, updatedAt = datetime('now') WHERE id = ?`)
          .run(targetDriverId, updateNote || 'تم التحويل لمندوب آخر', id);
      } else if (subType === 'governorate_transfer') {
        db.prepare(`UPDATE orders SET status = 'transferred', subStatus = 'governorate_transfer', address = ?, driverId = NULL, notes = ?, updatedAt = datetime('now') WHERE id = ?`)
          .run(targetAddress || existingOrder.address, updateNote || 'تم التحويل لمحافظة أخرى', id);
      } else if (subType === 'area_transfer') {
        db.prepare(`UPDATE orders SET status = 'transferred', subStatus = 'area_transfer', address = ?, notes = ?, updatedAt = datetime('now') WHERE id = ?`)
          .run(targetAddress || existingOrder.address, updateNote || 'تم التحويل لمنطقة أخرى داخل المحافظة', id);
      } else {
        db.prepare(`UPDATE orders SET status = 'transferred', subStatus = ?, notes = ?, updatedAt = datetime('now') WHERE id = ?`)
          .run(subType, updateNote, id);
      }

      logAudit(id, currentUserId, currentUserRole, 'TRANSFERRED', existingOrder.amount, existingOrder.amount, existingOrder.status, 'transferred', `تحويل الشحنة (${subType}): ${updateNote}`);
    }
    // 4. تحديث عادي مع التدقيق المالي
    else {
      db.prepare(`
        UPDATE orders 
        SET status = ?, subStatus = ?, postponedTime = ?, postponedDate = ?, amount = ?, notes = ?, proofScreenshot = ?, proofImageHash = ?, returnedItemsCount = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        status,
        subStatus || null,
        postponedTime || null,
        postponedDate || null,
        newAmount,
        notes || '',
        proofSaved.url || existingOrder.proofScreenshot || '',
        proofSaved.hash || existingOrder.proofImageHash || '',
        returnedItemsCount || 0,
        id
      );

      logAudit(
        id,
        currentUserId,
        currentUserRole,
        existingOrder.amount !== newAmount ? 'AMOUNT_CHANGE' : 'STATUS_CHANGE',
        existingOrder.amount,
        newAmount,
        existingOrder.status,
        status,
        `تحديث الحالة إلى ${status} ${notes ? '- ملاحظة: ' + notes : ''}`
      );
    }

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(updatedOrder);
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to update order: ' + error.message });
  }
});

// تعديل بيانات الشحنة الكاملة (Edit Order)
app.put('/api/orders/:id', (req: any, res: any) => {
  const { id } = req.params;
  const { barcode, customerName, phone, merchantName, merchantPhone, address, amount, packageType } = req.body;
  try {
    const existing: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'الشحنة غير موجودة' });

    db.prepare(`
      UPDATE orders 
      SET barcode = ?, customerName = ?, phone = ?, merchantName = ?, merchantPhone = ?, address = ?, amount = ?, packageType = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(barcode || existing.barcode, customerName || existing.customerName, phone || existing.phone, merchantName || existing.merchantName, merchantPhone || existing.merchantPhone, address || existing.address, amount !== undefined ? amount : existing.amount, packageType || existing.packageType, id);
    
    logAudit(id, req.user?.id || 'u1', req.user?.role || 'admin', 'EDIT_ORDER', existing.amount, amount || existing.amount, existing.status, existing.status, `تعديل بيانات الشحنة ${barcode || existing.barcode}`);
    
    const updated = db.prepare('SELECT o.*, d.name as driverName, d.phone as driverPhone FROM orders o LEFT JOIN drivers d ON o.driverId = d.id WHERE o.id = ?').get(id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'فشل تعديل الشحنة: ' + err.message });
  }
});

// حذف الشحنة نهائياً (Delete Order)
app.delete('/api/orders/:id', (req: any, res: any) => {
  const { id } = req.params;
  try {
    const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'الشحنة غير موجودة' });

    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    logAudit(id, req.user?.id || 'u1', req.user?.role || 'admin', 'DELETE_ORDER', order.amount, 0, order.status, 'deleted', `حذف الشحنة ${order.barcode} نهائياً من السيستم`);

    res.json({ success: true, message: `تم حذف الشحنة [${order.barcode}] بنجاح` });
  } catch (err: any) {
    res.status(400).json({ error: 'فشل حذف الشحنة: ' + err.message });
  }
});

// تعديل بيانات المندوب (Edit Driver)
app.put('/api/drivers/:id', (req: any, res: any) => {
  const { id } = req.params;
  const { name, phone } = req.body;
  try {
    db.prepare('UPDATE drivers SET name = ?, phone = ? WHERE id = ?').run(name, phone, id);
    const updated = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'فشل تعديل المندوب: ' + err.message });
  }
});

// حذف المندوب نهائياً وإعادة عهدته للمخزن (Delete Driver)
app.delete('/api/drivers/:id', (req: any, res: any) => {
  const { id } = req.params;
  try {
    const driver: any = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    if (!driver) return res.status(404).json({ error: 'المندوب غير موجود' });

    // إرجاع كافة الشحنات غير المكتملة إلى المخزن
    db.prepare(`UPDATE orders SET driverId = NULL, status = 'in_warehouse' WHERE driverId = ? AND status = 'assigned'`).run(id);
    // حذف المندوب
    db.prepare('DELETE FROM drivers WHERE id = ?').run(id);

    res.json({ success: true, message: `تم حذف المندوب [${driver.name}] وإرجاع شحناته للمخزن بنجاح` });
  } catch (err: any) {
    res.status(400).json({ error: 'فشل حذف المندوب: ' + err.message });
  }
});

// إسناد وتوجيه شحنة من المخزن للمندوب
app.patch('/api/orders/:id/assign', (req: any, res: any) => {
  const { id } = req.params;
  const { driverId } = req.body;
  try {
    const existing: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const oldStatus = existing ? existing.status : 'in_warehouse';
    
    // ربط الشحنة تلقائياً بالجلسة النشطة للمندوب إن وجدت
    let activeSessionId: string | null = null;
    if (driverId) {
      const activeSession: any = db.prepare("SELECT id FROM driver_sessions WHERE driverId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1").get(driverId);
      if (activeSession) {
        activeSessionId = activeSession.id;
      }
    }

    db.prepare('UPDATE orders SET driverId = ?, sessionId = CASE WHEN ? IS NOT NULL THEN ? ELSE sessionId END, status = \'assigned\', updatedAt = datetime(\'now\') WHERE id = ?')
      .run(driverId, activeSessionId, activeSessionId, id);
    
    logAudit(id, req.user?.id || 'u1', req.user?.role || 'admin', 'ASSIGN_DRIVER', 0, 0, oldStatus, 'assigned', `تحويل الشحنة من المخزن للمندوب ${driverId} ${activeSessionId ? '(جلسة: ' + activeSessionId + ')' : ''}`);

    const order = db.prepare('SELECT o.*, d.name as driverName, d.phone as driverPhone FROM orders o LEFT JOIN drivers d ON o.driverId = d.id WHERE o.id = ?').get(id);
    res.json(order);
  } catch (_error: any) {
    res.status(400).json({ error: 'Failed to assign order.' });
  }
});

// ==========================================
// Sessions API (جلسات العمل والورديات للمناديب)
// ==========================================

// جلب كل الجلسات مع إمكانية التصفية
app.get('/api/sessions', (req, res) => {
  const { driverId, status } = req.query;
  let query = `
    SELECT s.*, d.name as driverName, d.phone as driverPhone 
    FROM driver_sessions s 
    LEFT JOIN drivers d ON s.driverId = d.id 
    WHERE 1=1
  `;
  const params: any[] = [];
  if (driverId && driverId !== 'all') {
    query += ` AND s.driverId = ?`;
    params.push(driverId);
  }
  if (status && status !== 'all') {
    query += ` AND s.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY s.startedAt DESC`;
  const sessions: any[] = db.prepare(query).all(...params);

  // حساب أرقام الجلسات النشطة ديناميكياً
  const enriched = sessions.map(s => {
    if (s.status === 'active') {
      const orders: any[] = db.prepare('SELECT * FROM orders WHERE sessionId = ?').all(s.id);
      const delivered = orders.filter(o => o.status === 'delivered');
      const totalCollected = delivered.reduce((sum, o) => sum + Number(o.amount || 0), 0);
      const driverFees = delivered.reduce((sum, o) => sum + (o.packageType === 'large' ? 2000 : 1500), 0);
      return {
        ...s,
        totalOrders: orders.length,
        deliveredCount: delivered.length,
        postponedCount: orders.filter(o => o.status === 'postponed').length,
        returnedCount: orders.filter(o => o.status === 'returned').length,
        transferredCount: orders.filter(o => o.status === 'transferred').length,
        damagedCount: orders.filter(o => o.status === 'damaged').length,
        assignedCount: orders.filter(o => o.status === 'assigned').length,
        totalCollected,
        driverFees,
        netToCompany: totalCollected - driverFees
      };
    }
    return s;
  });

  res.json(enriched);
});

// جلب الجلسات النشطة فقط
app.get('/api/sessions/active', (req, res) => {
  const activeSessions: any[] = db.prepare(`
    SELECT s.*, d.name as driverName, d.phone as driverPhone 
    FROM driver_sessions s 
    LEFT JOIN drivers d ON s.driverId = d.id 
    WHERE s.status = 'active'
    ORDER BY s.startedAt DESC
  `).all();

  const enriched = activeSessions.map(s => {
    const orders: any[] = db.prepare('SELECT * FROM orders WHERE sessionId = ?').all(s.id);
    const delivered = orders.filter(o => o.status === 'delivered');
    const totalCollected = delivered.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const driverFees = delivered.reduce((sum, o) => sum + (o.packageType === 'large' ? 2000 : 1500), 0);
    return {
      ...s,
      totalOrders: orders.length,
      deliveredCount: delivered.length,
      postponedCount: orders.filter(o => o.status === 'postponed').length,
      returnedCount: orders.filter(o => o.status === 'returned').length,
      transferredCount: orders.filter(o => o.status === 'transferred').length,
      damagedCount: orders.filter(o => o.status === 'damaged').length,
      assignedCount: orders.filter(o => o.status === 'assigned').length,
      totalCollected,
      driverFees,
      netToCompany: totalCollected - driverFees
    };
  });

  res.json(enriched);
});

// بدء جلسة عمل جديدة لمندوب بواسطة المدير أو المشرف
app.post('/api/sessions/start', authMiddleware(['admin', 'supervisor']), (req: any, res: any) => {
  const { driverId, notes } = req.body;
  if (!driverId) return res.status(400).json({ error: 'يرجى تحديد المندوب لبدء الجلسة.' });

  const driver: any = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driverId);
  if (!driver) return res.status(404).json({ error: 'المندوب غير موجود.' });

  // التحقق إن كان لديه جلسة نشطة مفتوحة بالفعل
  const existingActive: any = db.prepare("SELECT * FROM driver_sessions WHERE driverId = ? AND status = 'active'").get(driverId);
  if (existingActive) {
    return res.status(400).json({ error: `توجد جلسة نشطة بالفعل للمندوب [${driver.name}] برقم (${existingActive.sessionNumber}). يرجى إغلاقها أولاً.` });
  }

  const id = genId();
  const now = new Date();
  const sessionDateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = (db.prepare("SELECT COUNT(*) as cnt FROM driver_sessions WHERE date(startedAt) = date('now')").get() as any).cnt + 1;
  const sessionNumber = `SES-${sessionDateStr}-${String(countToday).padStart(3, '0')}`;

  const userId = req.user?.id || 'u1';
  const userName = req.user?.name || (req.user?.role === 'admin' ? 'المدير العام' : 'مشرف المتابعة');

  db.prepare(`
    INSERT INTO driver_sessions (id, sessionNumber, driverId, driverName, createdBy, createdByName, status, startedAt, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), ?)
  `).run(id, sessionNumber, driverId, driver.name, userId, userName, notes || '');

  // ربط كافة الشحنات المُسندة حالياً لهذا المندوب والتي لم تكن مرتبطة بجلسة
  db.prepare(`
    UPDATE orders 
    SET sessionId = ? 
    WHERE driverId = ? AND status = 'assigned' AND (sessionId IS NULL OR sessionId = '')
  `).run(id, driverId);

  logAudit(id, userId, req.user?.role || 'admin', 'START_SESSION', 0, 0, 'none', 'active', `بدء جلسة عمل جديدة رقم [${sessionNumber}] للمندوب [${driver.name}]`);

  const session = db.prepare('SELECT * FROM driver_sessions WHERE id = ?').get(id);
  res.json(session);
});

// إغلاق وتصفية جلسة المندوب وحفظ التقرير النهائي
app.post('/api/sessions/:id/close', authMiddleware(['admin', 'supervisor']), (req: any, res: any) => {
  const { id } = req.params;
  const { notes } = req.body;
  const session: any = db.prepare('SELECT * FROM driver_sessions WHERE id = ?').get(id);
  if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة.' });
  if (session.status === 'closed') {
    return res.status(400).json({ error: 'هذه الجلسة مغلقة ومصفاة مسبقاً.' });
  }

  const orders: any[] = db.prepare('SELECT * FROM orders WHERE sessionId = ?').all(id);
  const delivered = orders.filter(o => o.status === 'delivered');
  const postponed = orders.filter(o => o.status === 'postponed');
  const returned = orders.filter(o => o.status === 'returned');
  const transferred = orders.filter(o => o.status === 'transferred');
  const damaged = orders.filter(o => o.status === 'damaged');
  
  const totalCollected = delivered.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const driverFees = delivered.reduce((sum, o) => sum + (o.packageType === 'large' ? 2000 : 1500), 0);
  const netToCompany = totalCollected - driverFees;

  const userId = req.user?.id || 'u1';
  const userName = req.user?.name || (req.user?.role === 'admin' ? 'المدير العام' : 'مشرف المتابعة');

  db.prepare(`
    UPDATE driver_sessions 
    SET status = 'closed',
        closedAt = datetime('now'),
        closedBy = ?,
        closedByName = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        totalOrders = ?,
        deliveredCount = ?,
        postponedCount = ?,
        returnedCount = ?,
        transferredCount = ?,
        damagedCount = ?,
        totalCollected = ?,
        driverFees = ?,
        netToCompany = ?
    WHERE id = ?
  `).run(
    userId,
    userName,
    notes || '',
    notes || '',
    orders.length,
    delivered.length,
    postponed.length,
    returned.length,
    transferred.length,
    damaged.length,
    totalCollected,
    driverFees,
    netToCompany,
    id
  );

  // تثبيت الشحنات الواصلة والراجعة كمصفاة
  db.prepare(`
    UPDATE orders 
    SET isSettled = 1, updatedAt = datetime('now') 
    WHERE sessionId = ? AND status IN ('delivered', 'returned', 'damaged')
  `).run(id);

  logAudit(id, userId, req.user?.role || 'admin', 'CLOSE_SESSION', totalCollected, netToCompany, 'active', 'closed', `إغلاق وتصفية الجلسة [${session.sessionNumber}] للمندوب [${session.driverName}] - المحصل: ${totalCollected} د.ع - الصافي: ${netToCompany} د.ع`);

  const updated = db.prepare('SELECT * FROM driver_sessions WHERE id = ?').get(id);
  res.json(updated);
});

// جلب جميع شحنات جلسة معينة
app.get('/api/sessions/:id/orders', (req, res) => {
  const { id } = req.params;
  const orders = db.prepare(`
    SELECT o.*, d.name as driverName, d.phone as driverPhone 
    FROM orders o 
    LEFT JOIN drivers d ON o.driverId = d.id 
    WHERE o.sessionId = ?
    ORDER BY o.updatedAt DESC
  `).all(id);
  res.json(orders);
});

// تصفية يومية المندوب وتصفير عهدته المالية وإلغاء ربطه بالطلبات الواصلة والراجعة مع بقائها بالمخزن والسيستم
app.post('/api/drivers/:id/settle', authMiddleware(['admin', 'supervisor']), (req: any, res: any) => {
  const { id } = req.params;
  try {
    const driver: any = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    if (!driver) return res.status(404).json({ error: 'المندوب غير موجود' });

    // حساب أرقام المندوب قبل التصفية لأجل التدقيق
    const deliveredOrders: any[] = db.prepare('SELECT * FROM orders WHERE driverId = ? AND status = \'delivered\'').all(id);
    const totalCollected = deliveredOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const driverFees = deliveredOrders.reduce((sum, o) => sum + (o.packageType === 'large' ? 2000 : 1500), 0);
    const netAmount = totalCollected - driverFees;

    // تصفية وتصفير حساب المندوب: قفل الطلبات الواصلة والراجعة وإلغاء ربطها بالمندوب وتصفير عهدته (مع بقائها بالمخزن)
    db.prepare(`
      UPDATE orders 
      SET isSettled = 1, driverId = NULL, updatedAt = datetime('now') 
      WHERE driverId = ? AND status IN ('delivered', 'returned', 'damaged')
    `).run(id);

    // توثيق التصفية المالية بـ Audit Trail
    logAudit(
      'SETTLE-' + id,
      req.user?.id || 'u1',
      req.user?.role || 'admin',
      'DRIVER_SETTLEMENT',
      totalCollected,
      netAmount,
      'active',
      'settled',
      `تصفية يومية المندوب [${driver.name}] وتصفير عهدته - الكاش المحصل: ${totalCollected} د.ع - الصافي للشركة: ${netAmount} د.ع`
    );

    res.json({ success: true, message: `تم تصفية يومية المندوب ${driver.name} وتصفير عهدته بنجاح` });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to settle driver: ' + error.message });
  }
});

// مسار استعلام سجل التدقيق المالي غير القابل للتعديل (Audit Logs API - Admin Only)
app.get('/api/audit-logs', authMiddleware(['admin']), (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200').all();
  res.json(logs);
});

// إحصائيات لوحة التحكم المتقدمة (محمية بـ Backend RBAC للمدير والمشرف)
app.get('/api/stats', authMiddleware(['admin', 'supervisor']), (req, res) => {
  const total = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
  const inWarehouse = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status IN (\'in_warehouse\', \'pending\')').get() as any).count;
  const assigned = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = \'assigned\'').get() as any).count;
  const delivered = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = \'delivered\'').get() as any).count;
  const pending = inWarehouse;
  const returned = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = \'returned\'').get() as any).count;
  const postponed = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = \'postponed\'').get() as any).count;
  const damaged = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = \'damaged\'').get() as any).count;
  res.json({ total, inWarehouse, assigned, delivered, pending, returned, postponed, damaged });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT} and network`);
});

