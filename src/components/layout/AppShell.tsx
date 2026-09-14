import { Component, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ClipboardText,
  DotsThree,
  Gear,
  GridFour,
  ListChecks,
  Storefront,
  User,
  Users,
  Sliders,
  Warning,
} from '@phosphor-icons/react'
import type { Role } from '../../lib/types'
import { useOnline, useSession } from '../../lib/session'
import { cx } from '../../lib/cx'
import { EmptyState } from '../ui/Feedback'
import { Sheet } from '../ui/Sheet'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  roles: Role[]
  end?: boolean
}

const SIZE = 20

const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: <ListChecks size={SIZE} />, roles: ['staff'], end: true },
  { to: '/dashboard', label: 'Dashboard', icon: <GridFour size={SIZE} />, roles: ['manager', 'admin'] },
  { to: '/records', label: 'Records', icon: <ClipboardText size={SIZE} />, roles: ['staff', 'manager', 'admin'] },
  { to: '/kitchens', label: 'Kitchens', icon: <Storefront size={SIZE} />, roles: ['manager', 'admin'] },
  { to: '/team', label: 'Team', icon: <Users size={SIZE} />, roles: ['admin'] },
  { to: '/templates', label: 'Templates', icon: <Sliders size={SIZE} />, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: <Gear size={SIZE} />, roles: ['manager', 'admin'] },
  { to: '/settings', label: 'Profile', icon: <User size={SIZE} />, roles: ['staff'] },
]

function itemsFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role))
}

export function AppShell() {
  const { role } = useSession()
  const online = useOnline()
  const items = itemsFor(role)
  const location = useLocation()

  // Forms supply their own sticky action bar, so the tab bar would double up.
  const immersive = /\/(new|review)$/.test(location.pathname)

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:border focus:border-hairline focus:bg-surface focus:px-3 focus:py-2 focus:text-[13px]"
      >
        Skip to content
      </a>

      <Sidebar items={items} />

      <div className="lg:pl-60">
        {!online && <OfflineBanner />}
        <main id="main" className={cx('mx-auto max-w-[1280px] px-5 py-6 lg:px-8 lg:py-8', !immersive && 'pb-24 lg:pb-8')}>
          <PageErrorBoundary key={location.pathname}>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>

      {!immersive && <BottomTabs items={items} />}
    </div>
  )
}

function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-hairline bg-canvas lg:block no-print">
      <div className="flex h-14 items-center border-b border-hairline px-5">
        <span className="font-serif text-[17px] tracking-[0.14em]">FRUTTA</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'flex h-10 items-center gap-2.5 rounded-control px-3 text-[14px] transition-colors',
                isActive ? 'bg-sunken font-medium text-ink' : 'text-ink-soft hover:bg-sunken',
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <p className="absolute bottom-5 left-5 right-5 text-[11px] leading-[1.5] text-ink-mute">
        Kitchen Operations
        <br />
        Version 0.1
      </p>
    </aside>
  )
}

function BottomTabs({ items }: { items: NavItem[] }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()

  // Five slots fit a phone. Past that, the rest sit behind "More" instead of
  // being cut off: slicing to four left admins with no way to reach
  // Templates or Settings on mobile.
  const overflow = items.length > 5
  const tabs = overflow ? items.slice(0, 4) : items
  const extra = overflow ? items.slice(4) : []
  const moreActive = extra.some((i) => pathname.startsWith(i.to))

  const tabClass = (active: boolean) =>
    cx('flex flex-col items-center justify-center gap-1 transition-colors', active ? 'text-ink' : 'text-ink-soft')

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface lg:hidden no-print"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${tabs.length + (overflow ? 1 : 0)}, 1fr)` }}
        >
          {tabs.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) => tabClass(isActive)}
            >
              {item.icon}
              <span className="text-[10px] uppercase tracking-[0.06em]">{item.label}</span>
            </NavLink>
          ))}

          {overflow && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={tabClass(moreActive)}
            >
              <DotsThree size={SIZE} />
              <span className="text-[10px] uppercase tracking-[0.06em]">More</span>
            </button>
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav className="flex flex-col gap-0.5" aria-label="More pages">
          {extra.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex h-12 items-center gap-3 rounded-control px-3 text-[15px] transition-colors',
                  isActive ? 'bg-sunken font-medium text-ink' : 'text-ink-soft hover:bg-sunken',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </Sheet>
    </>
  )
}

export function OfflineBanner() {
  return (
    <div
      role="status"
      className="animate-slide-down bg-warn-bg px-5 py-2 text-[12px] text-warn-fg lg:px-8"
    >
      Offline — your entries are saved on this device and will sync automatically.
    </div>
  )
}

/**
 * Shows why a page failed to load (useAsync rethrows) instead of leaving a
 * skeleton on screen forever. Keyed by path, so moving to another page
 * clears it.
 */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <EmptyState
        icon={<Warning size={24} />}
        title="This page could not load"
        body={this.state.error.message}
        action={{ label: 'Try again', onClick: () => this.setState({ error: null }) }}
      />
    )
  }
}
