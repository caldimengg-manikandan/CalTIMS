import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

export default function OAuthSuccessPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');

        if (token && refreshToken) {
            handleSuccess(token, refreshToken);
        } else {
            toast.error('Authentication failed. Please try again.');
            navigate('/login');
        }
    }, [searchParams]);

    const handleSuccess = async (token, refreshToken) => {
        try {
            // Save tokens and get user data
            const user = await loginWithToken(token, refreshToken);
            
            toast.success('Successfully logged in with Google!');

            if (!user.isOnboardingComplete) {
                navigate('/onboarding');
            } else {
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('OAuth Success Handler Error:', error);
            toast.error('Failed to complete login. Please try again.');
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="text-center space-y-4">
                <Spinner size="lg" />
                <p className="text-slate-500 dark:text-slate-400 animate-pulse">Completing secure login...</p>
            </div>
        </div>
    );
}
