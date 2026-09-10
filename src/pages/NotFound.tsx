import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useSession } from '../lib/session'

export default function NotFound() {
  const nav = useNavigate()
  const { role } = useSession()

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="title-editorial text-[30px]">Page not found</h1>
      <p className="mt-2 text-[13px] text-ink-soft">
        The link may be out of date, or the record was removed.
      </p>
      <Button
        variant="ghost"
        className="mt-5"
        onClick={() => nav(role === 'staff' ? '/' : '/dashboard')}
      >
        {role === 'staff' ? 'Back to today' : 'Back to dashboard'}
      </Button>
    </div>
  )
}
