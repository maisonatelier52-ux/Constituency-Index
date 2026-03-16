import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setDevToken('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(payload.error || 'Registration failed');
      return;
    }

    setMessage(payload.message || 'Registration successful');
    if (payload.devVerificationToken) {
      setDevToken(payload.devVerificationToken);
    }
  }

  return (
    <>
      <Head>
        <title>Register | MP Accountability Tracker</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Create Account</h1>
          <form onSubmit={onSubmit} className="space-y-3">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-green-700">{message}</p> : null}
            {devToken ? (
              <p className="text-xs text-gray-600 break-all">
                Dev verification token: <code>{devToken}</code>
              </p>
            ) : null}
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              type="password"
              minLength={8}
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <p className="text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-blue-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
