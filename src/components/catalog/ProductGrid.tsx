'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import ProductCard from './ProductCard'

type ProductRow = Database['public']['Tables']['products']['Row']

interface JobContext {
  job: string
  jobId: string | null
  answers: Record<string, string>
  budget: number
  priorities: string[]
}

interface ProductWithScore extends ProductRow {
  matchPct: number
}

interface Props {
  job: string | null
  jobStatement: string | null
}

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

export default function ProductGrid({ job: jobFromParams, jobStatement: statementFromServer }: Props) {
  const router = useRouter()

  const [products,     setProducts]     = useState<ProductWithScore[]>([])
  const [allTags,      setAllTags]      = useState<string[]>([])
  const [activeTags,   setActiveTags]   = useState<string[]>([])
  const [jobStatement, setJobStatement] = useState<string | null>(statementFromServer)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [userId,       setUserId]       = useState<string | null>(null)
  // product_id → уже есть запрос
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      let context: Partial<JobContext> = {}
      try {
        const raw = localStorage.getItem('job_context')
        if (raw) context = JSON.parse(raw) as JobContext
      } catch { /* */ }

      const jobKey    = context.job ?? jobFromParams ?? null
      const priorities = context.priorities ?? []
      const budget    = context.budget ?? null

      if (!jobKey) { setLoading(false); return }

      const contextTags = [
        jobKey,
        ...priorities.map(p => PRIORITY_TAG[p]).filter(Boolean),
      ]

      try {
        const supabase = createClient()

        // Два независимых запроса параллельно
        const [{ data: { user } }, productsResult] = await Promise.all([
          supabase.auth.getUser(),
          (() => {
            let q = supabase
              .from('products')
              .select('*')
              .contains('jtbd_tags', [jobKey])
            if (budget != null) q = q.lte('price', budget)
            return q
          })(),
        ])

        if (user) setUserId(user.id)

        // Загружаем statement задачи (последовательно — нужен context.jobId)
        if (!statementFromServer && context.jobId) {
          const { data: jobData } = await supabase
            .from('jobs')
            .select('statement')
            .eq('id', context.jobId)
            .single()
          if (jobData) setJobStatement(jobData.statement)
        }

        if (productsResult.error) throw productsResult.error

        const rows = (productsResult.data ?? []) as ProductRow[]

        const scored: ProductWithScore[] = rows
          .map(p => ({ ...p, matchPct: calcMatchPct(p, contextTags) }))
          .sort((a, b) => b.matchPct - a.matchPct)

        const JOB_KEYS = new Set(['gaming', 'streaming', 'creator', 'work', 'company'])
        const tagSet = new Set<string>()
        rows.forEach(p => p.jtbd_tags.forEach(t => { if (!JOB_KEYS.has(t)) tagSet.add(t) }))
        setAllTags([...tagSet].sort())

        setProducts(scored)

        // Загружаем существующие video_requests для этого пользователя
        if (user && rows.length > 0) {
          const productIds = rows.map(r => r.id)
          const { data: existing } = await supabase
            .from('video_requests')
            .select('product_id')
            .eq('user_id', user.id)
            .in('product_id', productIds)
          if (existing) {
            setRequestedIds(new Set(existing.map(r => r.product_id)))
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  const handleRequestVideo = useCallback(async (productId: string) => {
    if (!userId) { router.push('/auth'); return }

    // Оптимистичное обновление
    setRequestedIds(prev => new Set([...prev, productId]))

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log('current user:', user)
    if (!user) { router.push('/auth'); setRequestedIds(prev => { const n = new Set(prev); n.delete(productId); return n }); return }
    console.log('user.id before INSERT:', user.id)
    const { error } = await supabase
      .from('video_requests')
      .insert({ user_id: user.id, product_id: productId, status: 'pending' })

    if (error) {
      // Откатываем если не удалось
      setRequestedIds(prev => { const n = new Set(prev); n.delete(productId); return n })
    }
  }, [userId, router])

  const visibleProducts = activeTags.length
    ? products.filter(p => activeTags.every(t => p.jtbd_tags.includes(t)))
    : products

  // ── рендер ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse" style={{ height: 260, borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)' }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="font-body" style={{ fontSize: 13, color: '#EF4444' }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Заголовок */}
      <div className="mb-2">
        {jobStatement && (
          <h1 className="font-heading leading-snug mb-1" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {jobStatement}
          </h1>
        )}
        <p className="font-body" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Найдено {visibleProducts.length} устройств
        </p>
      </div>

      {/* Фильтры-пилюли */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => {
            const active = activeTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`pill ${active ? 'active' : ''}`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {/* Сетка */}
      {visibleProducts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-body" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Ничего не найдено. Попробуйте убрать фильтры.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              matchPct={product.matchPct}
              hasRequest={requestedIds.has(product.id)}
              onRequestVideo={handleRequestVideo}
            />
          ))}
        </div>
      )}
    </div>
  )
}
