import { createClient } from '@/lib/supabase/server'
import ProductGrid from '@/components/catalog/ProductGrid'

// Маппинг job-ключей → имена в таблице jobs
const JOB_NAME: Record<string, string> = {
  content: 'Снимать контент',
  work:    'Работать удалённо',
  music:   'Слушать музыку',
  gaming:  'Играть в игры',
  gift:    'Подарить кому-то',
  home:    'Умный дом',
}

interface PageProps {
  searchParams: { job?: string }
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const jobKey = searchParams.job ?? null
  let jobStatement: string | null = null

  // Загружаем statement задачи на сервере (если job передан через URL)
  if (jobKey && JOB_NAME[jobKey]) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('jobs')
      .select('statement')
      .eq('name', JOB_NAME[jobKey])
      .single()
    jobStatement = data?.statement ?? null
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[390px] px-4 py-6">
        <ProductGrid job={jobKey} jobStatement={jobStatement} />
      </div>
    </main>
  )
}
