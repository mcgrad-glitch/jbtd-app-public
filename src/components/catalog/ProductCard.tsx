import type { Database } from '@/lib/supabase/types'

type ProductRow = Database['public']['Tables']['products']['Row']

interface Props {
  product: ProductRow
  matchPct: number
  onRequestVideo: (productId: string) => void
}

export default function ProductCard({ product, matchPct, onRequestVideo }: Props) {
  const coverImage = product.images?.[0] ?? null

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 overflow-hidden bg-white">
      {/* Фото */}
      <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={product.name}
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Бейдж совпадения */}
        {matchPct > 0 && (
          <span
            className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium
              ${matchPct >= 80
                ? 'bg-emerald-100 text-emerald-700'
                : matchPct >= 50
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
          >
            {matchPct}% совпадение
          </span>
        )}
      </div>

      {/* Контент */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        {product.brand && (
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {product.brand}
          </span>
        )}

        <p className="text-sm font-medium text-gray-900 leading-snug">
          {product.headline}
        </p>

        {product.price != null && (
          <p className="mt-1 text-base font-semibold text-gray-900">
            {product.price.toLocaleString('ru-RU')} ₽
          </p>
        )}

        {/* Кнопки */}
        <div className="mt-auto pt-3 flex flex-col gap-2">
          <button
            onClick={() => onRequestVideo(product.id)}
            className="w-full py-2 rounded-xl border border-black text-sm font-medium text-black
                       hover:bg-black hover:text-white active:scale-[0.97]
                       transition-all duration-150"
          >
            Запросить видео
          </button>
          <button
            className="w-full py-2 rounded-xl bg-black text-white text-sm font-medium
                       hover:bg-gray-800 active:scale-[0.97]
                       transition-all duration-150"
          >
            Купить
          </button>
        </div>
      </div>
    </article>
  )
}
