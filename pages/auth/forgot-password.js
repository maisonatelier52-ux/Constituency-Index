import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setDevToken('');

    const res = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const payload = await res.json();
    setLoading(false);
    setMessage(payload.message || 'Request submitted');
    if (payload.devResetToken) setDevToken(payload.devResetToken);
  }

  return (
    <>
      <Head>
        <title>Forgot Password | MP Accountability Tracker</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          {message ? <p className="text-sm text-gray-700 mt-3">{message}</p> : null}
          {devToken ? (
            <p className="text-xs text-gray-600 mt-2 break-all">
              Dev reset token: <code>{devToken}</code>
            </p>
          ) : null}
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
