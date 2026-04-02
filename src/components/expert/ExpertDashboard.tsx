'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type VideoRequest = Database['public']['Tables']['video_requests']['Row']
type VideoStatus  = Database['public']['Tables']['video_requests']['Row']['status']

interface RequestWithProduct extends VideoRequest {
  products: {
    id: string
    name: string
    headline: string
    brand: string | null
  } | null
}

const STATUS_LABEL: Record<VideoStatus, string> = {
  pending:  'Новый',
  filming:  'Снимается',
  ready:    'Готово',
}

const STATUS_COLOR: Record<VideoStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  filming: 'bg-blue-100 text-blue-700',
  ready:   'bg-emerald-100 text-emerald-700',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ExpertDashboard({ expertId }: { expertId: string }) {
  const [requests,  setRequests]  = useState<RequestWithProduct[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  // fileRef[requestId] → выбранный файл
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [uploadErr, setUploadErr] = useState<Record<string, string>>({})

  // ── загрузка + Realtime ────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('video_requests')
        .select(`
          *,
          products:product_id (
            id, name, headline, brand
          )
        `)
        .in('status', ['pending', 'filming'])
        .order('created_at', { ascending: false })

      if (err) { setError(err.message); setLoading(false); return }
      setRequests((data ?? []) as RequestWithProduct[])
      setLoading(false)
    }

    load()

    // Realtime: новые запросы без перезагрузки
    const channel = supabase
      .channel('expert:video_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'video_requests' },
        async payload => {
          // Дозагружаем product для новой строки
          const newRow = payload.new as VideoRequest
          const { data: product } = await supabase
            .from('products')
            .select('id, name, headline, brand')
            .eq('id', newRow.product_id)
            .single()

          const full: RequestWithProduct = { ...newRow, products: product ?? null }
          setRequests(prev => [full, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'video_requests' },
        payload => {
          const updated = payload.new as VideoRequest
          setRequests(prev =>
            // Убираем из списка если статус стал ready
            updated.status === 'ready'
              ? prev.filter(r => r.id !== updated.id)
              : prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── взять в работу ─────────────────────────────────────────────────────

  const takeRequest = useCallback(async (requestId: string) => {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('video_requests')
      .update({ status: 'filming' })
      .eq('id', requestId)

    if (err) return

    setRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'filming' } : r)
    )
  }, [])

  // ── загрузить видео ────────────────────────────────────────────────────

  const uploadVideo = useCallback(async (request: RequestWithProduct) => {
    const file = selectedFiles[request.id]
    if (!file || !request.products) return

    setUploading(prev => ({ ...prev, [request.id]: true }))
    setUploadErr(prev => ({ ...prev, [request.id]: '' }))

    const supabase = createClient()

    // 1. Upload через API route (service role обходит RLS Storage)
    const formData = new FormData()
    formData.append('file',        file)
    formData.append('product_id',  request.product_id)
    formData.append('request_id',  request.id)

    const uploadRes = await fetch('/api/upload-video', {
      method: 'POST',
      body:   formData,
    })
    const uploadJson = await uploadRes.json() as { url: string | null; error: string | null }

    console.log('upload response:', uploadRes.status, uploadJson)

    if (!uploadRes.ok || uploadJson.error || !uploadJson.url) {
      alert('Upload error: ' + (uploadJson.error ?? 'Unknown error'))
      setUploading(prev => ({ ...prev, [request.id]: false }))
      return
    }

    const publicUrl = uploadJson.url

    // 2. Запись в таблицу videos
    await supabase.from('videos').insert({
      product_id:   request.product_id,
      job_id:       request.job_id,
      expert_id:    expertId,
      url:          publicUrl,
      is_public:    true,
    })

    // 4. Обновить video_requests: статус + url
    await supabase
      .from('video_requests')
      .update({ status: 'ready' })
      .eq('id', request.id)

    // Убираем из локального списка (Realtime тоже уберёт, но это быстрее)
    setRequests(prev => prev.filter(r => r.id !== request.id))
    setUploading(prev => ({ ...prev, [request.id]: false }))
    setSelectedFiles(prev => { const n = { ...prev }; delete n[request.id]; return n })
  }, [selectedFiles, expertId])

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl bg-white animate-pulse h-28 border border-gray-200" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-sm font-medium text-gray-700">Новых запросов нет</p>
        <p className="text-xs text-gray-400">Новые появятся здесь автоматически</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map(req => {
        const isUploading = uploading[req.id] ?? false
        const fileErr     = uploadErr[req.id]
        const chosenFile  = selectedFiles[req.id]

        return (
          <div
            key={req.id}
            className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
          >
            {/* Заголовок карточки */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                {req.products?.brand && (
                  <span className="text-xs text-gray-400 uppercase tracking-wide">
                    {req.products.brand}
                  </span>
                )}
                <p className="text-sm font-semibold text-gray-900 leading-snug">
                  {req.products?.headline ?? req.products?.name ?? '—'}
                </p>
              </div>
              <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[req.status]}`}>
                {STATUS_LABEL[req.status]}
              </span>
            </div>

            {/* Вопрос от пользователя */}
            {req.question && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
                «{req.question}»
              </p>
            )}

            {/* Время */}
            <p className="text-xs text-gray-400">{formatDate(req.created_at)}</p>

            {/* Кнопка "Взять в работу" */}
            {req.status === 'pending' && (
              <button
                onClick={() => takeRequest(req.id)}
                className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-medium
                           hover:bg-gray-800 active:scale-[0.98] transition-all duration-150"
              >
                Взять в работу
              </button>
            )}

            {/* Форма загрузки — только для filming */}
            {req.status === 'filming' && (
              <div className="flex flex-col gap-2">
                {/* Скрытый input, вызывается кнопкой */}
                <input
                  ref={el => { fileInputRefs.current[req.id] = el }}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) setSelectedFiles(prev => ({ ...prev, [req.id]: file }))
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRefs.current[req.id]?.click()}
                  className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-sm
                             text-gray-600 hover:border-gray-500 hover:text-gray-800
                             active:scale-[0.98] transition-all duration-150"
                >
                  {chosenFile
                    ? `✓ ${chosenFile.name}`
                    : '+ Выбрать видеофайл'}
                </button>

                {fileErr && (
                  <p className="text-xs text-red-500">{fileErr}</p>
                )}

                <button
                  onClick={() => uploadVideo(req)}
                  disabled={!chosenFile || isUploading}
                  className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-medium
                             hover:bg-gray-800 active:scale-[0.98] transition-all duration-150
                             disabled:opacity-40"
                >
                  {isUploading ? 'Загружается…' : 'Загрузить и отправить'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
