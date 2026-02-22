'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// All items shown in desktop sidebar
const sidebarItems = [
  { href: '/log', label: 'Log', icon: '✏️' },
  { href: '/dashboard', label: 'Dashboard', icon: '🎯' },
  { href: '/journal', label: 'Journal', icon: '📓' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/agent', label: 'AI Agent', icon: '✨' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

// Trimmed set for mobile bottom bar (space-constrained)
const mobileItems = [
  { href: '/log', label: 'Log', icon: '✏️' },
  { href: '/dashboard', label: 'Dashboard', icon: '🎯' },
  { href: '/journal', label: 'Journal', icon: '📓' },
  { href: '/agent', label: 'AI Agent', icon: '✨' },
  { href: '/analytics', label: 'Stats', icon: '📊' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0A0A18] border-r border-[#1E1E3F] p-4 fixed left-0 top-0">
        <div className="mb-8 mt-2">
          <span className="text-xl font-bold gradient-text">LevelUp Life</span>
          <p className="text-xs text-slate-500 mt-1">Gamify Your Existence</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {sidebarItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                pathname.startsWith(item.href)
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-[#1E1E3F]">
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A18] border-t border-[#1E1E3F] flex">
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-all',
              pathname.startsWith(item.href)
                ? 'text-violet-400'
                : 'text-slate-500'
            )}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
