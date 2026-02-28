import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const locales = ['uz-Latn', 'uz-Cyrl', 'ru'];

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !locales.includes(locale as any)) {
        locale = 'uz-Latn';
    }

    return {
        locale: String(locale),
        messages: (await import(`../messages/${locale}.json`)).default
    };
});
