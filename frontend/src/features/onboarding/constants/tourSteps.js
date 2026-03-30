export const getTourSteps = (user, isPro) => {
    const steps = [
        {
            target: '#tour-hero',
            title: 'Welcome to CalTIMS',
            content: 'Lets get you started! This dashboard gives you a quick overview of your work activity and insights.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '#tour-productivity-chart',
            title: 'Your Productivity',
            content: 'Stay on top of your work! This chart tracks your weekly logged hours against your target.',
            placement: 'top',
        },
        {
            target: '#tour-timesheets',
            title: 'Log Your Time',
            content: 'This is where the magic happens. Quickly log your daily hours and keep your projects updated.',
            placement: 'right',
        },
        {
            target: '#tour-history',
            title: 'Entry History',
            content: 'Need to check a past entry? You can find all your previous submissions and their status right here.',
            placement: 'right',
        },
    ];

    // Admin/Manager specific steps
    if (['admin', 'manager'].includes(user?.role)) {
        steps.push({
            target: '#tour-manage-timesheets',
            title: 'Manage Team',
            content: 'Review and approve timesheets from your team. A clean way to stay in sync with everyone.',
            placement: 'right',
        });
    }

    steps.push({
        target: '#tour-leaves',
        title: 'Leave Tracker',
        content: 'Planning a vacation? Check your balance and submit leave requests in just a second.',
        placement: 'right',
    });

    // Pro features
    if (isPro) {
        steps.push({
            target: '#tour-payroll',
            title: 'Payroll Hub',
            content: 'Salary processing made simple. Manage structures, taxes, and generate payslips effortlessly.',
            placement: 'right',
        });
        steps.push({
            target: '#tour-reports',
            title: 'Analytics & Reports',
            content: 'Dive deep into data. Generate beautiful reports to understand workforce trends and project costs.',
            placement: 'right',
        });
    }

    steps.push({
        target: '#tour-settings',
        title: 'Preferences',
        content: 'Make it yours. Adjust your profile, system preferences, and security settings here.',
        placement: 'right',
    });

    return steps;
};
