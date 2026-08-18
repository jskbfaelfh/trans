const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(process.cwd(), 'prisma/dev.db'));

const driverId = 'yi35u16xmsntg8mc'; // حسين لفته
let activeSession = db.prepare("SELECT * FROM driver_sessions WHERE driverId = ? AND status = 'active'").get(driverId);

if (!activeSession) {
  const sessionId = crypto.randomUUID();
  const sessionNumber = 'SES-20260814-001';
  db.prepare(`
    INSERT INTO driver_sessions (id, sessionNumber, driverId, driverName, createdBy, createdByName, status, startedAt, notes)
    VALUES (?, ?, ?, ?, 'u1', 'المدير العام', 'active', datetime('now'), 'جلسة التوزيع والتحصيل الميداني الشامل')
  `).run(sessionId, sessionNumber, driverId, 'حسين لفته');
  activeSession = { id: sessionId, sessionNumber };
}

const sampleOrders = [
  {
    id: crypto.randomUUID(),
    barcode: 'EXP-KRB-8821',
    customerName: 'حيدر الكرخي',
    phone: '07801234567',
    merchantName: 'متجر الأناقة للملابس',
    merchantPhone: '07712345678',
    address: 'كربلاء - حي الحسين - قرب جامع أهل البيت',
    amount: 35000,
    packageType: 'small',
    status: 'assigned',
    driverId: driverId,
    sessionId: activeSession.id
  },
  {
    id: crypto.randomUUID(),
    barcode: 'EXP-KRB-8822',
    customerName: 'فاطمة الموسوي',
    phone: '07709876543',
    merchantName: 'براند كوزمتك بغداد',
    merchantPhone: '07812341234',
    address: 'كربلاء - حي المعلمين - فرع أسواق الهدى',
    amount: 48000,
    packageType: 'small',
    status: 'assigned',
    driverId: driverId,
    sessionId: activeSession.id
  },
  {
    id: crypto.randomUUID(),
    barcode: 'EXP-KRB-8823',
    customerName: 'محمد جاسم الحسناوي',
    phone: '07505556677',
    merchantName: 'الكترونيات المستقبل',
    merchantPhone: '07700011223',
    address: 'كربلاء - منطقة العباسية الغربية - عمارة النور',
    amount: 95000,
    packageType: 'large',
    status: 'assigned',
    driverId: driverId,
    sessionId: activeSession.id
  },
  {
    id: crypto.randomUUID(),
    barcode: 'EXP-KRB-8824',
    customerName: 'أحمد علي الشمري',
    phone: '07809998811',
    merchantName: 'ساعة وشياكة',
    merchantPhone: '07722233445',
    address: 'كربلاء - الإسكان - مجاور صيدلية الشفاء',
    amount: 22000,
    packageType: 'small',
    status: 'assigned',
    driverId: driverId,
    sessionId: activeSession.id
  },
  {
    id: crypto.randomUUID(),
    barcode: 'EXP-KRB-8825',
    customerName: 'زينب الرماحي',
    phone: '07718882233',
    merchantName: 'بوتيك شمس الفخامة',
    merchantPhone: '07833344556',
    address: 'كربلاء - حي رمضان - شارع المدارس',
    amount: 60000,
    packageType: 'small',
    status: 'assigned',
    driverId: driverId,
    sessionId: activeSession.id
  }
];

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO orders (id, barcode, customerName, phone, merchantName, merchantPhone, address, amount, packageType, status, driverId, sessionId, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

for (const o of sampleOrders) {
  insertStmt.run(o.id, o.barcode, o.customerName, o.phone, o.merchantName, o.merchantPhone, o.address, o.amount, o.packageType, o.status, o.driverId, o.sessionId);
}

console.log('Successfully populated active session:', activeSession.sessionNumber, 'with', sampleOrders.length, 'orders!');
