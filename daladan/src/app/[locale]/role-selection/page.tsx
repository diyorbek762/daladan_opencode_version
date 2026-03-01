'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

export default function RoleSelectionGateway() {
    const t = useTranslations('RoleSelection');
    const locale = useLocale();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<'producer' | 'driver' | 'retailer' | null>(null);

    useEffect(() => {
        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push(`/${locale}/login`); return; }
            setLoading(false);
        }
        checkAuth();
    }, [router, locale]);

    const handleContinue = () => {
        if (!selectedRole) return;
        sessionStorage.setItem('activeRole', selectedRole);
        router.push(`/${locale}/${selectedRole}`);
    };

    if (loading) {
        return (
            <div className="role-select-page">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, border: '3px solid var(--border-color)', borderTopColor: 'var(--agro-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{t('loading')}</p>
                </div>
            </div>
        );
    }

    const roles = [
        { key: 'producer' as const, icon: 'fa-wheat-awn', title: t('producerTitle'), subtitle: t('producerSubtitle'), desc: t('producerDesc'), colorClass: 'role-card-green' },
        { key: 'driver' as const, icon: 'fa-truck-fast', title: t('driverTitle'), subtitle: t('driverSubtitle'), desc: t('driverDesc'), colorClass: 'role-card-blue' },
        { key: 'retailer' as const, icon: 'fa-store', title: t('retailerTitle'), subtitle: t('retailerSubtitle'), desc: t('retailerDesc'), colorClass: 'role-card-amber' },
    ];

    return (
        <div className="role-select-page">
            <div className="role-select-header">
                <div className="logo-icon">🌾</div>
                <h1>
                    {t('heading').includes('Daladan') ? (
                        <>{t('heading').split('Daladan')[0]}<span>Daladan</span>{t('heading').split('Daladan')[1] ?? ''}</>
                    ) : t('heading')}
                </h1>
                <p>{t('subheading')}</p>
            </div>

            <div className="role-cards-grid">
                {roles.map((role) => (
                    <div
                        key={role.key}
                        className={`role-card ${role.colorClass}`}
                        onClick={() => setSelectedRole(role.key)}
                        style={selectedRole === role.key ? { borderColor: 'var(--agro-green)', boxShadow: '0 0 0 3px rgba(6,78,59,0.15), var(--shadow-lg)' } : {}}
                    >
                        <div className="rc-icon"><i className={`fa-solid ${role.icon}`}></i></div>
                        <div className="rc-title">{role.title}</div>
                        <div className="rc-subtitle">{role.subtitle}</div>
                        <div className="rc-desc">{role.desc}</div>
                        {selectedRole === role.key && (
                            <div className="rc-badge" style={{ background: '#ECFDF5', color: 'var(--agro-green)' }}>
                                <i className="fa-solid fa-check" style={{ marginRight: '0.25rem', fontSize: '0.6rem' }}></i> Tanlangan
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={handleContinue}
                disabled={!selectedRole}
                className="auth-submit"
                style={{ maxWidth: '360px', marginTop: '2rem', padding: '1rem', fontSize: '1rem' }}
            >
                <i className="fa-solid fa-arrow-right"></i> Davom etish
            </button>
        </div>
    );
}
