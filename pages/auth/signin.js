// import Head from 'next/head';
// import { useState } from 'react';
// import { signIn, useSession } from 'next-auth/react';
// import { useRouter } from 'next/router';
// import Link from 'next/link';
// import { t } from '@/lib/i18n';

// export default function SignInPage() {
//   const { status } = useSession();
//   const router = useRouter();
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);

//   if (status === 'authenticated') {
//     router.replace('/constituencies');
//     return null;
//   }

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     const result = await signIn('credentials', {
//       redirect: false,
//       email,
//       password
//     });

//     setLoading(false);

//     if (result?.error) {
//       setError(t(router.locale, 'invalidCredentials'));
//       return;
//     }

//     router.push('/constituencies');
//   }

//   return (
//     <>
//       <Head>
//         <title>{t(router.locale, 'signInTitle')} | MP Accountability Tracker</title>
//       </Head>
//       <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
//         <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
//           <h1 className="text-2xl font-bold mb-6">{t(router.locale, 'signIn')}</h1>
//           <form onSubmit={handleSubmit} className="space-y-4">
//             {error ? <p className="text-red-600 text-sm">{error}</p> : null}
//             <div>
//               <label className="block text-sm font-medium mb-1" htmlFor="email">
//                 {t(router.locale, 'email')}
//               </label>
//               <input
//                 id="email"
//                 className="w-full border border-gray-300 rounded px-3 py-2"
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 required
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium mb-1" htmlFor="password">
//                 {t(router.locale, 'password')}
//               </label>
//               <input
//                 id="password"
//                 className="w-full border border-gray-300 rounded px-3 py-2"
//                 type="password"
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 required
//               />
//             </div>
//             <button
//               type="submit"
//               className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
//               disabled={loading}
//             >
//               {loading ? `${t(router.locale, 'signIn')}...` : t(router.locale, 'signIn')}
//             </button>
//           </form>
//           <div className="mt-4 text-sm flex items-center justify-between">
//             <Link href="/auth/register" className="text-blue-700 hover:underline">
//               Create account
//             </Link>
//             <Link href="/auth/forgot-password" className="text-blue-700 hover:underline">
//               Forgot password
//             </Link>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

import Head from 'next/head';
import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { t } from '@/lib/i18n';

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/constituencies');
    }
  }, [status, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password
    });

    setLoading(false);

    if (result?.error) {
      setError(t(router.locale, 'invalidCredentials'));
      return;
    }

    router.replace('/constituencies');
  }

  return (
    <>
      <Head>
        <title>{t(router.locale, 'signInTitle')} | MP Accountability Tracker</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">

          <h1 className="text-2xl font-bold mb-6">
            {t(router.locale, 'signIn')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">

            {error && (
              <p className="text-red-600 text-sm">
                {error}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                {t(router.locale, 'email')}
              </label>

              <input
                id="email"
                className="w-full border border-gray-300 rounded px-3 py-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="password">
                {t(router.locale, 'password')}
              </label>

              <input
                id="password"
                className="w-full border border-gray-300 rounded px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading
                ? `${t(router.locale, 'signIn')}...`
                : t(router.locale, 'signIn')}
            </button>

          </form>

          <div className="mt-4 text-sm flex items-center justify-between">
            <Link
              href="/auth/register"
              className="text-blue-700 hover:underline"
            >
              Create account
            </Link>

            <Link
              href="/auth/forgot-password"
              className="text-blue-700 hover:underline"
            >
              Forgot password
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
