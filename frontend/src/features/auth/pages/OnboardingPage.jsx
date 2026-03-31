import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, Phone, ChevronRight, Rocket, ShieldCheck, Zap } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const schema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
  phoneNumber: z.string().length(10, 'Phone number must be 10 digits').regex(/^\d+$/, 'Only digits allowed'),
})

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, setAuth } = useAuthStore()
  const [step, setStep] = React.useState(1)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  // Mutation to complete onboarding
  const { mutate: completeOnboarding, isPending } = useMutation({
    mutationFn: (data) => authAPI.completeOnboarding(data),
    onSuccess: async () => {
      // 1. Trigger a full auth check to fetch the fresh user, roles, and organization state
      // This is more reliable than manual merging as it ensures consistent state across the app
      await useAuthStore.getState().checkAuth()
      
      toast.success('Onboarding complete! Welcome aboard.')
      // 2. Redirect only after state is refreshed
      navigate('/dashboard', { replace: true })
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Onboarding failed. Please try again.'
      toast.error(message)
    }
  })

  const nextStep = () => setStep(step + 1)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-primary-500/10 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 h-full">
          {/* Sidebar Info */}
          <div className="md:col-span-2 bg-primary-600 p-8 text-white space-y-8 flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
             <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-40 h-40 bg-primary-400/20 rounded-full blur-3xl" />
             
             <div className="space-y-6 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                   <Rocket className="text-white" size={24} />
                </div>
                <div className="space-y-2">
                   <h3 className="text-2xl font-black tracking-tight">Almost there!</h3>
                   <p className="text-primary-100 text-sm font-medium leading-relaxed">
                     Setup your organization to unlock the full power of CalTIMS.
                   </p>
                </div>
             </div>

             <div className="space-y-4 relative z-10">
                {[
                  { icon: ShieldCheck, text: 'Isolated workspace' },
                  { icon: Zap, text: 'Custom permissions' },
                  { icon: Building2, text: 'Multi-tenant secure' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs font-bold text-primary-50 uppercase tracking-widest">
                    <item.icon size={16} className="text-primary-300" />
                    <span>{item.text}</span>
                  </div>
                ))}
             </div>
          </div>

          {/* Form Area */}
          <div className="md:col-span-3 p-10 md:p-14 space-y-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                 {[1, 2].map((i) => (
                   <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-primary-600' : 'w-4 bg-slate-200'}`} />
                 ))}
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                {step === 1 ? 'Tell us about your org' : 'Personal verification'}
              </h2>
            </div>

            <form onSubmit={handleSubmit(completeOnboarding)} className="space-y-8">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2 group">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Company Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                        <input
                          {...register('organizationName')}
                          className={`w-full h-16 pl-14 pr-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-base font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none ${errors.organizationName ? 'border-red-500' : ''}`}
                          placeholder="e.g. Acme Corp"
                        />
                      </div>
                      {errors.organizationName && <p className="text-xs text-red-500 font-bold ml-2">{errors.organizationName.message}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={nextStep}
                      className="w-full h-16 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/10"
                    >
                      Next Step
                      <ChevronRight size={20} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2 group">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                        <input
                          {...register('phoneNumber')}
                          maxLength={10}
                          onInput={(e) => {
                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                          }}
                          className={`w-full h-16 pl-14 pr-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-base font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none ${errors.phoneNumber ? 'border-red-500' : ''}`}
                          placeholder="10 digit number"
                        />
                      </div>
                      {errors.phoneNumber && <p className="text-xs text-red-500 font-bold ml-2">{errors.phoneNumber.message}</p>}
                    </div>

                    <div className="flex gap-4 pt-4">
                       <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex-1 h-16 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="flex-[2] h-16 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-70 transition-all shadow-xl shadow-primary-600/20"
                      >
                        {isPending ? <Spinner size="sm" color="white" /> : (
                          <>
                            <span>Complete Setup</span>
                            <Zap size={20} />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
