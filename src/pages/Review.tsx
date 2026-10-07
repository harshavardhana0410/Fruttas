import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  getAuditTemplate,
  getKitchens,
  readDraft,
  submitAudit,
  submitItemList,
} from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import type { AuditPayload, FormType, ItemsPayload } from '../lib/types'
import { FormShell } from '../components/layout/FormShell'
import { SubmissionDocument } from '../components/data/SubmissionDocument'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Sheet'
import { Skeleton } from '../components/ui/Feedback'
import { PageTitle } from '../components/ui/Card'

export default function Review({ kind }: { kind: FormType }) {
  const user = useUser()
  const nav = useNavigate()

  const { data: points } = useAsync(() => getAuditTemplate(), [])
  const { data: kitchens } = useAsync(() => getKitchens(), [])

  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const draft =
    kind === 'audit' ? readDraft<AuditPayload>('audit') : readDraft<ItemsPayload>('items')

  // Nothing to review — the draft expired or was discarded in another tab.
  if (!draft) return <Navigate to={kind === 'audit' ? '/audit/new' : '/items/new'} replace />

  if (!points || !kitchens) {
    return (
      <FormShell title="Review submission" actions={<span />}>
        <Skeleton className="h-40" />
      </FormShell>
    )
  }

  const kitchen = kitchens.find((k) => k.id === draft.payload.kitchenId)
  const isAudit = kind === 'audit'

  async function submit() {
    setBusy(true)
    try {
      const result = isAudit
        ? await submitAudit(draft!.payload as AuditPayload, user)
        : await submitItemList(draft!.payload as ItemsPayload, user)
      nav(`/submitted/${result.id}`, { replace: true })
    } catch {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <FormShell
      title="Review submission"
      wide={!isAudit}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
            Back to edit
          </Button>
          <Button variant="primary" onClick={() => setConfirming(true)} disabled={busy}>
            {busy ? 'Submitting' : 'Submit'}
          </Button>
        </>
      }
    >
      <PageTitle sub="Check this against what you saw in the kitchen before submitting.">
        Review submission
      </PageTitle>

      <SubmissionDocument
        meta={{
          formName: isAudit ? 'Kitchen Audit' : 'Item Check List',
          kitchen,
          clientId: kitchen?.clientId ?? draft.payload.clientId,
          date: draft.payload.date,
          submittedByName: user.name,
        }}
        points={points}
        answers={isAudit ? (draft.payload as AuditPayload).answers : undefined}
        sectionPhotos={isAudit ? (draft.payload as AuditPayload).sectionPhotos : undefined}
        pointPhotos={isAudit ? (draft.payload as AuditPayload).pointPhotos : undefined}
        items={isAudit ? undefined : (draft.payload as ItemsPayload).items}
      />

      <ConfirmDialog
        open={confirming}
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        title="Submit this checklist?"
        body="It cannot be edited afterwards."
        confirmLabel="Submit"
      />
    </FormShell>
  )
}
