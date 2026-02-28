'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Sprout, Truck, Store } from 'lucide-react';

type UserProfile = {
    is_farmer: boolean;
    is_driver: boolean;
    is_retailer: boolean;
};

export default function RoleSelectionGateway() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfile() {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('is_farmer, is_driver, is_retailer')
                .eq('id', session.user.id)
                .single();

            if (data) {
                setProfile(data);
            }
            setLoading(false);
        }

        loadProfile();
    }, [router]);

    const handleRoleSelect = (roleKey: 'producer' | 'driver' | 'retailer', route: string) => {
        sessionStorage.setItem('activeRole', roleKey);
        router.push(route);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agro-green"></div>
            </div>
        );
    }

    // Fallback defaults if profile fetch fails
    const isFarmer = profile?.is_farmer ?? false;
    const isDriver = profile?.is_driver ?? false;
    const isRetailer = profile?.is_retailer ?? false;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col items-center justify-center">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-agro-green to-harvest-amber">Daladan</span>
                </h2>
                <p className="text-lg text-gray-600">Which interface would you like to enter?</p>
            </div>

            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Producer Card */}
                <div
                    onClick={() => isFarmer && handleRoleSelect('producer', '/producer')}
                    className={`relative rounded-2xl p-8 transition-all duration-300 border-2 overflow-hidden flex flex-col items-center text-center ${isFarmer
                            ? 'bg-white border-agro-green shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 group'
                            : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed grayscale'
                        }`}
                >
                    {isFarmer && (
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-agro-green to-agro-green-lighter"></div>
                    )}
                    <div className={`p-4 rounded-full mb-6 ${isFarmer ? 'bg-green-50 text-agro-green group-hover:scale-110 transition-transform' : 'bg-gray-200 text-gray-400'}`}>
                        <Sprout size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Producer</h3>
                    <p className="text-sm font-medium text-agro-green mb-4">Mening Maydonim</p>
                    <p className="text-gray-500 text-sm flex-grow">
                        Manage your harvests, track inventory, and connect directly with retailers.
                    </p>
                    {!isFarmer && (
                        <div className="mt-6 py-1 px-3 bg-gray-200 text-gray-500 text-xs font-semibold rounded-full">
                            Role Not Active
                        </div>
                    )}
                </div>

                {/* Driver Card */}
                <div
                    onClick={() => isDriver && handleRoleSelect('driver', '/driver')}
                    className={`relative rounded-2xl p-8 transition-all duration-300 border-2 overflow-hidden flex flex-col items-center text-center ${isDriver
                            ? 'bg-white border-blue-600 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 group'
                            : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed grayscale'
                        }`}
                >
                    {isDriver && (
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-blue-400"></div>
                    )}
                    <div className={`p-4 rounded-full mb-6 ${isDriver ? 'bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform' : 'bg-gray-200 text-gray-400'}`}>
                        <Truck size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Driver</h3>
                    <p className="text-sm font-medium text-blue-600 mb-4">Haydovchi Paneli</p>
                    <p className="text-gray-500 text-sm flex-grow">
                        Find transport jobs, optimize routes, and earn by delivering fresh produce.
                    </p>
                    {!isDriver && (
                        <div className="mt-6 py-1 px-3 bg-gray-200 text-gray-500 text-xs font-semibold rounded-full">
                            Role Not Active
                        </div>
                    )}
                </div>

                {/* Retailer Card */}
                <div
                    onClick={() => isRetailer && handleRoleSelect('retailer', '/retailer')}
                    className={`relative rounded-2xl p-8 transition-all duration-300 border-2 overflow-hidden flex flex-col items-center text-center ${isRetailer
                            ? 'bg-white border-harvest-amber shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 group'
                            : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed grayscale'
                        }`}
                >
                    {isRetailer && (
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-harvest-amber to-harvest-amber-light"></div>
                    )}
                    <div className={`p-4 rounded-full mb-6 ${isRetailer ? 'bg-amber-50 text-harvest-amber group-hover:scale-110 transition-transform' : 'bg-gray-200 text-gray-400'}`}>
                        <Store size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Retailer</h3>
                    <p className="text-sm font-medium text-harvest-amber mb-4">Fresh Direct</p>
                    <p className="text-gray-500 text-sm flex-grow">
                        Source fresh produce directly from farmers for your stores or restaurants.
                    </p>
                    {!isRetailer && (
                        <div className="mt-6 py-1 px-3 bg-gray-200 text-gray-500 text-xs font-semibold rounded-full">
                            Role Not Active
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
