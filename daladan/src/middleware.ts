import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
    // A list of all locales that are supported
    locales: ['uz-Latn', 'uz-Cyrl', 'ru'],

    // Used when no locale matches
    defaultLocale: 'uz-Latn'
});

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
