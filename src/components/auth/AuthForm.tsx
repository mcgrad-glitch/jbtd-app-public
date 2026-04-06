'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type State = 'idle' | 'loading' | 'sent' | 'error'

export default function AuthForm() {
  const [email,   setEmail]   = useState('')
  const [state,   setState]   = useState<State>('idle')
  const [errMsg,  setErrMsg]  = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setState('loading')
    setErrMsg('')

    const supabase = createClient()
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`
    console.log('NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL)
    console.log('redirectUrl:', redirectUrl)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      setErrMsg(error.message)
      setState('error')
    } else {
      setState('sent')
    }
  }, [email])

  if (state === 'sent') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="text-4xl">📬</span>
        <p className="text-base font-semibold text-gray-900">
          Проверьте почту — ссылка уже там
        </p>
        <p className="text-sm text-gray-500">
          Отправили на <span className="font-medium text-gray-700">{email}</span>
        </p>
        <button
          onClick={() => setState('idle')}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Изменить email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900
                     placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400
                     transition-colors"
        />
      </div>

      {state === 'error' && (
        <p className="text-xs text-red-500">{errMsg}</p>
      )}

      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full py-3 rounded-xl bg-black text-white text-sm font-medium
                   hover:bg-gray-800 active:scale-[0.98] transition-all duration-150
                   disabled:opacity-40"
      >
        {state === 'loading' ? 'Отправка…' : 'Войти через email'}
      </button>

      <p className="text-center text-xs text-gray-400">
        Пришлём ссылку — пароль не нужен
      </p>
    </form>
  )
}
