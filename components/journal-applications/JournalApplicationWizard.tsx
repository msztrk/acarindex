'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PublicationFrequency } from '@prisma/client'
import {
  APPLICATION_DECLARATION_LABELS,
  buildDeclarationAcceptanceRecord,
  type DeclarationKey,
} from '@/lib/journal-applications/declarations'
import {
  DUPLICATE_CONTINUE_ALTERNATIVES,
  type DuplicateFlag,
  type DuplicatePrecheckResult,
} from '@/lib/journal-applications/duplicate-precheck'
import { PUBLICATION_FREQUENCY_LABELS } from '@/lib/journal-applications/types'
import { FREQUENCY_EXPECTED_ISSUES_PER_YEAR } from '@/lib/journal-applications/publication-schedule'
import type { SerializedJournalApplication } from '@/lib/journal-applications/serialize'
import {
  validateWizardStep,
  WIZARD_STEP_TITLES,
  type PrivateContactDraft,
  type WizardStep,
} from '@/lib/journal-applications/step-validation'

type CategoryOption = { id: number; name_tr: string | null; name_en: string | null }

type LoadedData = {
  contentApplication: {
    id: string
    status: string
    title: string
  }
  journalApplication: SerializedJournalApplication
  privateContact: PrivateContactDraft
}

type Props = {
  contentApplicationId: string
  initialData: LoadedData
  categories: CategoryOption[]
}

const MONTH_LABELS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

const JOURNAL_TYPES = [
  'Araştırma dergisi',
  'Hakemli dergi',
  'Mesleki dergi',
  'Popüler bilim dergisi',
  'Diğer',
]

function emptyForm(data: LoadedData) {
  const j = data.journalApplication
  return {
    nameTr: j.nameTr ?? '',
    nameEn: j.nameEn ?? '',
    abbreviation: j.abbreviation ?? '',
    publisherInstitutionId: j.publisherInstitutionId,
    publisherInstitutionName: j.publisherInstitutionName,
    proposedInstitutionName: j.proposedInstitutionName ?? '',
    journalType: j.journalType ?? '',
    publishingPlatform: j.publishingPlatform ?? '',
    websiteUrl: j.websiteUrl ?? '',
    pIssn: j.pIssn ?? '',
    eIssn: j.eIssn ?? '',
    firstPublicationYear: j.firstPublicationYear?.toString() ?? '',
    publicationFrequency: (j.publicationFrequency as PublicationFrequency | null) ?? null,
    publicationMonths: j.publicationMonths ?? [],
    correspondenceAddress: j.correspondenceAddress ?? '',
    editorName: j.editorName ?? '',
    editorTitle: j.editorTitle ?? '',
    editorEmail: j.editorEmail ?? '',
    editorOrcid: j.editorOrcid ?? '',
    editorProfileUrl: j.editorProfileUrl ?? '',
    officialJournalUrl: j.officialJournalUrl ?? '',
    editorialBoardUrl: j.editorialBoardUrl ?? '',
    latestIssueUrl: j.latestIssueUrl ?? '',
    platformProfileUrl: j.platformProfileUrl ?? '',
    publisherPageUrl: j.publisherPageUrl ?? '',
    keywords: j.keywords ?? [],
    keywordInput: '',
    subjectAreas: j.subjectAreas.map((a) => ({
      categoryId: a.categoryId,
      level: a.level as 'primary' | 'secondary',
      categoryNameTr: a.categoryNameTr,
    })),
    declarationChecks: {
      criteria: Boolean(j.declarationAcceptance?.criteriaAcceptedAt),
      standards: Boolean(j.declarationAcceptance?.standardsAcceptedAt),
      privacyNotice: Boolean(j.declarationAcceptance?.privacyNoticeAcceptedAt),
      imageRights: Boolean(j.declarationAcceptance?.imageRightsAcceptedAt),
      informationAccuracy: Boolean(j.declarationAcceptance?.informationAccuracyConfirmedAt),
    },
    privateContact: { ...data.privateContact },
    duplicateContinueReason: j.duplicateContinueReason ?? '',
  }
}

