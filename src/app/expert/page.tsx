import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExpertDashboard from '@/components/expert/ExpertDashboard'

export default async function ExpertPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-[390px] px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Панель эксперта</h1>
          <p className="text-sm text-gray-500 mt-0.5">Запросы на видеообзор</p>
        </div>
        <ExpertDashboard expertId={user.id} />
      </div>
    </main>
  )
}
