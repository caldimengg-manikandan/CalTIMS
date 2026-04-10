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
        // 1. Absolute Privileged Roles Bypass: Super Admin and Owner Always have access
        const role = user?.role?.toLowerCase();
        if (role === 'super_admin' || user.isOwner) return true;

        // 2. Organization Plan Check
        const plan = subscription?.planType || 'TRIAL';
        const features = PLAN_FEATURES[plan];
        
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
