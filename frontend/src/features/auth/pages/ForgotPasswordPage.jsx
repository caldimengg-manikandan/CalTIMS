import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, Key, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const emailSchema = z.object({ email: z.string().email('Enter a valid email') })
const otpSchema = z.object({ otp: z.string().length(6, 'Enter the 6-digit code') })
const passwordSchema = z.object({
    password: z.string().min(8, 'Minimum 8 characters'),
    confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ['confirm'] })

export default function ForgotPasswordPage() {
    const navigate = useNavigate()
    const [step, setStep] = React.useState(1) // 1: Email, 2: OTP, 3: New Password
    const [email, setEmail] = React.useState('')
    const [otp, setOtp] = React.useState('')
    const [showPassword, setShowPassword] = React.useState(false)

    // --- Step 1: Send OTP ---
    const emailForm = useForm({ resolver: zodResolver(emailSchema) })
    const { mutate: sendOTP, isPending: isSending } = useMutation({
        mutationFn: (data) => authAPI.forgotPasswordOTP(data.email),
        onSuccess: (_, variables) => {
            setEmail(variables.email)
            setStep(2)
            toast.success('Recovery code sent to your email')
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to send code')
        }
    })

    // --- Step 2: Verify OTP ---
    const otpForm = useForm({ resolver: zodResolver(otpSchema) })
    const { mutate: verifyOTP, isPending: isVerifying } = useMutation({
        mutationFn: (data) => authAPI.verifyResetOTP(email, data.otp),
        onSuccess: (_, variables) => {
            setOtp(variables.otp)
            setStep(3)
            toast.success('Code verified. Set your new password.')
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Invalid code')
        }
    })

    // --- Step 3: Reset Password ---
    const passwordForm = useForm({ resolver: zodResolver(passwordSchema) })
    const { mutate: resetPassword, isPending: isResetting } = useMutation({
        mutationFn: (data) => authAPI.resetPasswordWithOTP(email, otp, data.password),
        onSuccess: () => {
            toast.success('Password updated! You can now log in.')
            navigate('/login')
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Reset failed')
        }
    })

    const slideVariants = {
        enter: { x: 20, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0 }
    }

    return (
        <div className="w-full">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm overflow-hidden"
            >
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                            <div className="space-y-2 text-center">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Recovery</h1>
                                <p className="text-sm text-slate-500 font-medium tracking-tight">Enter your email to receive a recovery code.</p>
                            </div>

                            <form onSubmit={emailForm.handleSubmit(sendOTP)} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                                        <input
                                            {...emailForm.register('email')}
                                            type="email"
                                            className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all"
                                            placeholder="name@company.com"
                                        />
                                    </div>
                                    {emailForm.formState.errors.email && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">{emailForm.formState.errors.email.message}</p>}
                                </div>

                                <button type="submit" disabled={isSending} className="w-full h-12 bg-[var(--color-primary)] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[var(--color-primary)]/10">
                                    {isSending ? <Spinner size="sm" color="white" /> : <span>Send Code</span>}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                            <div className="space-y-2 text-center">
                                <div className="w-16 h-16 bg-[var(--color-primary)]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck className="text-[var(--color-primary)]" size={32} />
                                </div>
                                <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Verify Code</h1>
                                <p className="text-xs font-medium text-slate-500 px-4">We've sent a 6-digit code to <span className="text-slate-900 dark:text-white font-bold">{email}</span></p>
                            </div>

                            <form onSubmit={otpForm.handleSubmit(verifyOTP)} className="space-y-5">
                                <div className="space-y-1.5 text-center">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">OTP Code</label>
                                    <input
                                        {...otpForm.register('otp')}
                                        type="text"
                                        maxLength={6}
                                        autoFocus
                                        className="w-full h-14 text-center text-2xl font-black tracking-[0.5em] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all"
                                        placeholder="000000"
                                    />
                                    {otpForm.formState.errors.otp && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{otpForm.formState.errors.otp.message}</p>}
                                </div>

                                <button type="submit" disabled={isVerifying} className="w-full h-12 bg-[var(--color-primary)] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/10">
                                    {isVerifying ? <Spinner size="sm" color="white" /> : <span>Verify & Continue</span>}
                                </button>

                                <button type="button" onClick={() => setStep(1)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[var(--color-primary)] transition-colors">
                                    Incorrect email? Go back
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                            <div className="space-y-2 text-center">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Set New Password</h1>
                                <p className="text-xs font-medium text-slate-500">Pick something secure that you haven't used before.</p>
                            </div>

                            <form onSubmit={passwordForm.handleSubmit(resetPassword)} className="space-y-5">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                                            <input
                                                {...passwordForm.register('password')}
                                                type={showPassword ? 'text' : 'password'}
                                                className="w-full h-12 pl-12 pr-12 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all"
                                                placeholder="••••••••"
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                                            <input
                                                {...passwordForm.register('confirm')}
                                                type={showPassword ? 'text' : 'password'}
                                                className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        {passwordForm.formState.errors.confirm && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">{passwordForm.formState.errors.confirm.message}</p>}
                                    </div>
                                </div>

                                <button type="submit" disabled={isResetting} className="w-full h-12 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none">
                                    {isResetting ? <Spinner size="sm" color="white" /> : <span>Update Password</span>}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800/50">
                    <Link to="/login" className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[var(--color-primary)] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Return to Sign In</span>
                    </Link>
                </div>
            </motion.div>
        </div>
    )
}
