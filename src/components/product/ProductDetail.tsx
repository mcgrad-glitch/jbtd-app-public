'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type ProductRow   = Database['public']['Tables']['products']['Row']
type VideoRequest = Database['public']['Tables']['video_requests']['Row']
type VideoStatus  = 'none' | 'pending' | 'ready'

interface JobContext {
  job: string
  jobId: string | null
  answers: Record<string, string>
  budget: number
  priorities: string[]
}

interface OutcomeItem {
  icon: string
  title: string
  description: string
}

// Хэш приоритет → тег (совпадает с ProductGrid)
const PRIORITY_TAG: Record<string, string> = {
  'Надёжный бренд':     'reliable',
  'Лучшая цена':        'budget',
  'Долгий срок службы': 'durable',
}

function calcMatchPct(product: ProductRow, contextTags: string[]): number {
  if (!contextTags.length) return 0
  const hits = product.jtbd_tags.filter(t => contextTags.includes(t)).length
  return Math.min(100, Math.round((hits / contextTags.length) * 100))
}

function formatElapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime()
  const h  = Math.floor(ms / 3_600_000)
  const m  = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductDetail({ product }: { product: ProductRow }) {
  const router = useRouter()

  const [userId,       setUserId]       = useState<string | null>(null)
  const [matchPct,     setMatchPct]     = useState(0)
  const [videoStatus,  setVideoStatus]  = useState<VideoStatus>('none')
  const [videoRequest, setVideoRequest] = useState<VideoRequest | null>(null)
  const [question,     setQuestion]     = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [elapsed,      setElapsed]      = useState('')
  const [specsOpen,    setSpecsOpen]    = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── инициализация: auth + localStorage ──────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    // 1. Текущий пользователь
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })

    // 2. job_context из localStorage
    try {
      const raw = localStorage.getItem('job_context')
      if (raw) {
        const ctx: JobContext = JSON.parse(raw)
        const tags = [ctx.job, ...ctx.priorities.map(p => PRIORITY_TAG[p]).filter(Boolean)]
        setMatchPct(calcMatchPct(product, tags))
      }
    } catch { /* нет localStorage */ }
  }, [product])

  // ── загрузка video_request + Realtime ───────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Начальная загрузка
    supabase
      .from('video_requests')
      .select('*')
      .eq('product_id', product.id)
      .eq('user_id', userId)
      .single()
      .then(({ data }) => applyRequest(data))

    // Realtime — слушаем изменения по product_id
    const channel = supabase
      .channel(`vr:${product.id}:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'video_requests',
          filter: `product_id=eq.${product.id}`,
        },
        payload => {
          const row = payload.new as VideoRequest
          if (row.user_id === userId) applyRequest(row)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, product.id])

  // ── таймер "ожидания" для pending-состояния ──────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (videoStatus === 'pending' && videoRequest?.created_at) {
      const tick = () => setElapsed(formatElapsed(videoRequest.created_at))
      tick()
      timerRef.current = setInterval(tick, 30_000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [videoStatus, videoRequest])

  function applyRequest(row: VideoRequest | null) {
    if (!row) { setVideoStatus('none'); setVideoRequest(null); return }
    setVideoRequest(row)
    setVideoStatus(row.status === 'ready' ? 'ready' : row.status === 'filming' ? 'pending' : 'pending')
  }

  // ── запросить обзор ──────────────────────────────────────────────────────
  const handleRequestVideo = useCallback(async () => {
    if (!userId) { router.push('/auth'); return }

    setSubmitting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('video_requests')
      .insert({
        user_id:    userId,
        product_id: product.id,
        question:   question.trim() || null,
        status:     'pending',
      })
      .select()
      .single()

    if (data) applyRequest(data)
    setSubmitting(false)
  }, [userId, product.id, question, router])

  // ── производные данные ───────────────────────────────────────────────────
  const oldPrice  = product.price != null ? Math.round(product.price * 1.2) : null
  const discount  = 17 // фиксированная скидка: 1/1.2 ≈ 83% → скидка 17%

  const outcomes: OutcomeItem[] = (() => {
    try {
      const raw = product.outcomes
      if (Array.isArray(raw)) return raw as OutcomeItem[]
    } catch { /* */ }
    return []
  })()

  const specs: Record<string, string> = (() => {
    try {
      const raw = product.specs
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, string>
      }
    } catch { /* */ }
    return {}
  })()

  const whatsappText = `Хочу купить ${product.name}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── 1. Навигация ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => router.push('/catalog')}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span className="text-lg leading-none">←</span>
          <span>Каталог</span>
        </button>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-5">

        {/* ── 2. Фото ───────────────────────────────────────────────────── */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center">
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-contain p-6"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* ── 3. Основная инфо ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {product.brand && (
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {product.brand}
              </span>
            )}
            <span className="text-xs text-gray-400">·</span>
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <span>★</span>
              <span className="text-gray-600">4.8 · 312 отзывов</span>
            </span>
          </div>

          <h1 className="text-xl font-semibold text-gray-900 leading-snug">
            {product.headline}
          </h1>

          {product.price != null && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-900">
                {product.price.toLocaleString('ru-RU')} ₽
              </span>
              {oldPrice && (
                <span className="text-sm text-gray-400 line-through">
                  {oldPrice.toLocaleString('ru-RU')} ₽
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                -{discount}%
              </span>
            </div>
          )}
        </div>

        {/* ── 4. Почему подходит ────────────────────────────────────────── */}
        {outcomes.length > 0 && (
        <div className="rounded-2xl bg-violet-50 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-violet-900">Почему подходит тебе</h2>
            {matchPct > 0 && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                ${matchPct >= 80 ? 'bg-emerald-100 text-emerald-700'
                  : matchPct >= 50 ? 'bg-amber-100 text-amber-700'
                  : 'bg-violet-100 text-violet-700'}`}>
                {matchPct}% совпадение
              </span>
            )}
          </div>

          <ul className="flex flex-col gap-1.5">
            {outcomes.map((o, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-sm text-violet-800">
                <span className="font-medium">{o.title}</span>
                {o.description && (
                  <span className="text-xs text-violet-600">{o.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        )}

        {/* ── 5. Блок видео ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Видеообзор</h2>
          </div>

          <div className="p-4">
            {videoStatus === 'none' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-500">
                  Хотите увидеть товар в действии? Запросите персональный обзор — эксперт ответит на ваши вопросы.
                </p>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ваш вопрос к эксперту (необязательно)"
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                             text-gray-800 placeholder-gray-400 resize-none
                             focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
                <button
                  onClick={handleRequestVideo}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-black text-white text-sm font-medium
                             hover:bg-gray-800 active:scale-[0.98] transition-all duration-150
                             disabled:opacity-40"
                >
                  {submitting ? 'Отправка…' : 'Запросить обзор — бесплатно'}
                </button>
              </div>
            )}

            {videoStatus === 'pending' && (
              <div className="flex flex-col items-center gap-4 py-4">
                {/* Анимированный индикатор */}
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-black animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">Эксперт снимает обзор</p>
                  {elapsed && (
                    <p className="text-xs text-gray-400 mt-0.5">Ожидание: {elapsed}</p>
                  )}
                </div>
                {videoRequest?.question && (
                  <p className="text-xs text-gray-400 text-center">
                    Ваш вопрос: «{videoRequest.question}»
                  </p>
                )}
              </div>
            )}

            {videoStatus === 'ready' && videoRequest && (
              <div className="flex flex-col gap-3">
                {/* HTML5 video */}
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  {/* videos таблица хранит url; здесь используем заглушку */}
                  <video
                    controls
                    className="w-full h-full"
                    playsInline
                  >
                    <source src="#" type="video/mp4" />
                  </video>
                </div>
                <a
                  href="#"
                  className="text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors"
                >
                  Задать вопрос эксперту →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── 6. Что это даёт тебе ─────────────────────────────────────── */}
        {outcomes.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-900">Что это даёт тебе</h2>
            <div className="flex flex-col gap-3">
              {outcomes.map((o, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50">
                  <span className="text-2xl shrink-0">{o.icon ?? '⚡'}</span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-gray-900">{o.title}</p>
                    {o.description && (
                      <p className="text-xs text-gray-500 leading-relaxed">{o.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. Аккордеон: технические характеристики ─────────────────── */}
        {Object.keys(specs).length > 0 && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setSpecsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left
                         hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">Технические характеристики</span>
              <span className={`text-gray-400 transition-transform duration-200 ${specsOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>

            {specsOpen && (
              <div className="border-t border-gray-100">
                {Object.entries(specs).map(([key, value], i) => (
                  <div
                    key={key}
                    className={`flex justify-between px-4 py-2.5 text-sm
                      ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <span className="text-gray-500">{key}</span>
                    <span className="text-gray-900 font-medium text-right ml-4">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── 8. Sticky нижняя панель ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3 safe-bottom">
        <div className="mx-auto w-full max-w-[390px] flex gap-3">
          <button
            className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-900
                       hover:border-gray-500 active:scale-[0.97] transition-all duration-150"
          >
            В корзину
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium text-center
                       hover:bg-black active:scale-[0.97] transition-all duration-150"
          >
            Купить сейчас
          </a>
        </div>
      </div>
    </>
  )
}
