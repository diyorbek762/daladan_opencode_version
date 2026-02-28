'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';
import ChatView from '@/components/ChatView';
import ClientMap from '@/components/ClientMap';

type HarvestJob = {
    id: string;
    crop_name: string;
    quantity: number;
    profiles: { username: string };
};

export default function DriverDashboard() {
    const t = useTranslations('Driver');
    const [jobs, setJobs] = useState<HarvestJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchJobs() {
            // Fetch harvests where the farmer DOES NOT provide transport
            const { data, error } = await supabase
                .from('harvests')
                .select(`
          id,
          crop_name,
          quantity,
          profiles ( username )
        `)
                .eq('farmer_provides_transport', false)
                .order('id', { ascending: false });

            if (data) {
                setJobs(data as unknown as HarvestJob[]);
            }
            setLoading(false);
        }
        fetchJobs();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border-t-4 border-blue-600 p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    {t('title')}
                </h1>

                <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-100">
                    <h2 className="text-xl font-semibold text-blue-800 mb-4">{t('availableJobs')}</h2>

                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : jobs.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">{t('noJobs')}</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {jobs.map((job) => (
                                <div key={job.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-900">{job.crop_name}</h3>
                                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                            {job.quantity} kg
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4">Farmer: {job.profiles?.username || 'Unknown'}</p>
                                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm">
                                        Accept Transport
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Map View */}
                <div className="bg-white rounded-xl p-6 mb-8 border border-gray-200 shadow-sm mt-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Route Optimization Map</h2>
                    <ClientMap jobs={jobs} />
                </div>

                <div className="mt-12 w-full flex justify-center">
                    <ChatView />
                </div>
            </div>
        </div>
    );
}
