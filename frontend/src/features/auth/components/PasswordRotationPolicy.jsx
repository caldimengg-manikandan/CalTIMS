import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AlertCircle, ArrowRight, X } from 'lucide-react';

export default function PasswordRotationPolicy() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [notificationConfig, setNotificationConfig] = useState(null);

    useEffect(() => {
        if (!user) return;

        // Base date is passwordChangedAt, or fallback to createdAt
        const baseDateString = user.passwordChangedAt || user.createdAt;
        if (!baseDateString) return;

        const baseDate = new Date(baseDateString);
        const now = new Date();
        const diffTime = Math.abs(now - baseDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const LOCAL_STORAGE_KEY_80 = `pwd_reminder_80_${user.id}`;
        const LOCAL_STORAGE_KEY_85 = `pwd_reminder_85_${user.id}`;

        // 90 days or more: force redirect to change password
        if (diffDays >= 90) {
            if (location.pathname !== '/settings/profile') {
                navigate('/settings/profile', { state: { forcePasswordChange: true }, replace: true });
            }
            return;
        }

        // Between 85 and 89 days: Daily reminder
        if (diffDays >= 85 && diffDays <= 89) {
            const lastDismissedDate = localStorage.getItem(LOCAL_STORAGE_KEY_85);
            const todayStr = now.toDateString();

            if (lastDismissedDate !== todayStr) {
                const daysLeft = 90 - diffDays;
                setNotificationConfig({
                    type: 'daily',
                    daysLeft,
                    onReject: () => {
                        localStorage.setItem(LOCAL_STORAGE_KEY_85, todayStr);
                        setNotificationConfig(null);
                    }
                });
            } else {
                setNotificationConfig(null);
            }
            return;
        }

        // Between 80 and 84 days: One-time reminder
        if (diffDays >= 80 && diffDays <= 84) {
            const hasDismissed = localStorage.getItem(LOCAL_STORAGE_KEY_80);
            if (!hasDismissed) {
                const daysLeft = 90 - diffDays;
                setNotificationConfig({
                    type: 'onetime',
                    daysLeft,
                    onReject: () => {
                        localStorage.setItem(LOCAL_STORAGE_KEY_80, 'true');
                        setNotificationConfig(null);
                    }
                });
            } else {
                setNotificationConfig(null);
            }
            return;
        }

    }, [user, location.pathname, navigate]);

    if (!notificationConfig) return null;

    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 px-4 py-3 sm:px-6 z-50 animate-fade-in flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <div className="flex p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex flex-col">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                            Password Expiry Notice
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            Your password will expire in {notificationConfig.daysLeft} {notificationConfig.daysLeft === 1 ? 'day' : 'days'}. Please change it soon to avoid being locked out.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/settings/profile')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
                    >
                        Reset Password
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={notificationConfig.onReject}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Reject
                    </button>
                </div>
            </div>
        </div>
    );
}
