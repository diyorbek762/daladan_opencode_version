'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import type { NearestOrder, PredictedRoute } from '@/hooks/useDriverTracking';

// Dynamic import of the map logic component, disabling SSR so 'window' exists
const MapLogic = dynamic(
    () => import('./MapLogic'),
    {
        ssr: false,
        loading: () => (
            <div className="h-[400px] bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
                Loading Map...
            </div>
        ),
    }
) as React.ComponentType<{
    jobs: any[];
    driverPosition?: { lat: number; lng: number } | null;
    nearestOrders?: NearestOrder[];
    routeGeoJSON?: GeoJSON.FeatureCollection | null;
    isTracking?: boolean;
    predictedRoute?: PredictedRoute | null;
    predictLoading?: boolean;
    onFindLoads?: () => void;
}>;

interface ClientMapProps {
    jobs: any[];
    driverPosition?: { lat: number; lng: number } | null;
    nearestOrders?: NearestOrder[];
    routeGeoJSON?: GeoJSON.FeatureCollection | null;
    isTracking?: boolean;
    predictedRoute?: PredictedRoute | null;
    predictLoading?: boolean;
    onFindLoads?: () => void;
}

export default function ClientMap({
    jobs,
    driverPosition = null,
    nearestOrders = [],
    routeGeoJSON = null,
    isTracking = false,
    predictedRoute = null,
    predictLoading = false,
    onFindLoads,
}: ClientMapProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <MapLogic
            jobs={jobs}
            driverPosition={driverPosition}
            nearestOrders={nearestOrders}
            routeGeoJSON={routeGeoJSON}
            isTracking={isTracking}
            predictedRoute={predictedRoute}
            predictLoading={predictLoading}
            onFindLoads={onFindLoads}
        />
    );
}
