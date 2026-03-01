'use client';

import { useState, useCallback, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const LANG_CONFIG = [
    { code: 'uz-Latn', label: "O'zbekcha", flag: '🇺🇿' },
    { code: 'uz-Cyrl', label: 'Ўзбекча', flag: '🇺🇿' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const navLinks = [
    { key: 'producer', icon: 'fa-wheat-awn', labelKey: 'producer' as const },
    { key: 'driver', icon: 'fa-truck-fast', labelKey: 'driver' as const },
    { key: 'retailer', icon: 'fa-store', labelKey: 'retailer' as const },
];

const LanguageSwitcher = memo(function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const currentLang = LANG_CONFIG.find(l => l.code === locale) || LANG_CONFIG[0];

    const switchLang = useCallback((newLocale: string) => {
        const segments = pathname.split('/');
        segments[1] = newLocale;
        const newPath = segments.join('/');
        setOpen(false);
        router.push(newPath);
    }, [pathname, router]);

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                className="nav-lang-btn"
            >
                {currentLang.flag} {currentLang.label}
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.55rem', marginLeft: '0.1rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}></i>
            </button>
            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }}></div>
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                        background: 'var(--surface-primary)', border: '1px solid var(--border-color)',
                        borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        zIndex: 9999, overflow: 'hidden', minWidth: '160px',
                        animation: 'viewFadeIn 0.15s ease-out',
                    }}>
                        {LANG_CONFIG.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => switchLang(lang.code)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                                    padding: '0.65rem 1rem', width: '100%', border: 'none',
                                    background: locale === lang.code ? '#F0FDF4' : 'transparent',
                                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: locale === lang.code ? 600 : 400,
                                    fontFamily: 'inherit', color: 'var(--text-primary)',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                                onMouseLeave={e => (e.currentTarget.style.background = locale === lang.code ? '#F0FDF4' : 'transparent')}
                            >
                                <span style={{ fontSize: '1rem' }}>{lang.flag}</span>
                                {lang.label}
                                {locale === lang.code && <i className="fa-solid fa-check" style={{ marginLeft: 'auto', color: 'var(--agro-green)', fontSize: '0.7rem' }}></i>}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
});

export default function Navbar() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const t = useTranslations('Navbar');
    const [signingOut, setSigningOut] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const currentRole = navLinks.find(l => pathname.includes(`/${l.key}`))?.key || '';

    const handleSignOut = async () => {
        setSigningOut(true);
        await supabase.auth.signOut();
        router.push(`/${locale}/login`);
    };

    return (
        <>
            {/* ── Desktop Top Navbar (hidden on mobile) ── */}
            <nav className="nav-desktop">
                {/* Left: Logo */}
                <div
                    onClick={() => router.push(`/${locale}/role-selection`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer' }}
                >
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, var(--agro-green), var(--agro-green-lighter))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', color: '#fff',
                    }}>
                        🌱
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        Daladan
                    </span>
                </div>

                {/* Center: Role Links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {navLinks.map(link => {
                        const isActive = currentRole === link.key;
                        return (
                            <button
                                key={link.key}
                                onClick={() => router.push(`/${locale}/${link.key}`)}
                                className={`nav-role-btn ${isActive ? 'active' : ''}`}
                            >
                                <i className={`fa-solid ${link.icon}`} style={{ fontSize: '0.72rem' }}></i>
                                {t(link.labelKey)}
                            </button>
                        );
                    })}
                </div>

                {/* Right: Language + Sign Out */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LanguageSwitcher />
                    <button onClick={handleSignOut} disabled={signingOut} className="nav-signout-btn">
                        <i className={`fa-solid ${signingOut ? 'fa-spinner fa-spin' : 'fa-right-from-bracket'}`} style={{ fontSize: '0.72rem' }}></i>
                        {signingOut ? t('signingOut') : t('signOut')}
                    </button>
                </div>
            </nav>

            {/* ── Mobile Top Bar (visible on small screens only) ── */}
            <div className="nav-mobile-top">
                <div onClick={() => router.push(`/${locale}/role-selection`)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, var(--agro-green), var(--agro-green-lighter))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.85rem', color: '#fff',
                    }}>🌱</div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Daladan</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <LanguageSwitcher />
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="nav-hamburger-btn"
                    >
                        <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
                    </button>
                </div>
            </div>

            {/* Mobile dropdown menu */}
            {mobileMenuOpen && (
                <div className="nav-mobile-dropdown">
                    <button onClick={handleSignOut} disabled={signingOut} className="nav-mobile-menu-item">
                        <i className={`fa-solid ${signingOut ? 'fa-spinner fa-spin' : 'fa-right-from-bracket'}`}></i>
                        {signingOut ? t('signingOut') : t('signOut')}
                    </button>
                </div>
            )}

            {/* ── Mobile Bottom Tab Bar ── */}
            <div className="nav-mobile-bottom">
                {navLinks.map(link => {
                    const isActive = currentRole === link.key;
                    return (
                        <button
                            key={link.key}
                            onClick={() => { router.push(`/${locale}/${link.key}`); setMobileMenuOpen(false); }}
                            className={`nav-bottom-tab ${isActive ? 'active' : ''}`}
                        >
                            <i className={`fa-solid ${link.icon}`}></i>
                            <span>{t(link.labelKey)}</span>
                        </button>
                    );
                })}
            </div>
        </>
    );
}
