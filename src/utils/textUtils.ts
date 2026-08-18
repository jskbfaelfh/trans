/**
 * تطبيق قاعدة الكلمتين الذكية (The Two-Word Rule)
 * اختصار الجمل والعناوين والأسماء الطويلة وحذف التكرار غير المفيد
 * 
 * أمثلة:
 * "كربلاء - كربلاء - كربلاء الحسينيه كربلاء الحسينيه" -> "كربلاء الحسينية"
 * "بغداد - الكرادة الشرقية داخل شارع العطار" -> "بغداد الكرادة"
 * "محمد جاسم علي الحسناوي" -> "محمد الحسناوي"
 */

export const twoWords = (text: string | null | undefined, maxWords = 2): string => {
  if (!text) return '';
  
  // تنظيف الرموز والفواصل والمسافات الزائدة
  const cleaned = text
    .replace(/[,\-_|\\/،؛:()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const rawWords = cleaned.split(' ').filter(w => w.trim().length > 0);
  
  // إزالة الكلمات المكررة
  const uniqueWords: string[] = [];
  for (const w of rawWords) {
    const lower = w.toLowerCase();
    if (!uniqueWords.some(u => u.toLowerCase() === lower)) {
      uniqueWords.push(w);
    }
  }

  if (uniqueWords.length <= maxWords) {
    return uniqueWords.join(' ');
  }

  return uniqueWords.slice(0, maxWords).join(' ');
};

/**
 * اختصار الجمل الطويلة والملاحظات مع إضافة علامة الاختصار (...)
 */
export const truncateSentence = (text: string | null | undefined, maxWords = 2): string => {
  if (!text) return '';
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(' ')}...`;
};
