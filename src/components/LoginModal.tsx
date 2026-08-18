import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldCheck, Eye, EyeOff, Sparkles, KeyRound, Truck, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import type { User } from '../services/api';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // قواعد التحقق من كلمة المرور لقوة الحساب والأمان
  const isMinLength = password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('يرجى إدخال اسم المستخدم الحقيقي');
      return;
    }
    if (!isMinLength) {
      setError('كلمة المرور يجب أن لا تقل عن 6 خانات مخصصة للأمان');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await api.login(username.trim(), password);
      // تثبيت الجلسة المستمرة حتى تسجيل الخروج (Session Persistence)
      localStorage.setItem('nanax_user', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة، تأكد من اسم المستخدم ورمز المرور');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'radial-gradient(circle at top right, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(30, 41, 59, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        padding: '2.25rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        direction: 'rtl'
      }}>
        {/* الهيدر البصري واللوجو الفاخر */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
            marginBottom: '1rem'
          }}>
            <Lock size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            نظام <span style={{ color: '#38bdf8' }}>Nanax</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.35rem' }}>
            تسجيل الدخول 🔒
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem',
            marginBottom: '1.25rem'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* حقل اسم المستخدم */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
              اسم المستخدم (Username)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                style={{
                  background: '#0f172a', border: '1px solid #334155', color: '#f8fafc',
                  paddingRight: '2.5rem', height: '46px', borderRadius: '12px', fontSize: '0.95rem'
                }}
                placeholder="أدخل اسم الحساب المسجل..."
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                required
              />
              <UserIcon size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            </div>
          </div>

          {/* حقل كلمة المرور */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
              كلمة المرور (Password)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                style={{
                  background: '#0f172a', border: '1px solid #334155', color: '#f8fafc',
                  paddingRight: '2.5rem', paddingLeft: '2.5rem', height: '46px', borderRadius: '12px', fontSize: '0.95rem'
                }}
                placeholder="أدخل كلمة المرور..."
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                required
              />
              <KeyRound size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* شروط وقواعد الحماية البصرية للرمز */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.78rem', color: isMinLength ? '#4ade80' : '#94a3b8' }}>
              <ShieldCheck size={14} />
              <span>قواعد الأمان: الحد الأدنى 6 خانات مخصصة ({password.length}/6)</span>
            </div>
          </div>

          {/* زر تسجيل الدخول */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              height: '48px', borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)', marginTop: '0.5rem'
            }}
            disabled={loading}
          >
            {loading ? 'جاري التحقق وتدقيق الجلسة...' : 'تسجيل الدخول للنظام'}
          </button>
        </form>

        {/* أزرار الحسابات السريعة الجاهزة للاختبار */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #334155' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>
            ⚡ اختيار سريع لنوع الحساب والصلاحية:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => handleQuickPreset('admin', '123456')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#0f172a', border: '1px solid #334155', padding: '0.55rem 0.85rem',
                borderRadius: '10px', color: '#f8fafc', fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: '#facc15' }} />
                <span>حساب المدير العام (Full Financial Admin)</span>
              </div>
              <code style={{ background: '#1e293b', padding: '0.15rem 0.4rem', borderRadius: '4px', color: '#38bdf8' }}>admin</code>
            </button>

            <button
              onClick={() => handleQuickPreset('supervisor', '123456')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#0f172a', border: '1px solid #334155', padding: '0.55rem 0.85rem',
                borderRadius: '10px', color: '#f8fafc', fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={14} style={{ color: '#818cf8' }} />
                <span>حساب مشرف المتابعة (بدون مالية)</span>
              </div>
              <code style={{ background: '#1e293b', padding: '0.15rem 0.4rem', borderRadius: '4px', color: '#818cf8' }}>supervisor</code>
            </button>

            <button
              onClick={() => handleQuickPreset('driver', '123456')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#0f172a', border: '1px solid #334155', padding: '0.55rem 0.85rem',
                borderRadius: '10px', color: '#f8fafc', fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={14} style={{ color: '#4ade80' }} />
                <span>حساب المندوب الميداني (Driver App)</span>
              </div>
              <code style={{ background: '#1e293b', padding: '0.15rem 0.4rem', borderRadius: '4px', color: '#4ade80' }}>driver</code>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
