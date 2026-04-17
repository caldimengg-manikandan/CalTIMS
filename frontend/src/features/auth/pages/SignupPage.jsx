import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Building2, User, Phone, CheckCircle2 } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name is required'),
  organizationName: z.string().min(2, 'Organization name is required'),
  phoneNumber: z.string().length(10, 'Phone number must be 10 digits').regex(/^\d+$/, 'Only digits allowed'),
  otp: z.string().length(6, 'Verification code must be 6 digits'),
})

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function SignupPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const general = useSettingsStore((s) => s.general)
  const companyName = general?.branding?.organizationName || general?.organization?.companyName || 'CalTIMS'
  
  const [showPassword, setShowPassword] = React.useState(false)
  const [emailSent, setEmailSent] = React.useState(false)
  const [emailVerified, setEmailVerified] = React.useState(false)
  const [isSendingOTP, setIsSendingOTP] = React.useState(false)
  const [isVerifyingOTP, setIsVerifyingOTP] = React.useState(false)

  const handleSendOTP = async (email) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid work email')
      return
    }
    
    setIsSendingOTP(true)
    try {
      await authAPI.sendVerificationOTP(email)
      setEmailSent(true)
      toast.success('Verification code sent to your email')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send code')
    } finally {
      setIsSendingOTP(false)
    }
  }

  const handleVerifyOTP = async (email, otp) => {
    if (!otp || otp.length !== 6) {
      toast.error('Enter 6-digit code')
      return
    }
    
    setIsVerifyingOTP(true)
    try {
      await authAPI.verifyVerificationOTP(email, otp)
      setEmailVerified(true)
      toast.success('Email verified successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code')
    } finally {
      setIsVerifyingOTP(false)
    }
  }

  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    shouldUnregister: false,
  })

  const formValues = watch()

  const { mutate: signup, isPending } = useMutation({
    mutationFn: (data) => authAPI.register(data),
    onSuccess: () => {
      toast.success('Account created successfully! Please log in.')
      navigate('/login', { replace: true })
    },
    onError: (err) => {
      const { message, errors: serverErrors } = err.response?.data || {}

      if (serverErrors && typeof serverErrors === 'object') {
        Object.entries(serverErrors).forEach(([field, msg]) => {
          setError(field, { type: 'server', message: msg })
          toast.error(msg, { id: msg })
        })
      } else {
        const fallbackMsg = message || 'Registration failed. Please try again.'
        toast.error(fallbackMsg, { id: fallbackMsg })
      }
    }
  })

  const { mutate: socialLogin, isPending: isSocialPending } = useMutation({
    mutationFn: (data) => authAPI.socialLogin(data),
    onSuccess: (res) => {
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(user, accessToken, refreshToken)
      toast.success(`Authenticated with ${user.provider}!`)
      navigate('/onboarding', { replace: true })
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Social login failed'
      toast.error(message)
    }
  })

  const handleSocialLogin = (provider) => {
    // Standard OAuth redirect to backend for social providers
    window.location.href = `${window.location.origin}${import.meta.env.BASE_URL}api/v1/auth/${provider}`
  }

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm"
      >
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Join {companyName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Please enter your details to create an account.</p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={isSocialPending}
              className="w-full h-11 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                <span className="flex-shrink mx-4 text-xs font-medium text-slate-400 dark:text-slate-500">or sign up with email</span>
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit(signup)} className="space-y-5">
            <div className="space-y-1.5 group">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                <input
                  {...register('name')}
                  className={`w-full h-11 pl-10 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 group">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Organization</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                  <input
                    {...register('organizationName')}
                    className={`w-full h-11 pl-10 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.organizationName ? 'border-red-500' : ''}`}
                    placeholder="Company Name"
                  />
                </div>
                {errors.organizationName && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.organizationName.message}</p>}
              </div>

              <div className="space-y-1.5 group">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                  <input
                    {...register('phoneNumber')}
                    maxLength={10}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    }}
                    className={`w-full h-11 pl-10 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.phoneNumber ? 'border-red-500' : ''}`}
                    placeholder="10-digit number"
                  />
                </div>
                {errors.phoneNumber && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.phoneNumber.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5 group">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                <input
                  {...register('email')}
                  type="email"
                  readOnly={emailVerified}
                  className={`w-full h-11 pl-10 ${emailVerified ? 'pr-10' : 'pr-28'} bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.email ? 'border-red-500' : ''} ${emailVerified ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : ''}`}
                  placeholder="name@company.com"
                />
                {!emailVerified && (
                  <button
                    type="button"
                    disabled={isSendingOTP || !formValues.email}
                    onClick={() => handleSendOTP(formValues.email)}
                    className="absolute right-2 top-1.5 bottom-1.5 px-3 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold uppercase rounded-md hover:bg-black dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {isSendingOTP ? <Spinner size="xs" color="white" /> : emailSent ? 'Resend' : 'Verify'}
                  </button>
                )}
                {emailVerified && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 flex items-center justify-center">
                     <CheckCircle2 size={18} strokeWidth={3} />
                  </div>
                )}
              </div>
              {errors.email && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.email.message}</p>}
            </div>

            {emailSent && !emailVerified && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30"
              >
                <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-300 mb-2">Security Code</label>
                <div className="flex gap-2">
                  <input
                    {...register('otp')}
                    maxLength={6}
                    className="flex-1 h-11 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/50 rounded-lg text-center text-lg font-black tracking-[0.5em] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="000000"
                  />
                  <button
                    type="button"
                    disabled={isVerifyingOTP || !formValues.otp}
                    onClick={() => handleVerifyOTP(formValues.email, formValues.otp)}
                    className="px-6 bg-indigo-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    {isVerifyingOTP ? <Spinner size="xs" color="white" /> : 'Check'}
                  </button>
                </div>
                <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Check your inbox for the 6-digit code</p>
              </motion.div>
            )}

            {(emailVerified || !emailSent) && (
              <div className={`space-y-1.5 group transition-all ${!emailVerified ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className={`w-full h-11 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.password ? 'border-red-500' : ''}`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-10 p-1"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.password.message}</p>}
                {!emailVerified && <p className="text-[10px] text-slate-400 font-bold uppercase">Verify email to set password</p>}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending || !emailVerified}
                className="w-full h-11 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? <Spinner size="sm" color="white" /> : (
                  <span>Create organization</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-900 dark:text-white hover:text-[var(--color-primary)] transition-colors font-bold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
