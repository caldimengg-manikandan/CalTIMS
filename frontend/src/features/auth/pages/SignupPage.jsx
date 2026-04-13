import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Building2, User, Phone } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name is required'),
  organizationName: z.string().min(2, 'Organization name is required'),
  phoneNumber: z.string().length(10, 'Phone number must be 10 digits').regex(/^\d+$/, 'Only digits allowed'),
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
  const [showPassword, setShowPassword] = React.useState(false)

  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

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
    socialLogin({
      email: `demo_${provider}_new@example.com`,
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      provider
    })
  }

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
      >
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Join CalTIMS</h2>
            <p className="text-sm text-slate-500 font-medium">Please enter your details to create an account.</p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={isSocialPending}
              className="w-full h-11 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-xs font-medium text-slate-400">or sign up with email</span>
                <div className="flex-grow border-t border-slate-100"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit(signup)} className="space-y-5">
            <div className="space-y-1.5 group">
              <label className="block text-sm font-semibold text-slate-700">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors" size={18} />
                <input
                  {...register('name')}
                  className={`w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:border-black transition-all outline-none ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 group">
                <label className="block text-sm font-semibold text-slate-700">Organization</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors" size={18} />
                  <input
                    {...register('organizationName')}
                    className={`w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:border-black transition-all outline-none ${errors.organizationName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                    placeholder="Company Name"
                  />
                </div>
                {errors.organizationName && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.organizationName.message}</p>}
              </div>

              <div className="space-y-1.5 group">
                <label className="block text-sm font-semibold text-slate-700">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors" size={18} />
                  <input
                    {...register('phoneNumber')}
                    maxLength={10}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    }}
                    className={`w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:border-black transition-all outline-none ${errors.phoneNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                    placeholder="10-digit number"
                  />
                </div>
                {errors.phoneNumber && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.phoneNumber.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5 group">
              <label className="block text-sm font-semibold text-slate-700">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors" size={18} />
                <input
                  {...register('email')}
                  type="email"
                  className={`w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:border-black transition-all outline-none ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                  placeholder="name@company.com"
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5 group">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors" size={18} />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:border-black transition-all outline-none ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.password.message}</p>}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-11 bg-black text-white hover:bg-slate-800 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? <Spinner size="sm" color="white" /> : (
                  <span>Create account</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-900 hover:text-indigo-600 transition-colors font-bold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
