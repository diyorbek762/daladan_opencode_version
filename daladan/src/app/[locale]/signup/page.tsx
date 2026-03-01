'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

const regions = [
    'Tashkent', 'Namangan', 'Samarkand', 'Fergana', 'Bukhara',
    'Andijan', 'Kashkadarya', 'Surxondaryo', 'Jizzakh', 'Syrdarya',
    'Navoiy', 'Xorazm', 'Karakalpakstan',
];

export default function Signup() {
    const t = useTranslations('Signup');
    const locale = useLocale();
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('+998');
    const [location, setLocation] = useState('Tashkent');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'farmer' | 'driver' | 'retailer'>('farmer');
    const [language, setLanguage] = useState<'uz-Latn' | 'uz-Cyrl' | 'ru'>(locale as 'uz-Latn' | 'uz-Cyrl' | 'ru');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data: existingUser, error: checkError } = await supabase
            .from('profiles').select('id').eq('username', username).single();

        if (checkError && checkError.code !== 'PGRST116') {
            setError(checkError.message);
            setLoading(false);
            return;
        }
        if (existingUser) {
            setError(t('usernameTaken'));
            setLoading(false);
            return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) { setError(authError.message); setLoading(false); return; }

        if (authData.user) {
            const { error: profileError } = await supabase.from('profiles').insert([{
                id: authData.user.id,
                username,
                email,
                phone,
                location,
                is_farmer: role === 'farmer',
                is_driver: role === 'driver',
                is_retailer: role === 'retailer',
                preferred_language: language,
            }]);

            if (profileError) { setError(profileError.message); setLoading(false); return; }
            router.push(`/${locale}/role-selection`);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card" style={{ maxWidth: '460px' }}>
                <div className="auth-header">
                    <div className="auth-logo">🌱</div>
                    <h2>Daladan&apos;ga Qo&apos;shiling</h2>
                    <p>Create your account to get started</p>
                </div>
                <div className="auth-body">
                    {error && (
                        <div className="auth-error">
                            <i className="fa-solid fa-circle-exclamation"></i> {error}
                        </div>
                    )}
                    <form onSubmit={handleSignup}>
                        <div className="auth-input-group">
                            <label>{t('username')}</label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-user"></i>
                                <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder={t('usernamePlaceholder')} />
                            </div>
                        </div>
                        <div className="auth-input-group">
                            <label>{t('email')}</label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-envelope"></i>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div className="auth-input-group" style={{ flex: 1 }}>
                                <label><i className="fa-solid fa-phone" style={{ marginRight: '0.3rem', fontSize: '0.7rem' }}></i> Telefon raqam</label>
                                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
                            </div>
                            <div className="auth-input-group" style={{ flex: 1 }}>
                                <label><i className="fa-solid fa-location-dot" style={{ marginRight: '0.3rem', fontSize: '0.7rem' }}></i> Joylashuv</label>
                                <select value={location} onChange={e => setLocation(e.target.value)}>
                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
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
                        <div className="auth-input-group">
                            <label>{t('accountType')}</label>
                            <div className="role-pills">
                                <button type="button" className={`role-pill ${role === 'farmer' ? 'selected' : ''}`} onClick={() => setRole('farmer')}>
                                    <i className="fa-solid fa-wheat-awn"></i> {t('roleFarmer')}
                                </button>
                                <button type="button" className={`role-pill ${role === 'driver' ? 'selected' : ''}`} onClick={() => setRole('driver')}>
                                    <i className="fa-solid fa-truck-fast"></i> {t('roleDriver')}
                                </button>
                                <button type="button" className={`role-pill ${role === 'retailer' ? 'selected' : ''}`} onClick={() => setRole('retailer')}>
                                    <i className="fa-solid fa-store"></i> {t('roleRetailer')}
                                </button>
                            </div>
                        </div>
                        <div className="auth-input-group">
                            <label>{t('language')}</label>
                            <select value={language} onChange={e => setLanguage(e.target.value as typeof language)}>
                                <option value="uz-Latn">O&apos;zbekcha (Lotin)</option>
                                <option value="uz-Cyrl">Ўзбекча (Кирилл)</option>
                                <option value="ru">Русский</option>
                            </select>
                        </div>
                        <button type="submit" className="auth-submit" disabled={loading}>
                            <i className="fa-solid fa-user-plus"></i>
                            {loading ? 'Yaratilmoqda...' : 'Hisob Yaratish'}
                        </button>
                    </form>
                    <div className="auth-footer">
                        <a href={`/${locale}/login`}>{t('hasAccount')}</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
