import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying token...');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = router.query.token;
    if (!token || typeof token !== 'string') return;

    (async () => {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const payload = await res.json();
      if (!res.ok) {
        setStatus(payload.error || 'Verification failed');
        setOk(false);
        return;
      }

      setStatus(payload.message || 'Email verified successfully');
      setOk(true);
    })();
  }, [router.query.token]);

  return (
    <>
      <Head>
        <title>Verify Email | MP Accountability Tracker</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-semibold mb-2">Email Verification</h1>
          <p className={ok ? 'text-green-700' : 'text-gray-700'}>{status}</p>
          <div className="mt-4">
            <Link href="/auth/signin" className="text-blue-700 hover:underline">
              Continue to sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
