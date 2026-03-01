'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

export default function Login() {
    const t = useTranslations('Login');
    const locale = useLocale();
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        router.push(`/${locale}/role-selection`);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">🌾</div>
                    <h2>Welcome to Daladan</h2>
                    <p>Agricultural Supply Chain Platform</p>
                </div>
                <div className="auth-body">
                    {error && (
                        <div className="auth-error">
                            <i className="fa-solid fa-circle-exclamation"></i> {error}
                        </div>
                    )}
                    <form onSubmit={handleLogin}>
                        <div className="auth-input-group">
                            <label>{t('email')}</label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-envelope"></i>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
                            </div>
                        </div>
                        <div className="auth-input-group">
                            <label>{t('password')}</label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-lock"></i>
                                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} />
                                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="auth-submit" disabled={loading}>
                            <i className="fa-solid fa-right-to-bracket"></i>
                            {loading ? 'Kirish...' : 'Kirish'}
                        </button>
                    </form>
                    <div className="auth-footer">
                        <a href={`/${locale}/signup`}>{t('noAccount')}</a>
                    </div>
                    <div className="auth-demo-hint">
                        Demo: <strong>farmer@daladan.test</strong> / <strong>driver@daladan.test</strong> / <strong>retailer@daladan.test</strong> — password: <strong>Daladan2025!</strong>
                    </div>
                </div>
            </div>
        </div>
    );
}
