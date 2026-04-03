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

  const progressWidth = step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-[390px] flex flex-col flex-1">

        {/* Прогресс-бар */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Шаг {step} из 3</span>
            <span>
              {step === 1 && 'Выбор задачи'}
              {step === 2 && 'Уточнение'}
              {step === 3 && 'Бюджет'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full bg-black rounded-full transition-all duration-300 ${progressWidth}`}
            />
          </div>
        </div>

        {/* ── Шаг 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Что хотите сделать?
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Выберите главную задачу — подберём подходящую технику
            </p>

            <div className="grid grid-cols-2 gap-3">
              {JOB_TILES.map(tile => (
                <button
                  key={tile.key}
                  onClick={() => handleJobSelect(tile.key)}
                  disabled={loading}
                  className="flex flex-col items-start p-4 rounded-2xl border border-gray-200 text-left
                             hover:border-black hover:shadow-sm active:scale-[0.97]
                             transition-all duration-150 disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-gray-900 leading-tight">
                    {tile.title}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5 leading-tight">
                    {tile.hint}
                  </span>
                </button>
              ))}
            </div>

            {loading && (
              <p className="text-center text-sm text-gray-400 mt-6">Загружаем вопросы…</p>
            )}
          </>
        )}

        {/* ── Шаг 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <button
              onClick={() => setStep(1)}
              className="flex items-center text-sm text-gray-400 hover:text-gray-700 mb-6 -ml-1 transition-colors"
            >
              <span className="mr-1">←</span> Назад
            </button>

            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Расскажите подробнее
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Пара уточняющих вопросов
            </p>

            {questions.length === 0 ? (
              <p className="text-sm text-gray-400 mb-6">
                Вопросы не найдены — переходим к бюджету.
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {questions.map(q => (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-gray-800 mb-3">{q.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map(opt => {
                        const selected = answers[q.id] === opt
                        return (
                          <button
                            key={opt}
                            onClick={() => handleAnswer(q.id, opt)}
                            className={`px-4 py-2 rounded-full text-sm border transition-all duration-150
                              ${selected
                                ? 'bg-black text-white border-black'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                              }`}
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
                className="w-full py-3.5 rounded-2xl bg-black text-white text-sm font-medium
                           disabled:opacity-30 hover:bg-gray-800 active:scale-[0.98]
                           transition-all duration-150"
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
              className="flex items-center text-sm text-gray-400 hover:text-gray-700 mb-6 -ml-1 transition-colors"
            >
              <span className="mr-1">←</span> Назад
            </button>

            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Бюджет и приоритеты
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              Что важнее — сориентируем по выбору
            </p>

            {/* Слайдер бюджета */}
            <div className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm text-gray-500">Бюджет</span>
                <span className="text-lg font-semibold text-gray-900">
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
                className="w-full h-1.5 rounded-full bg-gray-200 appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-5
                           [&::-webkit-slider-thumb]:h-5
                           [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-black
                           [&::-webkit-slider-thumb]:shadow-sm
                           [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-moz-range-thumb]:w-5
                           [&::-moz-range-thumb]:h-5
                           [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:bg-black
                           [&::-moz-range-thumb]:border-0"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>{formatBudget(BUDGET_MIN)}</span>
                <span>{formatBudget(BUDGET_MAX)}</span>
              </div>
            </div>

            {/* Приоритеты */}
            <div className="mb-8">
              <p className="text-sm font-medium text-gray-800 mb-3">
                Что важнее всего?
              </p>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map(p => {
                  const active = priorities.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={`px-4 py-2 rounded-full text-sm border transition-all duration-150
                        ${active
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
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
                className="w-full py-3.5 rounded-2xl bg-black text-white text-sm font-medium
                           hover:bg-gray-800 active:scale-[0.98] transition-all duration-150"
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
