import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { t } from '@/lib/i18n';

const menu = {
  admin: [
    { label: 'dashboard', href: '/constituencies' },
    { label: 'usConstituencies', href: '/us/constituencies' },
    { label: 'allIssues', href: '/issues' },
    { label: 'issuesMap', href: '/issues/map' },
    { label: 'mps', href: '/mps' },
    { label: 'dailyActivity', href: '/activities' },
    { label: 'education', href: '/education' },
    { label: 'promises', href: '/promises' },
    { label: 'feedback', href: '/feedback' },
    { label: 'adminUsers', href: '/admin/users' },
    { label: 'adminJobs', href: '/admin/jobs' },
    { label: 'adminIngestion', href: '/admin/ingestion' },
    { label: 'adminCorrections', href: '/admin/corrections' }
  ],
  agent: [
    { label: 'dashboard', href: '/constituencies' },
    { label: 'usConstituencies', href: '/us/constituencies' },
    { label: 'allIssues', href: '/issues' },
    { label: 'issuesMap', href: '/issues/map' },
    { label: 'mps', href: '/mps' },
    { label: 'dailyActivity', href: '/activities' },
    { label: 'education', href: '/education' }
  ],
  citizen: [
    { label: 'dashboard', href: '/constituencies' },
    { label: 'usConstituencies', href: '/us/constituencies' },
    { label: 'reportIssue', href: '/issues/new' },
    { label: 'myIssues', href: '/issues?mine=1' },
    { label: 'issuesMap', href: '/issues/map' },
    { label: 'mps', href: '/mps' },
    { label: 'dailyActivity', href: '/activities' },
    { label: 'education', href: '/education' }
  ]
};

export default function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.user?.role || 'citizen';
  const links = menu[role] || menu.citizen;

  return (
    <aside className="w-64 bg-white shadow-lg min-h-screen p-6 hidden md:block">
      <nav className="space-y-2">
        {links.map((link) => {
          const isActive = router.asPath === link.href || router.pathname === link.href;
          return (
            <Link
              key={`${link.label}-${link.href}`}
              href={link.href}
              className={`block rounded px-3 py-2 ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              {t(router.locale, link.label)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
