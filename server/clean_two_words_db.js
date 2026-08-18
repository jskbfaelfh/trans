const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.cwd(), 'prisma/dev.db'));

const twoWords = (text, maxWords = 2) => {
  if (!text) return '';
  const cleaned = text
    .replace(/[,\-_|\\/،؛:()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const rawWords = cleaned.split(' ').filter(w => w.trim().length > 0);
  const uniqueWords = [];
  for (const w of rawWords) {
    const lower = w.toLowerCase();
    if (!uniqueWords.some(u => u.toLowerCase() === lower)) {
      uniqueWords.push(w);
    }
  }
  return uniqueWords.slice(0, maxWords).join(' ');
};

const orders = db.prepare('SELECT id, address, customerName FROM orders').all();
const updateStmt = db.prepare('UPDATE orders SET address = ?, customerName = ? WHERE id = ?');

for (const o of orders) {
  const shortAddress = twoWords(o.address, 2);
  const shortName = twoWords(o.customerName, 2);
  updateStmt.run(shortAddress || o.address, shortName || o.customerName, o.id);
}

console.log('Cleaned all orders with the Two-Word Rule successfully!');
