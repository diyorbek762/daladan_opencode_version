'use client';

import { useTranslations } from 'next-intl';
import ChatView from '@/components/ChatView';

export default function RetailerDashboard() {
    const t = useTranslations('Retailer');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border-t-4 border-harvest-amber p-8 text-center sm:p-16">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-harvest-amber to-harvest-amber-dark mb-4">
                    {t('title')}
                </h1>
                <p className="text-xl text-gray-600 mt-4 font-medium italic">
                    {t('comingSoon')}
                </p>

                <div className="mt-12 w-full flex justify-center text-left">
                    <ChatView />
                </div>
            </div>
        </div>
    );
}
