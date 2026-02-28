'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Signup() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'farmer' | 'driver' | 'retailer'>('farmer');
    const [language, setLanguage] = useState<'uz-Latn' | 'uz-Cyrl' | 'ru'>('uz-Latn');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Check if username is truly unique
        const { data: existingUser, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 means zero rows returned (which is what we want)
            setError(checkError.message);
            setLoading(false);
            return;
        }

        if (existingUser) {
            setError('Username is already taken. Please choose another one.');
            setLoading(false);
            return;
        }

        // 2. Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            // 3. Create profile in `profiles` table
            const isFarmer = role === 'farmer';
            const isDriver = role === 'driver';
            const isRetailer = role === 'retailer';

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: authData.user.id,
                        username: username,
                        is_farmer: isFarmer,
                        is_driver: isDriver,
                        is_retailer: isRetailer,
                        preferred_language: language,
                    },
                ]);

            if (profileError) {
                setError(profileError.message);
                setLoading(false);
                return;
            }

            // Success! Redirect directly to gateway
            router.push('/role-selection');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border-t-4 border-agro-green">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Join <span className="text-transparent bg-clip-text bg-gradient-to-r from-agro-green to-agro-green-lighter">Daladan</span>
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Create an account to connect with the harvest ecosystem.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSignup}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-field"
                                placeholder="Unique username"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-agro-green transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                                    ) : (
                                        <Eye className="h-5 w-5" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['farmer', 'driver', 'retailer'] as const).map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`py-2 px-3 text-sm font-medium rounded-md border transition-all ${role === r
                                            ? 'border-agro-green bg-green-50 text-agro-green'
                                            : 'border-gray-200 text-gray-600 hover:border-agro-green-light'
                                            }`}
                                    >
                                        {r.charAt(0).toUpperCase() + r.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as any)}
                                className="input-field"
                            >
                                <option value="uz-Latn">O'zbekcha (Lotin)</option>
                                <option value="uz-Cyrl">Ўзбекча (Кирилл)</option>
                                <option value="ru">Русский</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Creating account...' : 'Sign Up'}
                        </button>
                    </div>

                    <div className="text-sm text-center">
                        <a href="/login" className="font-medium text-harvest-amber hover:text-harvest-amber-dark transition-colors">
                            Already have an account? Log in here.
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