export function JournalApplicationWizard({ contentApplicationId, initialData, categories }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(1)
  const [form, setForm] = useState(() => emptyForm(initialData))
  const [stepIssues, setStepIssues] = useState<Record<number, { field: string; message: string }[]>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitErrors, setSubmitErrors] = useState<Array<{ field: string; error: string }>>([])
  const [precheck, setPrecheck] = useState<DuplicatePrecheckResult | null>(null)
  const [institutionQuery, setInstitutionQuery] = useState('')
  const [institutionResults, setInstitutionResults] = useState<
    Array<{ id: string; nameTr: string; nameEn: string | null }>
  >([])

  const expectedMonths = form.publicationFrequency
    ? FREQUENCY_EXPECTED_ISSUES_PER_YEAR[form.publicationFrequency]
    : null

  const wizardFormState = useMemo(
    () => ({
      nameTr: form.nameTr,
      nameEn: form.nameEn,
      abbreviation: form.abbreviation,
      publisherInstitutionId: form.publisherInstitutionId ? BigInt(form.publisherInstitutionId) : null,
      proposedInstitutionName: form.proposedInstitutionName,
      journalType: form.journalType,
      publishingPlatform: form.publishingPlatform,
      websiteUrl: form.websiteUrl,
      pIssn: form.pIssn,
      eIssn: form.eIssn,
      firstPublicationYear: form.firstPublicationYear ? Number(form.firstPublicationYear) : null,
      publicationFrequency: form.publicationFrequency,
      publicationMonths: form.publicationMonths,
      correspondenceAddress: form.correspondenceAddress,
      editorName: form.editorName,
      editorTitle: form.editorTitle,
      editorEmail: form.editorEmail,
      editorOrcid: form.editorOrcid,
      editorProfileUrl: form.editorProfileUrl,
      officialJournalUrl: form.officialJournalUrl,
      editorialBoardUrl: form.editorialBoardUrl,
      latestIssueUrl: form.latestIssueUrl,
      platformProfileUrl: form.platformProfileUrl,
      publisherPageUrl: form.publisherPageUrl,
      keywords: form.keywords,
      subjectAreas: form.subjectAreas.map((a) => ({
        categoryId: BigInt(a.categoryId),
        level: a.level,
      })),
      declarationAcceptance: buildDeclarationAcceptanceRecord({
        criteriaAcceptedAt: form.declarationChecks.criteria ? new Date() : null,
        standardsAcceptedAt: form.declarationChecks.standards ? new Date() : null,
        privacyNoticeAcceptedAt: form.declarationChecks.privacyNotice ? new Date() : null,
        imageRightsAcceptedAt: form.declarationChecks.imageRights ? new Date() : null,
        informationAccuracyConfirmedAt: form.declarationChecks.informationAccuracy ? new Date() : null,
      }),
      privateContact: form.privateContact,
      duplicateContinueReason: form.duplicateContinueReason,
    }),
    [form],
  )

  const getCsrf = useCallback(async () => {
    const res = await fetch('/api/auth/csrf')
    const data = await res.json()
    return data.csrfToken as string
  }, [])

  const buildPayload = useCallback(() => {
    const now = new Date().toISOString()
    const declarationAcceptance = {
      criteriaAcceptedAt: form.declarationChecks.criteria ? now : null,
      standardsAcceptedAt: form.declarationChecks.standards ? now : null,
      privacyNoticeAcceptedAt: form.declarationChecks.privacyNotice ? now : null,
      imageRightsAcceptedAt: form.declarationChecks.imageRights ? now : null,
      informationAccuracyConfirmedAt: form.declarationChecks.informationAccuracy ? now : null,
    }

    return {
      journal: {
        nameTr: form.nameTr || null,
        nameEn: form.nameEn || null,
        abbreviation: form.abbreviation || null,
        publisherInstitutionId: form.publisherInstitutionId,
        proposedInstitutionName: form.proposedInstitutionName || null,
        journalType: form.journalType || null,
        publishingPlatform: form.publishingPlatform || null,
        websiteUrl: form.websiteUrl || null,
        pIssn: form.pIssn || null,
        eIssn: form.eIssn || null,
        firstPublicationYear: form.firstPublicationYear ? Number(form.firstPublicationYear) : null,
        publicationFrequency: form.publicationFrequency,
        publicationMonths: form.publicationMonths,
        correspondenceAddress: form.correspondenceAddress || null,
        editorName: form.editorName || null,
        editorTitle: form.editorTitle || null,
        editorEmail: form.editorEmail || null,
        editorOrcid: form.editorOrcid || null,
        editorProfileUrl: form.editorProfileUrl || null,
        officialJournalUrl: form.officialJournalUrl || null,
        editorialBoardUrl: form.editorialBoardUrl || null,
        latestIssueUrl: form.latestIssueUrl || null,
        platformProfileUrl: form.platformProfileUrl || null,
        publisherPageUrl: form.publisherPageUrl || null,
        keywords: form.keywords,
      },
      subjectAreas: form.subjectAreas.map((a) => ({
        categoryId: a.categoryId,
        level: a.level,
      })),
      declarationAcceptance,
      privateContact: form.privateContact,
      duplicateContinueReason: form.duplicateContinueReason || null,
    }
  }, [form])

  const saveDraft = useCallback(async () => {
    setSaveState('saving')
    setError(null)
    try {
      const csrfToken = await getCsrf()
      const res = await fetch(`/api/applications/journal/${contentApplicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(buildPayload()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveState('error')
        setError(data.error ?? 'Taslak kaydedilemedi.')
        return false
      }
      setSaveState('saved')
      router.refresh()
      return true
    } catch {
      setSaveState('error')
      setError('Bağlantı hatası.')
      return false
    }
  }, [buildPayload, contentApplicationId, getCsrf, router])

  const runPrecheck = useCallback(async () => {
    try {
      const csrfToken = await getCsrf()
      const res = await fetch(`/api/applications/journal/${contentApplicationId}/precheck`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPrecheck(data.precheck as DuplicatePrecheckResult)
      }
    } catch {
      /* preview optional */
    }
  }, [contentApplicationId, getCsrf])

  useEffect(() => {
    if (step === 10) {
      void runPrecheck()
    }
  }, [step, runPrecheck])

  useEffect(() => {
    if (institutionQuery.trim().length < 2) {
      setInstitutionResults([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/institutions/search?q=${encodeURIComponent(institutionQuery)}`)
      const data = await res.json().catch(() => ({ institutions: [] }))
      setInstitutionResults(data.institutions ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [institutionQuery])

  function goToStep(next: WizardStep) {
    const issues = validateWizardStep(step, wizardFormState)
    setStepIssues((prev) => ({ ...prev, [step]: issues }))
    setStep(next)
  }

  async function handleNext() {
    await saveDraft()
    if (step < 10) goToStep((step + 1) as WizardStep)
  }

  async function handleSubmit() {
    setSubmitErrors([])
    setError(null)
    setSubmitState('submitting')
    const saved = await saveDraft()
    if (!saved) {
      setSubmitState('idle')
      return
    }
    try {
      const csrfToken = await getCsrf()
      const res = await fetch(`/api/applications/journal/${contentApplicationId}/submit`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.errors) {
          setSubmitErrors(data.errors)
        } else {
          setError(data.error ?? 'Gönderilemedi.')
        }
        setSubmitState('idle')
        return
      }
      router.push(`/hesabim/basvurular/${contentApplicationId}`)
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
      setSubmitState('idle')
    }
  }

  function toggleMonth(month: number) {
    setForm((prev) => {
      const has = prev.publicationMonths.includes(month)
      const publicationMonths = has
        ? prev.publicationMonths.filter((m) => m !== month)
        : [...prev.publicationMonths, month].sort((a, b) => a - b)
      return { ...prev, publicationMonths }
    })
  }

  function addKeyword() {
    const value = form.keywordInput.trim()
    if (!value) return
    setForm((prev) => ({
      ...prev,
      keywords: [...prev.keywords, value],
      keywordInput: '',
    }))
  }

  function addSubjectArea(categoryId: string, level: 'primary' | 'secondary') {
    if (form.subjectAreas.some((a) => a.categoryId === categoryId)) return
    const cat = categories.find((c) => String(c.id) === categoryId)
    setForm((prev) => ({
      ...prev,
      subjectAreas: [
        ...prev.subjectAreas,
        { categoryId, level, categoryNameTr: cat?.name_tr ?? null },
      ],
    }))
  }

  function renderIssues(currentStep: number) {
    const issues = stepIssues[currentStep]
    if (!issues?.length) return null
    return (
      <ul className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
        {issues.map((issue) => (
          <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    )
  }

  function renderDuplicateFlags(flags: DuplicateFlag[]) {
    if (!flags.length) {
      return <p className="text-sm text-muted-foreground">Benzer kayıt tespit edilmedi.</p>
    }
    return (
      <ul className="space-y-3">
        {flags.map((flag, idx) => (
          <li key={idx} className="rounded-md border p-3 text-sm">
            <p className="font-medium">
              {flag.matchLevel === 'exact'
                ? 'Birebir eşleşme'
                : flag.matchLevel === 'strong'
                  ? 'Güçlü benzerlik'
                  : 'Zayıf benzerlik'}
              {' — '}
              {flag.reason}
            </p>
            {flag.displayName && (
              <p className="text-muted-foreground mt-1">Kayıt: {flag.displayName}</p>
            )}
            {flag.matchLevel === 'exact' && !flag.canContinue && (
              <ul className="mt-2 space-y-1">
                {DUPLICATE_CONTINUE_ALTERNATIVES.map((alt) => (
                  <li key={alt.id}>
                    <Link href={alt.href} className="text-primary hover:underline">
                      {alt.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/hesabim/basvurular" className="text-sm text-primary hover:underline">
          ← Başvurularım
        </Link>
        <h2 className="text-xl font-semibold mt-2">Yeni dergi başvurusu</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Adım {step}/10 — {WIZARD_STEP_TITLES[step]}
        </p>
      </div>

      <ol className="flex flex-wrap gap-1 text-xs">
        {(Object.keys(WIZARD_STEP_TITLES) as unknown as WizardStep[]).map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => goToStep(s)}
              className={`rounded px-2 py-1 ${
                s === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </button>
          </li>
        ))}
      </ol>

      {renderIssues(step)}

      {step === 1 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dergi adı (Türkçe) *</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.nameTr}
              onChange={(e) => setForm((p) => ({ ...p, nameTr: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dergi adı (İngilizce)</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.nameEn}
              onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kısaltma</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.abbreviation}
              onChange={(e) => setForm((p) => ({ ...p, abbreviation: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dergi türü</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.journalType}
              onChange={(e) => setForm((p) => ({ ...p, journalType: e.target.value }))}
            >
              <option value="">Seçin</option>
              {JOURNAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">P-ISSN</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="XXXX-XXXX"
              value={form.pIssn}
              onChange={(e) => setForm((p) => ({ ...p, pIssn: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-ISSN</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="XXXX-XXXX"
              value={form.eIssn}
              onChange={(e) => setForm((p) => ({ ...p, eIssn: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">İlk yayın yılı *</label>
            <input
              type="number"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.firstPublicationYear}
              onChange={(e) => setForm((p) => ({ ...p, firstPublicationYear: e.target.value }))}
            />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Yayıncı kurum ara</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={institutionQuery}
              onChange={(e) => setInstitutionQuery(e.target.value)}
              placeholder="Kurum adı yazın"
            />
            {form.publisherInstitutionName && (
              <p className="text-sm mt-1">
                Seçili: {form.publisherInstitutionName}{' '}
                <button
                  type="button"
                  className="text-primary text-xs"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      publisherInstitutionId: null,
                      publisherInstitutionName: null,
                    }))
                  }
                >
                  Kaldır
                </button>
              </p>
            )}
            {institutionResults.length > 0 && (
              <ul className="mt-2 border rounded-md divide-y text-sm">
                {institutionResults.map((inst) => (
                  <li key={inst.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted"
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          publisherInstitutionId: inst.id,
                          publisherInstitutionName: inst.nameTr,
                          proposedInstitutionName: '',
                        }))
                        setInstitutionQuery('')
                        setInstitutionResults([])
                      }}
                    >
                      {inst.nameTr}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Önerilen kurum adı</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.proposedInstitutionName}
              disabled={Boolean(form.publisherInstitutionId)}
              onChange={(e) => setForm((p) => ({ ...p, proposedInstitutionName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yayın platformu</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Örn. DergiPark, OJS"
              value={form.publishingPlatform}
              onChange={(e) => setForm((p) => ({ ...p, publishingPlatform: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Web sitesi</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
            />
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Yayın sıklığı *</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.publicationFrequency ?? ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  publicationFrequency: (e.target.value || null) as PublicationFrequency | null,
                  publicationMonths: [],
                }))
              }
            >
              <option value="">Seçin</option>
              {(Object.keys(PUBLICATION_FREQUENCY_LABELS) as PublicationFrequency[]).map((freq) => (
                <option key={freq} value={freq}>
                  {PUBLICATION_FREQUENCY_LABELS[freq]}
                </option>
              ))}
            </select>
          </div>
          {expectedMonths != null && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {expectedMonths} yayın ayı seçin
              </p>
              <div className="flex flex-wrap gap-2">
                {MONTH_LABELS.map((label, idx) => {
                  const month = idx + 1
                  const selected = form.publicationMonths.includes(month)
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleMonth(month)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        selected ? 'bg-primary text-primary-foreground' : 'bg-background'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {expectedMonths == null && form.publicationFrequency && (
            <p className="text-sm text-muted-foreground">
              Sürekli veya düzensiz yayın için ay seçimi gerekmez.
            </p>
          )}
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Konu alanları</label>
            <div className="flex gap-2">
              <select
                id="subject-category"
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Kategori seçin
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_tr}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => {
                  const select = document.getElementById('subject-category') as HTMLSelectElement
                  if (select.value) addSubjectArea(select.value, 'primary')
                }}
              >
                Birincil ekle
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => {
                  const select = document.getElementById('subject-category') as HTMLSelectElement
                  if (select.value) addSubjectArea(select.value, 'secondary')
                }}
              >
                İkincil ekle
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {form.subjectAreas.map((area) => (
                <li key={area.categoryId} className="flex justify-between rounded border px-2 py-1">
                  <span>
                    {area.categoryNameTr ?? area.categoryId} ({area.level === 'primary' ? 'Birincil' : 'İkincil'})
                  </span>
                  <button
                    type="button"
                    className="text-destructive text-xs"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        subjectAreas: p.subjectAreas.filter((a) => a.categoryId !== area.categoryId),
                      }))
                    }
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Anahtar kelimeler (en az 3)</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                value={form.keywordInput}
                onChange={(e) => setForm((p) => ({ ...p, keywordInput: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              />
              <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={addKeyword}>
                Ekle
              </button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {form.keywords.map((kw) => (
                <li key={kw} className="rounded-full bg-muted px-2 py-1 text-xs flex items-center gap-1">
                  {kw}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, keywords: p.keywords.filter((k) => k !== kw) }))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4">
          {(
            [
              ['editorName', 'Editör adı'],
              ['editorTitle', 'Unvan'],
              ['editorEmail', 'E-posta'],
              ['editorOrcid', 'ORCID'],
              ['editorProfileUrl', 'Profil URL'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
        </section>
      )}

      {step === 7 && (
        <section className="space-y-4">
          {(
            [
              ['contactName', 'İletişim kişisi *'],
              ['contactRole', 'Görev'],
              ['contactEmail', 'E-posta *'],
              ['workPhone', 'İş telefonu'],
              ['mobilePhone', 'Cep telefonu'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.privateContact[key] ?? ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    privateContact: { ...p.privateContact, [key]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </section>
      )}

      {step === 8 && (
        <section className="space-y-4">
          {(
            [
              ['officialJournalUrl', 'Resmî dergi sayfası'],
              ['editorialBoardUrl', 'Editör kurulu sayfası'],
              ['latestIssueUrl', 'Son sayı bağlantısı'],
              ['platformProfileUrl', 'Platform profil URL'],
              ['publisherPageUrl', 'Yayıncı sayfası'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="url"
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
        </section>
      )}

      {step === 9 && (
        <section className="rounded-md border border-dashed p-6 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Kapak ve belgeler (Faz B4)</p>
          <p>
            Dosya yükleme altyapısı bir sonraki fazda devreye girecek. Bu adımda kapak görseli ve
            destekleyici belgeler yüklenemez; başvuruyu taslak olarak kaydedip B4 sonrası
            tamamlayabilirsiniz.
          </p>
          <div className="rounded-md bg-muted/50 border p-8 text-center opacity-60">
            Yükleme alanı devre dışı
          </div>
        </section>
      )}

      {step === 10 && (
        <section className="space-y-6">
          <div className="rounded-md border p-4 space-y-2 text-sm">
            <h3 className="font-medium">Önizleme</h3>
            <p>
              <strong>{form.nameTr || '—'}</strong>
              {form.nameEn ? ` / ${form.nameEn}` : ''}
            </p>
            <p>
              ISSN: {form.pIssn || '—'} {form.eIssn ? `/ ${form.eIssn}` : ''}
            </p>
            <p>
              Kurum:{' '}
              {form.publisherInstitutionName || form.proposedInstitutionName || '—'}
            </p>
            <p>
              Sıklık:{' '}
              {form.publicationFrequency
                ? PUBLICATION_FREQUENCY_LABELS[form.publicationFrequency]
                : '—'}
            </p>
            <p>Anahtar kelimeler: {form.keywords.join(', ') || '—'}</p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Mükerrer kayıt kontrolü</h3>
            {renderDuplicateFlags(precheck?.flags ?? [])}
            {precheck?.requiresContinueReason && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">
                  Devam gerekçesi (benzer kayıt tespit edildi)
                </label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm min-h-24"
                  value={form.duplicateContinueReason}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, duplicateContinueReason: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Beyanlar</h3>
            {(Object.keys(APPLICATION_DECLARATION_LABELS) as DeclarationKey[]).map((key) => (
              <label key={key} className="flex gap-2 text-sm items-start">
                <input
                  type="checkbox"
                  checked={form.declarationChecks[key]}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      declarationChecks: {
                        ...p.declarationChecks,
                        [key]: e.target.checked,
                      },
                    }))
                  }
                />
                <span>{APPLICATION_DECLARATION_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {submitErrors.length > 0 && (
        <ul className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive space-y-1">
          {submitErrors.map((e) => (
            <li key={`${e.field}-${e.error}`}>
              {e.field}: {e.error}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saveState === 'saved' && (
        <p className="text-sm text-muted-foreground">Taslak kaydedildi.</p>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        {step > 1 && (
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm"
            onClick={() => goToStep((step - 1) as WizardStep)}
          >
            Geri
          </button>
        )}
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm"
          disabled={saveState === 'saving'}
          onClick={() => void saveDraft()}
        >
          {saveState === 'saving' ? 'Kaydediliyor…' : 'Taslak kaydet'}
        </button>
        {step < 10 ? (
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => void handleNext()}
          >
            İleri
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={submitState === 'submitting' || precheck?.canSubmit === false}
            onClick={() => void handleSubmit()}
          >
            {submitState === 'submitting' ? 'Gönderiliyor…' : 'Başvuruyu gönder'}
          </button>
        )}
      </div>
    </div>
  )
}
