import { useAuthStore } from '@/store/authStore';
import { userAPI, subscriptionAPI } from '@/services/endpoints';
import { useCallback } from 'react';

export const useAuth = () => {
    const store = useAuthStore();

    const loginWithToken = useCallback(async (token, refreshToken) => {
        // 1. Set tokens in store (will be persisted)
        store.setAccessToken(token);
        store.setRefreshToken(refreshToken);

        try {
            // 2. Fetch user and subscription data
            const [userRes, subRes] = await Promise.all([
                userAPI.getMe(),
                subscriptionAPI.getCurrent().catch(() => ({ data: { data: null } }))
            ]);

            const user = userRes.data.data;
            const subscription = subRes.data.data;

            // 3. Update store with full user data
            store.setAuth(user, token, refreshToken, subscription);
            
            return user;
        } catch (error) {
            console.error('LoginWithToken failed:', error);
            store.logout();
            throw error;
        }
    }, [store]);

    return {
        ...store,
        loginWithToken
    };
};
