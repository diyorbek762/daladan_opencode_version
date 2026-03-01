'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════

export interface NearestOrder {
    deal_id: string;
    deal_number: number;
    title: string;
    distance_km: number;
    pickup_lat: number;
    pickup_lng: number;
}

export interface PredictedStop {
    order: number;
    type: string;
    deal_id: string;
    deal_number: number;
    title: string;
    lat: number;
    lng: number;
    distance_from_prev_km: number;
}

export interface PredictedRoute {
    driver: { lat: number; lng: number };
    stops: PredictedStop[];
    total_km: number;
    duration_min: number;
    polyline: any | null;
    ors_success: boolean;
    ors_error: string | null;
    straight_line_km: number;
}

export interface TrackingState {
    connected: boolean;
    driverPosition: { lat: number; lng: number } | null;
    nearestOrders: NearestOrder[];
    routeGeoJSON: GeoJSON.FeatureCollection | null;
    predictedRoute: PredictedRoute | null;
    predictLoading: boolean;
    error: string | null;
    watchingPosition: boolean;
    /** Number of GPS messages actually sent (sparse) */
    sendCount: number;
}

// ═══════════════════════════════════════════════════════
//  Sparse-tracking constants
// ═══════════════════════════════════════════════════════

/** Only send if driver moved > 200 meters */
const MIN_DISTANCE_METERS = 200;
/** Or if 60 seconds have passed since last send */
const MAX_SILENCE_MS = 60_000;
/** Earth radius in meters for Haversine */
const EARTH_RADIUS_M = 6_371_000;

// ═══════════════════════════════════════════════════════
//  Haversine distance (meters)
// ═══════════════════════════════════════════════════════

function haversineMeters(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
): number {
    const toR = (x: number) => (x * Math.PI) / 180;
    const dLat = toR(lat2 - lat1);
    const dLng = toR(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════
//  WebSocket URL builder
// ═══════════════════════════════════════════════════════

const buildWsUrl = (driverId: string) => {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
    return `${proto}://${host}/api/tracking/ws/${driverId}`;
};

// ═══════════════════════════════════════════════════════
//  Hook
// ═══════════════════════════════════════════════════════

export function useDriverTracking(driverId: string | null) {
    const [state, setState] = useState<TrackingState>({
        connected: false,
        driverPosition: null,
        nearestOrders: [],
        routeGeoJSON: null,
        predictedRoute: null,
        predictLoading: false,
        error: null,
        watchingPosition: false,
        sendCount: 0,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const lastSentPosRef = useRef<{ lat: number; lng: number } | null>(null);
    const lastSentTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const latestPosRef = useRef<{ lat: number; lng: number } | null>(null);

    // ── Send GPS over WebSocket ──
    const doSend = useCallback((lat: number, lng: number) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.send(JSON.stringify({ lat, lng }));
        lastSentPosRef.current = { lat, lng };
        lastSentTimeRef.current = Date.now();
        setState((s) => ({ ...s, sendCount: s.sendCount + 1 }));
    }, []);

    // ── Sparse-tracking decision ──
    const maybeSend = useCallback(
        (lat: number, lng: number) => {
            const now = Date.now();
            const lastPos = lastSentPosRef.current;
            const elapsed = now - lastSentTimeRef.current;

            // First message — always send
            if (!lastPos) {
                doSend(lat, lng);
                return;
            }

            // Haversine check: moved > 200m?
            const dist = haversineMeters(lastPos.lat, lastPos.lng, lat, lng);
            if (dist >= MIN_DISTANCE_METERS) {
                doSend(lat, lng);
                return;
            }

            // Time check: 60 seconds since last send?
            if (elapsed >= MAX_SILENCE_MS) {
                doSend(lat, lng);
                return;
            }

            // Otherwise: buffer but don't send
            latestPosRef.current = { lat, lng };
        },
        [doSend]
    );

    // ── Fetch predicted route ──
    const fetchPredictedRoute = useCallback(async () => {
        if (!driverId) return;

        setState((s) => ({ ...s, predictLoading: true, error: null }));

        try {
            const resp = await fetch(`/api/tracking/predict-route/${driverId}`);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ detail: resp.statusText }));
                setState((s) => ({
                    ...s,
                    predictLoading: false,
                    error: err.detail || `HTTP ${resp.status}`,
                }));
                return;
            }

            const data: PredictedRoute = await resp.json();

            // Build GeoJSON for the route
            let routeGeoJSON: GeoJSON.FeatureCollection | null = null;
            if (data.stops.length > 0) {
                const coords: [number, number][] = [
                    [data.driver.lng, data.driver.lat],
                    ...data.stops.map((s) => [s.lng, s.lat] as [number, number]),
                ];
                routeGeoJSON = {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { name: 'Predicted Route', total_km: data.total_km },
                            geometry: { type: 'LineString', coordinates: coords },
                        },
                        ...data.stops.map((s) => ({
                            type: 'Feature' as const,
                            properties: {
                                deal_id: s.deal_id,
                                title: s.title,
                                order: s.order,
                            },
                            geometry: {
                                type: 'Point' as const,
                                coordinates: [s.lng, s.lat],
                            },
                        })),
                    ],
                };
            }

            setState((s) => ({
                ...s,
                predictedRoute: data,
                routeGeoJSON,
                predictLoading: false,
            }));
        } catch (exc) {
            setState((s) => ({
                ...s,
                predictLoading: false,
                error: `Failed to fetch route: ${exc}`,
            }));
        }
    }, [driverId]);

    // ── Connect WebSocket + start geolocation ──
    useEffect(() => {
        if (!driverId) return;

        const ws = new WebSocket(buildWsUrl(driverId));
        wsRef.current = ws;

        ws.onopen = () => setState((s) => ({ ...s, connected: true, error: null }));

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'error') {
                    setState((s) => ({ ...s, error: data.message }));
                    return;
                }
                setState((s) => ({
                    ...s,
                    nearestOrders: data.nearest_orders || [],
                    error: null,
                }));
            } catch {
                // ignore
            }
        };

        ws.onerror = () => setState((s) => ({ ...s, error: 'WebSocket connection error' }));
        ws.onclose = () => setState((s) => ({ ...s, connected: false }));

        // ── Geolocation with sparse tracking ──
        if ('geolocation' in navigator) {
            const wid = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;
                    setState((s) => ({
                        ...s,
                        driverPosition: { lat, lng },
                        watchingPosition: true,
                    }));
                    maybeSend(lat, lng);
                },
                (err) => {
                    setState((s) => ({
                        ...s,
                        error: `Geolocation error: ${err.message}`,
                        watchingPosition: false,
                    }));
                },
                { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
            );
            watchIdRef.current = wid;
        }

        // ── Periodic flush: if 60s elapsed and we have a buffered position ──
        const timerId = setInterval(() => {
            const buf = latestPosRef.current;
            if (buf && Date.now() - lastSentTimeRef.current >= MAX_SILENCE_MS) {
                doSend(buf.lat, buf.lng);
                latestPosRef.current = null;
            }
        }, 5000);
        timerRef.current = timerId;

        return () => {
            ws.close();
            wsRef.current = null;
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [driverId, doSend, maybeSend]);

    return { ...state, fetchPredictedRoute };
}
