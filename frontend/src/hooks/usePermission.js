import { useAuthStore } from '../store/authStore';
import { hasPermission, isSuperAdmin, hasFullAccess, canAccessModule } from '../utils/rbac';

export const usePermission = () => {
    const user = useAuthStore(state => state.user);

    return {
        // Core capability
        can: (module, submodule, action) => hasPermission(user, module, submodule, action),
        canAccessModule: (module) => canAccessModule(user, module),
        
        // Privilege levels
        isAdmin: () => isSuperAdmin(user),
        hasFullAccess: () => hasFullAccess(user),
        
        // Common quick checks
        canAccessPayroll: () => canAccessModule(user, 'Payroll'),
        canRunPayroll: () => hasPermission(user, 'Payroll', 'Payroll Engine', 'run')
    };
};
