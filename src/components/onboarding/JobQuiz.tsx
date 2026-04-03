'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

// ─── типы ────────────────────────────────────────────────────────────────────

type JobRow = Database['public']['Tables']['jobs']['Row']

interface ContextQuestion {
  id: string
  question: string
  options: string[]
}

type JobKey = 'gaming' | 'streaming' | 'creator' | 'work' | 'company'

interface JobTile {
  key: JobKey
  title: string
  hint: string
}

interface JobContext {
  job: JobKey
  jobId: string | null
  answers: Record<string, string>
  budget: number
  priorities: string[]
}

// ─── константы ───────────────────────────────────────────────────────────────

const JOB_TILES: JobTile[] = [
  { key: 'gaming',    title: 'Играть в игры',       hint: 'соревнования, погружение, с друзьями' },
  { key: 'streaming', title: 'Стримить',             hint: 'трансляции, сообщество, шоу' },
  { key: 'creator',   title: 'Создавать контент',    hint: 'дизайн, видео, 3D' },
  { key: 'work',      title: 'Работать эффективно',  hint: 'офис, удалёнка, рутина' },
  { key: 'company',   title: 'Для бизнеса',          hint: 'команда, офис, B2B' },
]

// имена jobs в Supabase совпадают с tile.title
const JOB_NAME_MAP: Record<JobKey, string> = {
  gaming:    'Играть в игры',
  streaming: 'Стримить',
  creator:   'Создавать контент',
  work:      'Работать эффективно',
  company:   'Для бизнеса',
}

const PRIORITIES = ['Надёжный бренд', 'Лучшая цена', 'Долгий срок службы']

const BUDGET_MIN = 5_000
const BUDGET_MAX = 200_000

function formatBudget(value: number): string {
  return value.toLocaleString('ru-RU') + ' ₽'
}

// ─── компонент ───────────────────────────────────────────────────────────────

