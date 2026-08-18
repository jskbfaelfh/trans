export const mockOrders = [
  {
    id: "ORD-1001",
    customerName: "أحمد علي",
    phone: "07801234567",
    address: "حي الحسين، شارع 60",
    amount: 25000,
    status: "pending",
    date: "2023-10-25"
  },
  {
    id: "ORD-1002",
    customerName: "فاطمة محمد",
    phone: "07707654321",
    address: "حي المعلمين، قرب المدرسة",
    amount: 15000,
    status: "delivered",
    date: "2023-10-25"
  },
  {
    id: "ORD-1003",
    customerName: "حسن عباس",
    phone: "07501112233",
    address: "حي العباس، مقابل المستشفى",
    amount: 45000,
    status: "postponed",
    date: "2023-10-25"
  },
  {
    id: "ORD-1004",
    customerName: "زينب كمال",
    phone: "07819998877",
    address: "مركز القضاء، السوق الكبير",
    amount: 12000,
    status: "returned",
    date: "2023-10-24"
  },
  {
    id: "ORD-1005",
    customerName: "علي جاسم",
    phone: "07723334455",
    address: "حي النصر",
    amount: 32000,
    status: "pending",
    date: "2023-10-25"
  }
];

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'delivered': return 'تم التسليم';
    case 'postponed': return 'مؤجل';
    case 'returned': return 'راجع';
    case 'pending': return 'قيد الانتظار';
    default: return status;
  }
};
