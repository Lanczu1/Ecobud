import React, { useState, FormEvent } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Leaf, Sun, Moon } from 'lucide-react';
import logoImg from '../assets/logo.png';

interface WebAuthViewProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  authError: string | null;
  isDark: boolean;
  onToggleDark: () => void;
}

export function WebAuthView({ onLogin, authError, isDark, onToggleDark }: WebAuthViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Validation
  const errors: { email?: string; password?: string } = {};
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (errors.email || errors.password) return;

    setIsLoading(true);
    try {
      await onLogin(email.trim(), password);
    } finally {
      setIsLoading(false);
    }
  };

  const markTouched = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <div className="auth-shell animate-fade-in" style={{ position: 'relative', overflow: 'hidden' }}>
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          opacity: isDark ? 0.25 : 0.5,
          transition: 'opacity 0.3s ease',
        }}
      >
        <source src="/web-bg.mp4" type="video/mp4" />
      </video>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Top Navbar */}
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={logoImg}
              alt="Logo"
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8 }}
            />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-auth-primary)' }}>ECOBUD</span>
          </div>
          <button
            type="button"
            onClick={onToggleDark}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-auth-title)',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              borderRadius: '50%',
              transition: 'background-color 0.2s ease',
            }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Center Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', alignItems: 'center' }}>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Admin Panel</h1>
            <Leaf size={20} color="var(--color-auth-primary)" style={{ marginTop: 4, marginLeft: 4 }} />
          </div>
          <p style={{ color: 'var(--color-auth-subtitle)', marginBottom: 32, textAlign: 'center' }}>
            Sign in to manage the Ecobud platform
          </p>

          <form onSubmit={handleSubmit} className="auth-card" style={{ width: '100%', maxWidth: '400px' }}>
            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-auth-danger-soft)', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
                <AlertCircle size={18} color="var(--color-auth-danger)" style={{ marginRight: 8, flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--color-auth-danger)', fontWeight: 500, lineHeight: 1.4 }}>{authError}</span>
              </div>
            )}

            <CustomInputField
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              icon={<Mail size={18} />}
              type="email"
              placeholder="admin@ecobud.app"
              error={touched.email ? errors.email : undefined}
            />

            <CustomInputField
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => markTouched('password')}
              icon={<Lock size={18} />}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              error={touched.password ? errors.password : undefined}
              trailingIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              onTrailingPress={() => setShowPassword(!showPassword)}
            />

            <button type="submit" disabled={isLoading} className="auth-btn-primary" style={{ marginTop: 12 }}>
              {isLoading ? 'Signing In...' : 'Log In'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

interface CustomInputFieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  error?: string;
  trailingIcon?: React.ReactNode;
  onTrailingPress?: () => void;
}

function CustomInputField({ label, value, onChange, onBlur, icon, type, placeholder, error, trailingIcon, onTrailingPress }: CustomInputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isFocused ? 'var(--color-auth-primary)' : 'var(--color-auth-title)', transition: 'color 0.2s ease' }}>
          {label}
        </span>
      </div>

      <div
        className="auth-input-outer"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          height: 52,
          borderColor: error ? 'var(--color-auth-danger)' : (isFocused ? 'var(--color-auth-border-strong)' : 'var(--color-auth-border)'),
          boxShadow: error ? 'none' : undefined
        }}
      >
        <div style={{ color: isFocused ? 'var(--color-auth-field-icon-active)' : 'var(--color-auth-field-icon)', marginRight: 12, display: 'flex', alignItems: 'center', transition: 'color 0.2s ease' }}>
          {icon}
        </div>

        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur();
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            alignSelf: 'stretch',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '1rem',
            color: 'var(--color-auth-title)',
            caretColor: 'var(--color-auth-primary)',
            width: '100%',
          }}
        />

        {trailingIcon && (
          <button
            type="button"
            onClick={onTrailingPress}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isFocused ? 'var(--color-auth-field-icon-active)' : 'var(--color-auth-field-icon)',
              padding: 0,
              marginLeft: 12,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {trailingIcon}
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-auth-danger)', marginTop: 6, marginLeft: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
