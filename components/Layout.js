import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

const noShellRoutes = ['/auth/signin'];

export default function Layout({ children }) {
  const router = useRouter();
  const showShell = !noShellRoutes.includes(router.pathname);

  if (!showShell) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
