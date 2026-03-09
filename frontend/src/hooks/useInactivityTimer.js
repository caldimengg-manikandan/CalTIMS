import { useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'

const INACTIVITY_TIME = 10 * 60 * 1000 // 10 minutes

export function useInactivityTimer() {
    const { logout } = useAuthStore()
    const timerRef = useRef()

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        
        timerRef.current = setTimeout(() => {
            logout()
        }, INACTIVITY_TIME)
    }, [logout])

    useEffect(() => {
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
        
        const handleActivity = () => {
            resetTimer()
        }

        events.forEach(event => {
            window.addEventListener(event, handleActivity)
        })

        // Initial set
        resetTimer()

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleActivity)
            })
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [resetTimer])
}
