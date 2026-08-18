const API_HOST = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const API_BASE = `http://${API_HOST}:3000/api`;

export interface OrderItem {
  name?: string;
  code?: string;
  quantity?: number;
  price?: number;
}

export interface Order {
  id: string;
  barcode: string;
  customerName: string;
  phone: string;
  merchantName?: string;
  merchantPhone?: string;
  address: string;
  amount: number;
  itemsCount?: number;
  itemsDetail?: string | OrderItem[];
  packageType?: 'large' | 'small'; // large = 2000, small = 1500
  status: string;
  subStatus?: string; // 'postponed_tonight', 'postponed_tomorrow', 'postponed_date', 'no_answer', 'closed'
  postponedTime?: string;
  postponedDate?: string;
  driverId?: string;
  driverName?: string;
  receiptImage?: string;
  proofScreenshot?: string;
  returnedItemsCount?: number;
  notes?: string;
  sessionId?: string;
  createdAt: string;
}

export interface DriverSession {
  id: string;
  sessionNumber: string;
  driverId: string;
  driverName?: string;
  driverPhone?: string;
  createdBy?: string;
  createdByName?: string;
  closedBy?: string;
  closedByName?: string;
  status: 'active' | 'closed';
  startedAt: string;
  closedAt?: string;
  notes?: string;
  totalOrders?: number;
  deliveredCount?: number;
  postponedCount?: number;
  returnedCount?: number;
  transferredCount?: number;
  damagedCount?: number;
  assignedCount?: number;
  totalCollected?: number;
  driverFees?: number;
  netToCompany?: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  isActive: number;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'driver';
  name: string;
}

export interface Stats {
  total: number;
  inWarehouse?: number;
  assigned?: number;
  delivered: number;
  pending: number;
  returned: number;
  postponed: number;
  damaged?: number;
}

const getAuthHeaders = (): Record<string, string> => {
  const userStr = localStorage.getItem('nanax_user');
  if (!userStr) return {};
  try {
    const parsed = JSON.parse(userStr);
    if (parsed && parsed.token && parsed.token !== 'undefined' && parsed.token !== 'null' && parsed.token.trim() !== '') {
      return { Authorization: `Bearer ${parsed.token}` };
    }
  } catch {}
  return {};
};

export const api = {
  // Orders
  getOrders: async (): Promise<Order[]> => {
    const res = await fetch(`${API_BASE}/orders`);
    return res.json();
  },

  createOrder: async (data: Omit<Order, 'id' | 'status' | 'createdAt'>): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.error || 'فشل في إنشاء حفظ الطلب بالخادم');
    }
    return resData;
  },

  updateStatus: async (
    id: string,
    status: string,
    notes?: string,
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
  ): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        status,
        notes,
        ...extraData,
      }),
    });
    return res.json();
  },

  assignOrder: async (id: string, driverId: string): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ driverId }),
    });
    return res.json();
  },

  updateOrder: async (id: string, data: Partial<Order>): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'فشل تحديث الشحنة');
    return resData;
  },

  deleteOrder: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'فشل حذف الشحنة');
    return resData;
  },

  // Drivers
  getDrivers: async (): Promise<Driver[]> => {
    const res = await fetch(`${API_BASE}/drivers`);
    return res.json();
  },

  createDriver: async (name: string, phone: string): Promise<Driver> => {
    const res = await fetch(`${API_BASE}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'فشل إضافة المندوب.');
    }
    return data;
  },

  updateDriver: async (id: string, name: string, phone: string): Promise<Driver> => {
    const res = await fetch(`${API_BASE}/drivers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل المندوب');
    return data;
  },

  deleteDriver: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/drivers/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف المندوب');
    return data;
  },

  settleDriver: async (driverId: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/drivers/${driverId}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    });
    return res.json();
  },

  // Auth & Roles
  login: async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      throw new Error('بيانات الدخول غير صحيحة');
    }
    return res.json();
  },

  // Gemini AI OCR
  ocrGemini: async (imageBase64: string): Promise<{ barcode: string; customerName: string; phone: string; address: string; amount: number }> => {
    const res = await fetch(`${API_BASE}/ocr-gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    
    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error('السيرفر أعاد استجابة غير صالحة. يرجى التأكد من تشغيل خادم النظام.');
    }

    if (!res.ok) {
      throw new Error(data.error || 'فشل الاتصال بقارئ Gemini الذكي');
    }
    return data;
  },

  // Audit Logs (Admin Only)
  getAuditLogs: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/audit-logs`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Sessions (جلسات العمل والورديات للمناديب)
  getSessions: async (params?: { driverId?: string; status?: string }): Promise<DriverSession[]> => {
    const query = new URLSearchParams();
    if (params?.driverId) query.append('driverId', params.driverId);
    if (params?.status) query.append('status', params.status);
    const res = await fetch(`${API_BASE}/sessions?${query.toString()}`);
    return res.json();
  },

  getActiveSessions: async (): Promise<DriverSession[]> => {
    const res = await fetch(`${API_BASE}/sessions/active`);
    return res.json();
  },

  startSession: async (driverId: string, notes?: string): Promise<DriverSession> => {
    const res = await fetch(`${API_BASE}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ driverId, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل بدء الجلسة للمندوب');
    return data;
  },

  closeSession: async (sessionId: string, notes?: string): Promise<DriverSession> => {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إغلاق وتصفية الجلسة');
    return data;
  },

  getSessionOrders: async (sessionId: string): Promise<Order[]> => {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/orders`);
    return res.json();
  },

  // Stats
  getStats: async (): Promise<Stats> => {
    const res = await fetch(`${API_BASE}/stats`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },
};
