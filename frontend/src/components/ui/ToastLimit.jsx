import { useEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';

/**
 * Component that limits the number of visible toasts in react-hot-toast.
 * Defaults to 3 toasts.
 */
const ToastLimit = ({ limit = 3 }) => {
    const { toasts } = useToasterStore();

    useEffect(() => {
        const visibleToasts = toasts.filter((t) => t.visible);
        if (visibleToasts.length > limit) {
            // Dismiss oldest toasts (those at the beginning of the array)
            const toastsToDismiss = visibleToasts.slice(0, visibleToasts.length - limit);
            toastsToDismiss.forEach((t) => toast.dismiss(t.id));
        }
    }, [toasts, limit]);

    return null;
};

export default ToastLimit;
