import { useAuthStore } from '@/store/authStore';
import { PLAN_FEATURES } from '@/constants/plans';

/**
 * Custom hook for checking feature access based on subscription plan and user role.
 * Consolidates RBAC and Subscription gating logic.
 */
export const useFeatureAccess = () => {
    const { user, subscription } = useAuthStore();

    /**
     * Checks if a feature is accessible.
     * @param {string} featureKey - The key of the feature to check (from PLAN_FEATURES)
     * @returns {boolean} - True if accessible, false if locked
     */
    const hasAccess = (featureKey) => {
        // 1. Super Admin Exception: Always has full access
        if (user?.role === 'super_admin') return true;

        // 2. If no subscription, default to TRIAL (or handle as locked)
        const plan = subscription?.planType || 'TRIAL';
        
        // 3. Check if feature exists in PLAN_FEATURES for this plan
        const features = PLAN_FEATURES[plan];
        
        // If feature is explicitly set to true, return true
        if (features && features[featureKey] === true) {
            return true;
        }

        return false;
    };

    /**
     * Checks if a feature is locked (inverse of hasAccess).
     * Useful for UI states like disabled buttons or lock icons.
     * @param {string} featureKey 
     * @returns {boolean}
     */
    const isFeatureLocked = (featureKey) => !hasAccess(featureKey);

    return {
        hasAccess,
        isFeatureLocked,
        planType: subscription?.planType || 'TRIAL',
        userRole: user?.role
    };
};
