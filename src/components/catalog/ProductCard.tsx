'use client'

import Link from 'next/link'
import type { Database } from '@/lib/supabase/types'

type ProductRow = Database['public']['Tables']['products']['Row']

interface Props {
  product: ProductRow
  matchPct: number
  hasRequest: boolean
  onRequestVideo: (productId: string) => void
}

export default function ProductCard({ product, matchPct, hasRequest, onRequestVideo }: Props) {
  const coverImage = product.images?.[0] ?? null

  return (
    <Link
      href={`/product/${product.id}`}
      className="flex flex-col overflow-hidden bg-white transition-all duration-200 group"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--brand-primary)'
        el.style.boxShadow = 'var(--shadow-md)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Фото */}
      <div className="relative w-full flex items-center justify-center overflow-hidden" style={{ height: 200, background: 'var(--bg-secondary)' }}>
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={product.name}
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}

        {/* Бейдж совпадения */}
        {matchPct > 0 && (
          <span
            className="absolute top-2.5 right-2.5 font-body"
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              ...(matchPct >= 80
                ? { background: 'var(--brand-gradient)', color: '#fff' }
                : matchPct >= 50
                  ? { background: 'linear-gradient(135deg,#EEF2FF,#FDF2F8)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)' }
                  : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }
              ),
            }}
          >
            {matchPct}% совпадение
          </span>
        )}
      </div>

      {/* Контент */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        {product.brand && (
          <span className="font-body uppercase tracking-wider" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
            {product.brand}
          </span>
        )}

        <p className="font-heading leading-snug" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {product.headline}
        </p>

        {product.price != null && (
          <p className="mt-1 font-heading" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {product.price.toLocaleString('ru-RU')} ₽
          </p>
        )}

        {/* Кнопки */}
        <div
          className="mt-auto pt-3 flex flex-col gap-2"
          onClick={e => e.preventDefault()}
        >
          <button
            disabled={hasRequest}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onRequestVideo(product.id) }}
            className="w-full font-body transition-all duration-150 active:scale-[0.97]"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 500,
              cursor: hasRequest ? 'default' : 'pointer',
              ...(hasRequest
                ? { border: '1.5px solid var(--success)', color: 'var(--success)', background: '#F0FDF4' }
                : { border: '1.5px solid var(--brand-primary)', color: 'var(--brand-primary)', background: 'transparent' }
              ),
            }}
            onMouseEnter={e => {
              if (!hasRequest) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg,#EEF2FF,#FDF2F8)'
            }}
            onMouseLeave={e => {
              if (!hasRequest) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            {hasRequest ? 'Видео запрошено ✓' : 'Запросить видео'}
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation() }}
            className="btn-primary w-full"
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
          >
            Купить
          </button>
        </div>
      </div>
    </Link>
  )
}
