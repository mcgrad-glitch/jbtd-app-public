'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab  = 'buyer' | 'expert'
type Mode = 'login' | 'register'

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials':              'Неверный email или пароль',
  'User already registered':                'Этот email уже зарегистрирован',
  'Password should be at least 6 characters': 'Пароль минимум 6 символов',
}

function mapError(msg: string): string {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg.includes(key)) return val
  }
  return msg
}

export default function AuthForm() {
  const router = useRouter()

  const [tab,             setTab]             = useState<Tab>('buyer')
  const [mode,            setMode]            = useState<Mode>('login')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [errMsg,          setErrMsg]          = useState('')

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setErrMsg('')
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setMode('login')
    resetForm()
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setErrMsg('')
  }

  // ── Покупатель ─────────────────────────────────────────────────────────────

  const handleBuyer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setErrMsg('')

    if (mode === 'register' && password !== confirmPassword) {
      setErrMsg('Пароли не совпадают')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setErrMsg(mapError(error.message))
    } else {
      router.push('/catalog')
    }
  }, [email, password, confirmPassword, mode, router])

  // ── Эксперт ────────────────────────────────────────────────────────────────

  const handleExpert = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setErrMsg('')
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setErrMsg(mapError(error.message))
      return
    }

    const expertEmail = process.env.NEXT_PUBLIC_EXPERT_EMAIL
    if (data.user?.email !== expertEmail) {
      await supabase.auth.signOut()
      setErrMsg('Нет доступа к панели эксперта')
      return
    }

    router.push('/expert')
  }, [email, password, router])

  // ── Стили вкладок ──────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => active
    ? {
        paddingBottom: 10,
        borderBottom: '2px solid var(--brand-primary)',
        background: 'var(--brand-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
      }
    : {
        paddingBottom: 10,
        borderBottom: '2px solid transparent',
        color: 'var(--text-tertiary)',
        fontWeight: 500,
        fontSize: 15,
        cursor: 'pointer',
      }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '11px 14px',
    fontSize: 14,
    color: 'var(--text-primary)',
    background: 'var(--bg-primary)',
    outline: 'none',
    fontFamily: 'var(--font-dm-sans)',
  }

  // ── Рендер ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Вкладки */}
      <div className="flex gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          className="font-heading"
          style={tabStyle(tab === 'buyer')}
          onClick={() => switchTab('buyer')}
        >
          Покупатель
        </button>
        <button
          type="button"
          className="font-heading"
          style={tabStyle(tab === 'expert')}
          onClick={() => switchTab('expert')}
        >
          Эксперт
        </button>
      </div>

      {/* ── Вкладка Покупатель ─────────────────────────────────────────────── */}
      {tab === 'buyer' && (
        <form onSubmit={handleBuyer} className="flex flex-col gap-4">

          {/* Переключатель режима */}
          <div className="flex gap-1 p-1" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 font-body transition-all duration-150"
                style={{
                  padding: '7px 0',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  fontSize: 13,
                  fontWeight: 500,
                  ...(mode === m
                    ? { background: 'var(--bg-primary)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                    : { background: 'transparent', color: 'var(--text-tertiary)' }),
                }}
              >
                {m === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
            {mode === 'register' && (
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            )}
          </div>

          {errMsg && (
            <p className="font-body" style={{ fontSize: 13, color: '#EF4444' }}>{errMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            style={{ padding: '13px 24px', borderRadius: 'var(--radius-md)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Загрузка…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>

          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="font-body text-center"
            style={{ fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {mode === 'login'
              ? 'Нет аккаунта? Зарегистрироваться'
              : 'Уже есть аккаунт? Войти'}
          </button>
        </form>
      )}

      {/* ── Вкладка Эксперт ────────────────────────────────────────────────── */}
      {tab === 'expert' && (
        <form onSubmit={handleExpert} className="flex flex-col gap-4">

          <div className="flex flex-col gap-3">
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {errMsg && (
            <p className="font-body" style={{ fontSize: 13, color: '#EF4444' }}>{errMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            style={{ padding: '13px 24px', borderRadius: 'var(--radius-md)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Загрузка…' : 'Войти как эксперт'}
          </button>
        </form>
      )}

    </div>
  )
}
