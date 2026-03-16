import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'admin') {
      router.replace('/constituencies');
      return;
    }

    (async () => {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Failed to load users');
        setLoading(false);
        return;
      }
      setUsers(payload.users || []);
      setLoading(false);
    })();
  }, [session, status, router]);

  async function updateUser(userId, patch) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch })
    });
    const payload = await res.json();
    if (!res.ok) {
      alert(payload.error || 'Failed to update user');
      return;
    }

    setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, ...payload.user } : u)));
  }

  if (status === 'loading' || loading) {
    return <p className="text-sm text-gray-600">Loading users...</p>;
  }

  return (
    <>
      <Head>
        <title>Admin Users | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">User Admin Panel</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="overflow-x-auto bg-white rounded shadow border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Active</th>
                <th className="text-left p-3">Email Verified</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-gray-100">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <select
                      className="border border-gray-300 rounded px-2 py-1"
                      value={u.role}
                      onChange={(e) => updateUser(u._id, { role: e.target.value })}
                    >
                      <option value="citizen">citizen</option>
                      <option value="agent">agent</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(u.isActive)}
                        onChange={(e) => updateUser(u._id, { isActive: e.target.checked })}
                      />
                      <span>{u.isActive ? 'active' : 'disabled'}</span>
                    </label>
                  </td>
                  <td className="p-3">{u.emailVerifiedAt ? 'verified' : 'unverified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
