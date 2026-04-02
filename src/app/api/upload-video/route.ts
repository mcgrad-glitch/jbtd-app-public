import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

// Клиент с service role — обходит RLS, только на сервере
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData()
    const file       = formData.get('file') as File | null
    const productId  = formData.get('product_id') as string | null
    const requestId  = formData.get('request_id') as string | null

    if (!file || !productId || !requestId) {
      return NextResponse.json(
        { url: null, error: 'Missing required fields: file, product_id, request_id' },
        { status: 400 }
      )
    }

    const supabase    = createServiceClient()
    const storagePath = `${productId}/${requestId}.mp4`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error('[upload-video] storage error:', uploadError)
      return NextResponse.json({ url: null, error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(storagePath)

    console.log('[upload-video] uploaded:', uploadData?.path, '→', publicUrl)

    return NextResponse.json({ url: publicUrl, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[upload-video] unexpected error:', message)
    return NextResponse.json({ url: null, error: message }, { status: 500 })
  }
}
