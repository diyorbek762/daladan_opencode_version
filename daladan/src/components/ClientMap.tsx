'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Dynamic import of the map logic component, disabling SSR so 'window' exists
const MapLogic = dynamic(
    () => import('./MapLogic'),
    { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">Loading Map...</div> }
) as React.ComponentType<{ jobs: any[] }>;

export default function ClientMap({ jobs }: { jobs: any[] }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return <MapLogic jobs={jobs} />;
}