export default function JobQuiz() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedJob, setSelectedJob] = useState<JobKey | null>(null)
  const [jobRow, setJobRow] = useState<JobRow | null>(null)
  const [questions, setQuestions] = useState<ContextQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [budget, setBudget] = useState(30_000)
  const [priorities, setPriorities] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // ── шаг 1: выбрать задачу ────────────────────────────────────────────────

  const handleJobSelect = useCallback(async (key: JobKey) => {
    setSelectedJob(key)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('name', JOB_NAME_MAP[key])
        .single()

      if (data) {
        setJobRow(data)
        const raw = data.context_questions
        const qs: ContextQuestion[] = Array.isArray(raw)
          ? (raw as unknown as ContextQuestion[]).slice(0, 2)
          : []
        setQuestions(qs)
      }
    } catch {
      // Supabase недоступен — идём дальше без вопросов
      setQuestions([])
    } finally {
      setLoading(false)
      setStep(2)
    }
  }, [])

  // ── шаг 2: ответить на вопросы ───────────────────────────────────────────

  const handleAnswer = useCallback((questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }))
  }, [])

  const canProceedStep2 = questions.length === 0 ||
    questions.every(q => answers[q.id] !== undefined)

  // ── шаг 3: бюджет и приоритеты ──────────────────────────────────────────

  const togglePriority = useCallback((p: string) => {
    setPriorities(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }, [])

  // ── финиш ────────────────────────────────────────────────────────────────

  const handleFinish = useCallback(() => {
    const context: JobContext = {
      job: selectedJob!,
      jobId: jobRow?.id ?? null,
      answers,
      budget,
      priorities,
    }
    localStorage.setItem('job_context', JSON.stringify(context))
    router.push('/catalog')
  }, [selectedJob, jobRow, answers, budget, priorities, router])

  // ── прогресс-бар ─────────────────────────────────────────────────────────

  const progressPct = step === 1 ? '33%' : step === 2 ? '66%' : '100%'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-[390px] flex flex-col flex-1">

        {/* Прогресс-бар */}
        <div className="mb-8">
          <div className="flex justify-between mb-2" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
            <span>Шаг {step} из 3</span>
            <span>
              {step === 1 && 'Выбор задачи'}
              {step === 2 && 'Уточнение'}
              {step === 3 && 'Бюджет'}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: progressPct }} />
          </div>
        </div>

        {/* ── Шаг 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 className="font-heading mb-1" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
              Что хотите сделать?
            </h1>
            <p className="mb-6 font-body" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Выберите главную задачу — подберём подходящую технику
            </p>

            <div className="grid grid-cols-2 gap-3">
              {JOB_TILES.map(tile => (
                <button
                  key={tile.key}
                  onClick={() => handleJobSelect(tile.key)}
                  disabled={loading}
                  className="flex flex-col items-start p-4 text-left transition-all duration-150 disabled:opacity-50 active:scale-[0.97]"
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--border)',
                    background: 'var(--bg-primary)',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.borderColor = 'var(--brand-primary)'
                    el.style.background = 'linear-gradient(135deg, #EEF2FF, #FDF2F8)'
                    el.style.boxShadow = 'var(--shadow-md)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.borderColor = 'var(--border)'
                    el.style.background = 'var(--bg-primary)'
                    el.style.boxShadow = 'none'
                  }}
                >
                  <div className="icon-box mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {tile.key === 'gaming'    && <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 12h.01M18 12h.01"/></>}
                      {tile.key === 'streaming' && <><circle cx="12" cy="12" r="2"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49M16.24 7.76a6 6 0 0 1 0 8.49"/></>}
                      {tile.key === 'creator'   && <><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>}
                      {tile.key === 'work'      && <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></>}
                      {tile.key === 'company'   && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}
                    </svg>
                  </div>
                  <span className="font-heading leading-tight" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {tile.title}
                  </span>
                  <span className="font-body mt-1 leading-tight" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {tile.hint}
                  </span>
                </button>
              ))}
            </div>

            {loading && (
              <p className="text-center mt-6 font-body" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Загружаем вопросы…</p>
            )}
          </>
        )}

        {/* ── Шаг 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <button
              onClick={() => setStep(1)}
              className="flex items-center mb-6 -ml-1 transition-colors font-body"
              style={{ fontSize: 13, color: 'var(--text-tertiary)' }}
            >
              <span className="mr-1">←</span> Назад
            </button>

            <h1 className="font-heading mb-1" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
              Расскажите подробнее
            </h1>
            <p className="mb-6 font-body" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Пара уточняющих вопросов
            </p>

            {questions.length === 0 ? (
              <p className="mb-6 font-body" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                Вопросы не найдены — переходим к бюджету.
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {questions.map(q => (
                  <div key={q.id}>
                    <p className="mb-3 font-body" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{q.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map(opt => {
                        const selected = answers[q.id] === opt
                        return (
                          <button
                            key={opt}
                            onClick={() => handleAnswer(q.id, opt)}
                            className={`pill ${selected ? 'active' : ''}`}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-auto pt-8">
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="btn-primary w-full"
                style={{ borderRadius: 'var(--radius-md)', padding: '14px 24px' }}
              >
                Продолжить
              </button>
            </div>
          </>
        )}

        {/* ── Шаг 3 ─────────────────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <button
              onClick={() => setStep(2)}
              className="flex items-center mb-6 -ml-1 transition-colors font-body"
              style={{ fontSize: 13, color: 'var(--text-tertiary)' }}
            >
              <span className="mr-1">←</span> Назад
            </button>

            <h1 className="font-heading mb-1" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
              Бюджет и приоритеты
            </h1>
            <p className="mb-8 font-body" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Что важнее — сориентируем по выбору
            </p>

            {/* Слайдер бюджета */}
            <div className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Бюджет</span>
                <span className="font-heading" style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatBudget(budget)}
                </span>
              </div>
              <input
                type="range"
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={1000}
                value={budget}
                onChange={e => setBudget(Number(e.target.value))}
                className="budget-slider"
              />
              <div className="flex justify-between mt-1.5 font-body" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span>{formatBudget(BUDGET_MIN)}</span>
                <span>{formatBudget(BUDGET_MAX)}</span>
              </div>
            </div>

            {/* Приоритеты */}
            <div className="mb-8">
              <p className="mb-3 font-body" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                Что важнее всего?
              </p>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map(p => {
                  const active = priorities.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={`pill ${active ? 'active' : ''}`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-auto">
              <button
                onClick={handleFinish}
                className="btn-primary w-full"
                style={{ borderRadius: 'var(--radius-md)', padding: '14px 24px' }}
              >
                Найти технику →
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
