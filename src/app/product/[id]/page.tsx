import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductDetail from '@/components/product/ProductDetail'

interface PageProps {
  params: { id: string }
}

export default async function ProductPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!product) notFound()

  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="mx-auto w-full max-w-[390px]">
        <ProductDetail product={product} />
      </div>
    </main>
  )
}
