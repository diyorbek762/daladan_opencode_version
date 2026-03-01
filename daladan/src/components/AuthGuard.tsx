'use client';

import { useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

type AuthGuardProps = {
    children: ReactNode;
};

/**
 * Client-side Route Guard.
 * Wraps any page that requires authentication. Redirects to login if
 * no session is found. All authenticated users can access any dashboard.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
    const locale = useLocale();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        async function check() {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.replace(`/${locale}/login`);
                return;
            }

            setAuthorized(true);
            setChecking(false);
        }

        check();
    }, [locale, router]);

    if (checking || !authorized) {
        return (
            <div className="role-select-page">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, border: '3px solid var(--border-color)', borderTopColor: 'var(--agro-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
