import React, { useState, useEffect, useMemo } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { getTourSteps } from '../constants/tourSteps';
import TourTooltip from './TourTooltip';
import { useLocation } from 'react-router-dom';

export default function OnboardingTour() {
    const { user, isPro, hasCompletedTour, setHasCompletedTour } = useAuthStore();
    const { sidebarOpen, setSidebar } = useUIStore();
    const location = useLocation();

    const [run, setRun] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    const steps = useMemo(() => getTourSteps(user, isPro()), [user, isPro]);

    // Role check helper
    const isAdmin = ['admin', 'manager'].includes(user?.role);

    useEffect(() => {
        // Start tour if user is logged in, hasn't completed it, and is on the dashboard
        // We only auto-start on dashboard to ensure the first few steps (hero, chart) are present
        const shouldStart = user && !hasCompletedTour && (location.pathname === '/dashboard' || (isAdmin && location.pathname === '/admin/dashboard'));
        
        if (shouldStart) {
            // Small delay to ensure page elements are fully rendered/animated
            const timer = setTimeout(() => setRun(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [user, hasCompletedTour, location.pathname, isAdmin]);

    // Force sidebar open during tour if we are on sidebar steps
    useEffect(() => {
        if (run && stepIndex > 1 && !sidebarOpen) {
            setSidebar(true);
        }
    }, [run, stepIndex, sidebarOpen, setSidebar]);

    const handleJoyrideCallback = (data) => {
        const { index, status, type } = data;

        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            setRun(false);
            setHasCompletedTour(true);
        } else if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type)) {
            setStepIndex(index + 1);
        } else if (type === EVENTS.STEP_BEFORE) {
            setStepIndex(index);
        }
    };

    if (!user) return null;

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous={true}
            hideBackButton={false}
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={steps}
            tooltipComponent={TourTooltip}
            disableOverlayClose={true}
            spotlightPadding={6}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: '#6366f1',
                    overlayColor: 'rgba(0, 0, 0, 0.4)',
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(1px)',
                },
                spotlight: {
                    borderRadius: '16px',
                },
            }}
            floaterProps={{
                disableAnimation: false,
                styles: {
                    arrow: {
                        length: 8,
                        spread: 16
                    },
                },
            }}
        />
    );
}
