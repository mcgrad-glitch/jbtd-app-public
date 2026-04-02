'use client'

import { useEffect, useState, useCallback } from 'react'
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
  /** job из searchParams страницы (может отсутствовать) */
  job: string | null
  /** statement задачи, загруженный на сервере */
  jobStatement: string | null
}

// Хэш «приоритет → тег» для расчёта совпадения
const PRIORITY_TAG: Record<string, string> = {
  'Надёжный бренд':       'reliable',
  'Лучшая цена':          'budget',
  'Долгий срок службы':   'durable',
}

function calcMatchPct(product: ProductRow, contextTags: string[]): number {
  if (!contextTags.length) return 0
  const hits = product.jtbd_tags.filter(t => contextTags.includes(t)).length
  return Math.min(100, Math.round((hits / contextTags.length) * 100))
}

export default function ProductGrid({ job: jobFromParams, jobStatement: statementFromServer }: Props) {
  const [products, setProducts]     = useState<ProductWithScore[]>([])
  const [allTags, setAllTags]       = useState<string[]>([])
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [jobStatement, setJobStatement] = useState<string | null>(statementFromServer)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // 1. Читаем контекст из localStorage (или берём job из searchParams)
      let context: Partial<JobContext> = {}
      try {
        const raw = localStorage.getItem('job_context')
        if (raw) context = JSON.parse(raw) as JobContext
      } catch { /* нет localStorage — норм */ }

      const jobKey = context.job ?? jobFromParams ?? null
      const priorities = context.priorities ?? []
      const budget = context.budget ?? null

      if (!jobKey) {
        setLoading(false)
        return
      }

      // 2. Теги для расчёта совпадения
      const contextTags = [
        jobKey,
        ...priorities.map(p => PRIORITY_TAG[p]).filter(Boolean),
      ]

      try {
        const supabase = createClient()

        // 3. Загружаем statement задачи если не получили с сервера
        if (!statementFromServer && context.jobId) {
          const { data: jobData } = await supabase
            .from('jobs')
            .select('statement')
            .eq('id', context.jobId)
            .single()
          if (jobData) setJobStatement(jobData.statement)
        }

        // 4. Запрашиваем продукты по тегу задачи
        let query = supabase
          .from('products')
          .select('*')
          .contains('jtbd_tags', [jobKey])

        // Фильтр по бюджету
        if (budget != null) {
          query = query.lte('price', budget)
        }

        const { data, error: supaErr } = await query

        if (supaErr) throw supaErr

        const rows = (data ?? []) as ProductRow[]

        // 5. Считаем совпадение и сортируем
        const scored: ProductWithScore[] = rows
          .map(p => ({ ...p, matchPct: calcMatchPct(p, contextTags) }))
          .sort((a, b) => b.matchPct - a.matchPct)

        // 6. Уникальные теги для фильтров (без системных job-ключей)
        const JOB_KEYS = new Set(['content', 'work', 'music', 'gaming', 'gift', 'home'])
        const tagSet = new Set<string>()
        rows.forEach(p => p.jtbd_tags.forEach(t => {
          if (!JOB_KEYS.has(t)) tagSet.add(t)
        }))
        setAllTags([...tagSet].sort())

        setProducts(scored)
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

  const handleRequestVideo = useCallback((productId: string) => {
    // TODO: открыть форму запроса видео
    console.log('request video for', productId)
  }, [])

  const visibleProducts = activeTags.length
    ? products.filter(p => activeTags.every(t => p.jtbd_tags.includes(t)))
    : products

  // ── рендер ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-8">
        {/* Скелетоны */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-64" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Заголовок */}
      <div className="mb-2">
        {jobStatement && (
          <h1 className="text-xl font-semibold text-gray-900 leading-snug mb-1">
            {jobStatement}
          </h1>
        )}
        <p className="text-sm text-gray-500">
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
                className={`px-3 py-1.5 rounded-full text-xs border transition-all duration-150
                  ${active
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
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
          <p className="text-sm text-gray-400">Ничего не найдено. Попробуйте убрать фильтры.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              matchPct={product.matchPct}
              onRequestVideo={handleRequestVideo}
            />
          ))}
        </div>
      )}
    </div>
  )
}
