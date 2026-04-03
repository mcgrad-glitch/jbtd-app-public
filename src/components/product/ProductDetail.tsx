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
  const [videoUrl,     setVideoUrl]     = useState<string | null>(null)
  const [question,     setQuestion]     = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [elapsed,      setElapsed]      = useState('')
  const [specsOpen,    setSpecsOpen]    = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── инициализация: auth + localStorage + video_request + Realtime ─────────
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      // 1. Текущий пользователь — ждём ДО запроса video_request
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      setUserId(uid)

      // 2. job_context из localStorage
      try {
        const raw = localStorage.getItem('job_context')
        if (raw) {
          const ctx: JobContext = JSON.parse(raw)
          const tags = [ctx.job, ...ctx.priorities.map(p => PRIORITY_TAG[p]).filter(Boolean)]
          setMatchPct(calcMatchPct(product, tags))
        }
      } catch { /* нет localStorage */ }

      // 3. Загрузка video_request — только после того как знаем uid
      console.log('fetching video request for:', product.id, uid)
      if (!uid) return

      const { data: vrData, error: vrError } = await supabase
        .from('video_requests')
        .select('*')
        .eq('product_id', product.id)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)

      console.log('video_request result:', JSON.stringify(vrData))
      console.log('video_request error:', JSON.stringify(vrError))

      const row = vrData?.[0] ?? null
      if (row) {
        setVideoRequest(row)
        setVideoStatus(row.status === 'ready' ? 'ready' :
                       row.status === 'filming' ? 'pending' : 'pending')
        console.log('setting video status to:', row.status)

        if (row.status === 'ready') {
          const { data: videoData } = await supabase
            .from('videos')
            .select('url')
            .eq('product_id', product.id)
            .order('created_at', { ascending: false })
            .limit(1)

          const url = videoData?.[0]?.url ?? null
          console.log('video url:', url)
          setVideoUrl(url)
        }
      }

      // 4. Realtime — подписка после загрузки
      channel = supabase
        .channel(`vr:${product.id}:${uid}`)
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
            if (row.user_id === uid) applyRequest(row)
          }
        )
        .subscribe()
    }

    init()

    return () => { if (channel) supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

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

    const { data: sessionData } = await supabase.auth.getSession()
    console.log('session:', JSON.stringify(sessionData))

    const { data: { user } } = await supabase.auth.getUser()
    console.log('user:', user?.id, user?.email)

    if (!user) { router.push('/auth'); setSubmitting(false); return }

    console.log('productId value:', product.id)
    console.log('productId type:', typeof product.id)
    console.log('user.id value:', user?.id)

    const insertData = {
      user_id:    user?.id,
      product_id: product.id,
      question:   question || null,
      status:     'pending' as const,
    }
    console.log('insertData:', JSON.stringify(insertData))

    const { data: insertResult, error: insertError } = await supabase
      .from('video_requests')
      .insert(insertData)
      .select()

    console.log('insert result:', JSON.stringify(insertResult))
    console.log('insert error:', JSON.stringify(insertError))

    if (insertError) {
      console.error('Full error:', insertError)
      alert(insertError.message + ' | ' + insertError.details + ' | ' + insertError.hint)
      setSubmitting(false)
      return
    }

    if (insertResult?.[0]) applyRequest(insertResult[0])
    setSubmitting(false)
  }, [userId, product.id, question, router])

  // ── производные данные ───────────────────────────────────────────────────
  const oldPrice  = product.price != null ? Math.round(product.price * 1.2) : null
  const discount  = 17 // фиксированная скидка: 1/1.2 ≈ 83% → скидка 17%

  const outcomes: OutcomeItem[] = (() => {
    try {
      const raw = product.outcomes
      if (Array.isArray(raw)) return raw as unknown as OutcomeItem[]
    } catch { /* */ }
    return []
  })()

  const specs: Record<string, string> = (() => {
    try {
      const raw = product.specs
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as unknown as Record<string, string>
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
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => router.push('/catalog')}
          className="flex items-center gap-1.5 transition-colors font-body"
          style={{ fontSize: 13, color: 'var(--text-secondary)' }}
        >
          <span className="text-base leading-none">←</span>
          <span>Каталог</span>
        </button>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-5">

        {/* ── 2. Фото ───────────────────────────────────────────────────── */}
        <div className="w-full aspect-square overflow-hidden flex items-center justify-center" style={{ borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)' }}>
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-contain p-6"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          )}
        </div>

        {/* ── 3. Основная инфо ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {product.brand && (
              <span className="font-body uppercase tracking-wider" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                {product.brand}
              </span>
            )}
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>·</span>
            <span className="flex items-center gap-1 font-body" style={{ fontSize: 12, color: '#F59E0B' }}>
              <span>★</span>
              <span style={{ color: 'var(--text-secondary)' }}>4.8 · 312 отзывов</span>
            </span>
          </div>

          <h1 className="font-heading leading-snug" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            {product.headline}
          </h1>

          {product.price != null && (
            <div className="flex items-center gap-2 mt-1">
              <span className="font-heading" style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                {product.price.toLocaleString('ru-RU')} ₽
              </span>
              {oldPrice && (
                <span className="font-body line-through" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                  {oldPrice.toLocaleString('ru-RU')} ₽
                </span>
              )}
              <span className="font-body" style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#ECFDF5', color: 'var(--success)' }}>
                -{discount}%
              </span>
            </div>
          )}
        </div>

        {/* ── 4. Почему подходит ────────────────────────────────────────── */}
        {outcomes.length > 0 && (
          <div className="p-4 flex flex-col gap-3" style={{ borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg,#EEF2FF,#FDF2F8)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-primary)' }}>Почему подходит тебе</h2>
              {matchPct > 0 && (
                <span className="font-body bg-brand" style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, color: '#fff' }}>
                  {matchPct}% совпадение
                </span>
              )}
            </div>

            <ul className="flex flex-col gap-2">
              {outcomes.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--brand-gradient)', marginTop: 1 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <span className="font-body" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{o.title}</span>
                    {o.description && (
                      <p className="font-body mt-0.5" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── 5. Блок видео ────────────────────────────────────────────── */}
        <div className="overflow-hidden" style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <h2 className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Видеообзор</h2>
          </div>

          <div className="p-4">
            {videoStatus === 'none' && (
              <div className="flex flex-col gap-3">
                <p className="font-body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Хотите увидеть товар в действии? Запросите персональный обзор — эксперт ответит на ваши вопросы.
                </p>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ваш вопрос к эксперту (необязательно)"
                  rows={3}
                  className="w-full font-body resize-none outline-none transition-colors"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button
                  onClick={handleRequestVideo}
                  disabled={submitting}
                  className="btn-primary w-full"
                  style={{ borderRadius: 'var(--radius-md)', padding: '12px 24px' }}
                >
                  {submitting ? 'Отправка…' : 'Запросить обзор — бесплатно'}
                </button>
              </div>
            )}

            {videoStatus === 'pending' && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full animate-bounce"
                      style={{ background: 'var(--brand-primary)', animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <div className="text-center">
                  <p className="font-body" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Эксперт снимает обзор</p>
                  {elapsed && (
                    <p className="font-body mt-0.5" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Ожидание: {elapsed}</p>
                  )}
                </div>
                {videoRequest?.question && (
                  <p className="font-body text-center" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Ваш вопрос: «{videoRequest.question}»
                  </p>
                )}
              </div>
            )}

            {videoStatus === 'ready' && videoRequest && (
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden bg-black aspect-video" style={{ borderRadius: 'var(--radius-md)' }}>
                  <video controls className="w-full h-full" playsInline src={videoUrl ?? undefined}>
                    {videoUrl && <source src={videoUrl} type="video/mp4" />}
                  </video>
                </div>
                <a
                  href="#"
                  className="font-body transition-colors"
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-primary)' }}
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
            <h2 className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Что это даёт тебе</h2>
            <div className="flex flex-col gap-3">
              {outcomes.map((o, i) => (
                <div key={i} className="flex gap-3 p-3" style={{ borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                  <div className="icon-box icon-box-lg shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="font-body" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{o.title}</p>
                    {o.description && (
                      <p className="font-body leading-relaxed" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. Аккордеон: технические характеристики ─────────────────── */}
        {Object.keys(specs).length > 0 && (
          <div className="overflow-hidden" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setSpecsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors font-body"
              style={{ fontSize: 13, color: 'var(--text-secondary)' }}
            >
              <span style={{ fontWeight: 500 }}>Технические характеристики</span>
              <span className={`transition-transform duration-200 ${specsOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }}>
                ▾
              </span>
            </button>

            {specsOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {Object.entries(specs).map(([key, value], i) => (
                  <div
                    key={key}
                    className="flex justify-between px-4 py-2.5 font-body"
                    style={{ fontSize: 13, background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                    <span className="ml-4 text-right" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── 8. Sticky нижняя панель ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3" style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto w-full max-w-[390px] flex gap-3">
          <button
            className="flex-1 font-body transition-all duration-150 active:scale-[0.97]"
            style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', background: 'transparent' }}
          >
            В корзину
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 text-center active:scale-[0.97]"
            style={{ padding: '12px', borderRadius: 'var(--radius-md)', fontSize: 14 }}
          >
            Купить сейчас
          </a>
        </div>
      </div>
    </>
  )
}
