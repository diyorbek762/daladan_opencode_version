'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';
import ChatView from '@/components/ChatView';

export default function ProducerDashboard() {
    const t = useTranslations('Producer');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [cropName, setCropName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [ownTransport, setOwnTransport] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const { error: insertError } = await supabase
                .from('harvests')
                .insert([
                    {
                        user_id: session.user.id,
                        crop_name: cropName,
                        quantity: parseFloat(quantity),
                        farmer_provides_transport: ownTransport,
                    }
                ]);

            if (insertError) throw insertError;

            setSuccess(true);
            setCropName('');
            setQuantity('');
            setOwnTransport(false);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border-t-4 border-agro-green p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    {t('title')}
                </h1>

                <div className="bg-green-50 rounded-xl p-6 mb-8 border border-green-100">
                    <h2 className="text-xl font-semibold text-agro-green mb-4">{t('harvestLog')}</h2>

                    {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
                    {success && <p className="text-agro-green mb-4 text-sm font-medium">Harvest logged successfully!</p>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('cropName')}</label>
                            <input
                                type="text"
                                required
                                value={cropName}
                                onChange={(e) => setCropName(e.target.value)}
                                className="input-field"
                                placeholder="e.g., Tomatoes"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity')} (kg/tons)</label>
                            <input
                                type="number"
                                required
                                min="0.1"
                                step="0.1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="input-field"
                                placeholder="100"
                            />
                        </div>

                        <div className="flex items-center mt-4">
                            <input
                                id="ownTransport"
                                type="checkbox"
                                checked={ownTransport}
                                onChange={(e) => setOwnTransport(e.target.checked)}
                                className="h-5 w-5 text-agro-green focus:ring-agro-green border-gray-300 rounded"
                            />
                            <label htmlFor="ownTransport" className="ml-3 block text-sm font-medium text-gray-700">
                                {t('ownTransport')}
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary mt-6 !w-auto !px-8"
                        >
                            {loading ? '...' : t('submit')}
                        </button>
                    </form>
                </div>

                {/* Sifat Tizimi (Quality System) */}
                <div className="bg-white rounded-xl p-6 mb-8 border border-gray-200 shadow-sm mt-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-agro-green-light p-2 rounded-lg">
                            <span className="text-agro-green font-bold text-xl">✓</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Sifat Tizimi (Quality System)</h2>
                    </div>
                    <p className="text-gray-600 mb-4 text-sm">
                        Add quality metrics, upload certificates, and get your crops verified for the «Daladan Verified» badge to attract premium retailers.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-center cursor-pointer hover:bg-gray-100 transition-colors">
                            <span className="block text-2xl mb-2">📄</span>
                            <span className="font-semibold text-gray-700 text-sm">Upload Certificate</span>
                        </div>
                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-center cursor-pointer hover:bg-gray-100 transition-colors">
                            <span className="block text-2xl mb-2">📸</span>
                            <span className="font-semibold text-gray-700 text-sm">Add Crop Photos</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 w-full flex justify-center">
                    <ChatView />
                </div>
            </div>
        </div>
    );
}
