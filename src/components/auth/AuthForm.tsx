// import { FormEvent, useState } from 'react'
// import { Link } from 'react-router-dom'
// import { Sparkles } from 'lucide-react'
// import { useAuth } from '../../hooks/useApi'
// import { getApiError } from '../../services/api'
// import { loginSchema, registerSchema } from '../../utils/validation'
// import { ErrorAlert } from '../common/ErrorAlert'

// export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
//   const { login, register } = useAuth(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const isRegister = mode === 'register'; const mutation = isRegister ? register : login
//   const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); const result = (isRegister ? registerSchema : loginSchema).safeParse(isRegister ? { name, email, password } : { email, password }); if (!result.success) { setError(result.error.issues[0]?.message ?? 'Please check your details'); return } try { await mutation.mutateAsync(result.data as never) } catch (reason) { setError(getApiError(reason, 'Unable to authenticate')) } }
//   return <main className="auth-page"><div className="auth-aside"><div className="brand"><span className="brand-mark"><span /></span><span>framewell</span></div><div><p className="eyebrow">Visual storytelling, clarified</p><h1>Make complex ideas feel simple.</h1><p>Build animated explainers from a voiceover, a prompt, and your point of view.</p></div><span className="auth-caption">A calmer way to make something clear.</span></div><section className="auth-card"><div className="auth-heading"><div className="auth-icon"><Sparkles size={19} /></div><p className="eyebrow">{isRegister ? 'Create your workspace' : 'Welcome back'}</p><h2>{isRegister ? 'Start making stories.' : 'Sign in to Framewell.'}</h2><p>{isRegister ? 'Your next clear idea starts here.' : 'Pick up where your last story left off.'}</p></div><ErrorAlert message={error} /><form onSubmit={submit}>{isRegister && <label className="field-label">Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jordan Davis" /></label>}<label className="field-label">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label><label className="field-label">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? '12 characters minimum' : 'Your password'} /></label><button className="button primary auth-submit" disabled={mutation.isPending}>{mutation.isPending ? 'Working...' : isRegister ? 'Create account' : 'Sign in'} </button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Framewell?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p></section></main>
// }
// ```tsx
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { useAuth } from '../../hooks/useApi'
import { getApiError } from '../../services/api'
import { loginSchema, registerSchema } from '../../utils/validation'
import { ErrorAlert } from '../common/ErrorAlert'
import { useToast } from '../../hooks/useToast'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const isRegister = mode === 'register'
  const mutation = isRegister ? register : login

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const result = (isRegister ? registerSchema : loginSchema).safeParse(
      isRegister ? { name, email, password } : { email, password },
    )

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check your details')
      return
    }

    try {
      await mutation.mutateAsync(result.data as never)
      showToast(isRegister ? 'Account created successfully!' : 'Welcome back!', 'success')
      navigate('/', { replace: true })
    } catch (reason) {
      const errorMessage = getApiError(reason, 'Unable to authenticate')
      setError(errorMessage)
      showToast(errorMessage, 'error')
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-aside">
        <div className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>framewell</span>
        </div>

        <div>
          <p className="eyebrow">Visual storytelling, clarified</p>
          <h1>Make complex ideas feel simple.</h1>
          <p>
            Build animated explainers from a voiceover, a prompt, and your
            point of view.
          </p>
        </div>

        <span className="auth-caption">
          A calmer way to make something clear.
        </span>
      </div>

      <section className="auth-card">
        <div className="auth-heading">
          <div className="auth-icon">
            <Sparkles size={19} />
          </div>

          <p className="eyebrow">
            {isRegister ? 'Create your workspace' : 'Welcome back'}
          </p>

          <h2>
            {isRegister ? 'Start making stories.' : 'Sign in to Framewell.'}
          </h2>

          <p>
            {isRegister
              ? 'Your next clear idea starts here.'
              : 'Pick up where your last story left off.'}
          </p>
        </div>

        <ErrorAlert message={error} />

        <form onSubmit={submit}>
          {isRegister && (
            <label className="field-label">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jordan Davis"
              />
            </label>
          )}

          <label className="field-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <label className="field-label">
            Password

            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  isRegister ? '12 characters minimum' : 'Your password'
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            className="button primary auth-submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? 'Working...'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to Framewell?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}


