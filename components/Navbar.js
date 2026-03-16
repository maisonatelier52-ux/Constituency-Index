import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Navbar() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const { data } = useSWR(user ? '/api/notifications' : null, fetcher);

  const unreadCount = data?.unreadCount || 0;

  function handleLocaleChange(e) {
    const nextLocale = e.target.value;
    router.push(router.asPath, router.asPath, { locale: nextLocale });
  }

  return (
    <header className="w-full bg-white shadow flex items-center justify-between px-6 py-4 gap-4">
      <h1 className="text-xl sm:text-2xl font-semibold">{t(router.locale, 'appTitle')}</h1>
      <div className="flex items-center gap-3">
        <select
          aria-label="Select language"
          value={router.locale}
          onChange={handleLocaleChange}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="ml">Malayalam</option>
        </select>

        {user ? (
          <>
            <Link href="/notifications" className="text-sm text-blue-700 hover:text-blue-800">
              {t(router.locale, 'notifications')}
              {unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Link>
            <span className="text-gray-700 text-sm sm:text-base">
              {t(router.locale, 'hello')}, {user.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              type="button"
            >
              {t(router.locale, 'logout')}
            </button>
          </>
        ) : (
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            {t(router.locale, 'login')}
          </Link>
        )}
      </div>
    </header>
  );
}
