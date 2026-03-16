import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { t } from '@/lib/i18n';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated') {
      router.replace('/constituencies');
    } else {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  return <p className="p-6">{t(router.locale, 'loading')}</p>;
}
