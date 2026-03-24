'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, BarChart3, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: '#0A0A0F' }}>
      <main className="flex-1">{children}</main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
        style={{
          borderColor: '#2A2A3A',
          background: 'rgba(10,10,15,0.85)',
        }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-6 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-1 px-4 py-2 transition-colors duration-200"
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  style={{ color: isActive ? '#4ADE80' : '#555570' }}
                />
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? '#4ADE80' : '#555570' }}
                >
                  {label}
                </span>
                {isActive && (
                  <div
                    className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full"
                    style={{ background: '#4ADE80' }}
                  />
                )}
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
