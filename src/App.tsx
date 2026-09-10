import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import { AppShell } from './components/layout/AppShell'
import SignIn from './pages/SignIn'
import Today from './pages/Today'
import AuditForm from './pages/AuditForm'
import ItemsForm from './pages/ItemsForm'
import Review from './pages/Review'
import Success from './pages/Success'
import Records from './pages/Records'
import RecordDetail from './pages/RecordDetail'
import Dashboard from './pages/Dashboard'
import Kitchens from './pages/Kitchens'
import KitchenDetail from './pages/KitchenDetail'
import Team from './pages/Team'
import Templates from './pages/Templates'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import type { Role } from './lib/types'

function RequireAuth() {
  const { user, ready } = useSession()
  if (!ready) return null
  if (!user) return <Navigate to="/signin" replace />
  return <Outlet />
}

function RequireRole({ roles }: { roles: Role[] }) {
  const { role } = useSession()
  if (!roles.includes(role)) return <Navigate to="/" replace />
  return <Outlet />
}

/** Staff land on Today; managers and admins land on the dashboard. */
function Home() {
  const { role } = useSession()
  return role === 'staff' ? <Today /> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />

              <Route path="audit/new" element={<AuditForm />} />
              <Route path="audit/review" element={<Review kind="audit" />} />
              <Route path="items/new" element={<ItemsForm />} />
              <Route path="items/review" element={<Review kind="items" />} />
              <Route path="submitted/:id" element={<Success />} />

              <Route path="records" element={<Records />} />
              <Route path="records/:id" element={<RecordDetail />} />
              <Route path="settings" element={<Settings />} />

              <Route element={<RequireRole roles={['manager', 'admin']} />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="kitchens" element={<Kitchens />} />
                <Route path="kitchens/:id" element={<KitchenDetail />} />
              </Route>

              <Route element={<RequireRole roles={['admin']} />}>
                <Route path="team" element={<Team />} />
                <Route path="templates" element={<Templates />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
