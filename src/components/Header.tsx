import React from 'react';
import { Bell, ShieldCheck, UserCheck, Truck, Shield } from 'lucide-react';
import type { User } from '../services/api';

interface HeaderProps {
  user?: User | null;
  onSwitchRole?: (role: 'admin' | 'supervisor' | 'driver') => void;
}

const Header: React.FC<HeaderProps> = ({ user, onSwitchRole }) => {
  const roleTitle = user?.role === 'admin' ? 'المدير العام 👑' : user?.role === 'supervisor' ? 'مشرف المتابعة 🛡️' : 'مندوب التوصيل 🚚';

  return (
    <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
      <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>منصة Nanax الذكية ⚡</span>
        
        {user && (
          <span style={{ fontSize: '0.8rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.25rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
            <ShieldCheck size={14} />
            {roleTitle}
          </span>
        )}

        {/* Real-time Role Switcher Simulator */}
        {onSwitchRole && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', padding: '3px 6px', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '4px' }}>تبديل الحساب المباشر:</span>
            
            <button
              onClick={() => onSwitchRole('admin')}
              style={{
                background: user?.role === 'admin' ? '#0284c7' : 'transparent',
                color: user?.role === 'admin' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: user?.role === 'admin' ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="التبديل إلى حساب المدير العام (كافة الصلاحيات والتصفية المالية)"
            >
              👑 مدير
            </button>

            <button
              onClick={() => onSwitchRole('supervisor')}
              style={{
                background: user?.role === 'supervisor' ? '#6366f1' : 'transparent',
                color: user?.role === 'supervisor' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: user?.role === 'supervisor' ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="التبديل إلى حساب مشرف المتابعة اللوجستية"
            >
              🛡️ مشرف
            </button>

            <button
              onClick={() => onSwitchRole('driver')}
              style={{
                background: user?.role === 'driver' ? '#10b981' : 'transparent',
                color: user?.role === 'driver' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: user?.role === 'driver' ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="التبديل إلى تطبيق المندوب الميداني (حسين لفته)"
            >
              🚚 مندوب (حسين)
            </button>
          </div>
        )}
      </div>
      
      <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="avatar" style={{ background: user?.role === 'admin' ? '#0284c7' : user?.role === 'supervisor' ? '#6366f1' : '#10b981', color: '#fff', fontWeight: 800, width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {user ? user.name[0] : 'م'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{user ? user.name : 'مستخدم'}</span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{user?.username}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
