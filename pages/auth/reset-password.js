import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const token = typeof router.query.token === 'string' ? router.query.token : '';
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(payload.error || 'Reset failed');
      return;
    }

    setMessage(payload.message || 'Password reset successful');
  }

  return (
    <>
      <Head>
        <title>Reset Password | MP Accountability Tracker</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
          <form onSubmit={onSubmit} className="space-y-3">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-green-700">{message}</p> : null}
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              type="password"
              minLength={8}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
          <p className="text-sm text-gray-600 mt-4">
            <Link href="/auth/signin" className="text-blue-700 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
