import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, ChevronRight, Mail, Lock, Building2, User, Phone } from 'lucide-react'
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
  phoneNumber: z.string().min(10, 'Enter a valid phone number'),
})

export default function SignupPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = React.useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const { mutate: signup, isPending } = useMutation({
    mutationFn: (data) => authAPI.register(data),
    onSuccess: () => {
      toast.success('Registration successful! Please sign in to access your account.')
      navigate('/login', { replace: true })
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Registration failed. Please try again.'
      toast.error(message)
    }
  })

  return (
    <div className="w-full max-w-xl mx-auto space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-10"
      >
        <div className="space-y-6 text-center lg:text-left">
          <div className="space-y-3">
            <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">Get Started</h2>
            <div className="h-2 w-16 bg-primary-600 rounded-full mx-auto lg:ml-1" />
          </div>
          <p className="text-slate-500 font-medium">Create your account and start your 28-day free trial today.</p>
        </div>

        <form onSubmit={handleSubmit(signup)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 group">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input
                  {...register('name')}
                  className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 font-bold ml-2">{errors.name.message}</p>}
            </div>

            <div className="space-y-2 group">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input
                  {...register('phoneNumber')}
                  className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.phoneNumber ? 'border-red-500' : ''}`}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              {errors.phoneNumber && <p className="text-xs text-red-500 font-bold ml-2">{errors.phoneNumber.message}</p>}
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Organization Name</label>
            <div className="relative">
              <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
              <input
                {...register('organizationName')}
                className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.organizationName ? 'border-red-500' : ''}`}
                placeholder="Acme Corp"
              />
            </div>
            {errors.organizationName && <p className="text-xs text-red-500 font-bold ml-2">{errors.organizationName.message}</p>}
          </div>

          <div className="space-y-2 group">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
              <input
                {...register('email')}
                type="email"
                className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.email ? 'border-red-500' : ''}`}
                placeholder="name@company.com"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 font-bold ml-2">{errors.email.message}</p>}
          </div>

          <div className="space-y-2 group">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                className={`w-full h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.password ? 'border-red-500' : ''}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 font-bold ml-2">{errors.password.message}</p>}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isPending ? <Spinner size="sm" color="white" /> : (
                <>
                  <span>Create Account</span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
