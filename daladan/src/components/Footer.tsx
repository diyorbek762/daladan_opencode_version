'use client';

import { useTranslations } from 'next-intl';

export default function Footer() {
    const t = useTranslations('Navbar');

    return (
        <footer style={{
            textAlign: 'center', padding: '1.2rem 1rem',
            fontSize: '0.75rem', fontWeight: 400, fontFamily: 'Inter, sans-serif',
            color: 'var(--text-secondary)', letterSpacing: '0.01em',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--surface-secondary)',
            marginTop: 'auto',
        }}>
            {t('founders')}
        </footer>
    );
}
