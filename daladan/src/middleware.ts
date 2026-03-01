import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
    // Supported locales
    locales: ['uz-Latn', 'uz-Cyrl', 'ru'],
    // Default locale when no locale prefix is present
    defaultLocale: 'uz-Latn',
});

export const config = {
    // Match all paths except static files, API routes, and Next.js internals
    matcher: ['/((?!api|_next|_vercel|favicon.ico|.*\\..*).*)',],
};
