const { simulateUserPayroll } = require('../backend/src/modules/payroll/payroll.service');
const { updatePolicy } = require('../backend/src/modules/policyEngine/policy.service');
const { prisma } = require('../backend/src/config/database');

async function testPayroll() {
    console.log("Starting Final Verification (Working Day Mode)...");
    
    const org = await prisma.organization.findFirst();
    const user = await prisma.user.findFirst({
        where: { organizationId: org.id, isActive: true },
        include: { employee: { include: { payrollProfile: true } } }
    });

    const month = 4; // April 2026
    const year = 2026;

    // Set Policy to 22 Working Days
    await updatePolicy({ attendance: { workingDaysPerMonth: 22 } }, org.id);

    // Scenario: Joined April 22nd (Wednesday)
    await prisma.employee.update({
        where: { id: user.employee.id },
        data: { joiningDate: new Date(2026, 3, 22) }
    });

    console.log("\n--- Scenario: Joined April 22nd, 1 Day LOP, Denominator = 22 ---");
    // Create an LOP leave
    const lopLeave = await prisma.leave.create({
        data: {
            employee: { connect: { id: user.employee.id } },
            organization: { connect: { id: org.id } },
            startDate: new Date(2026, 3, 23),
            endDate: new Date(2026, 3, 23),
            totalDays: 1,
            status: 'APPROVED',
            reason: 'LOP TEST',
            type: {
                connectOrCreate: {
                    where: { organizationId_name: { name: 'LOP', organizationId: org.id } },
                    create: { name: 'LOP', organizationId: org.id, yearlyQuota: 0 }
                }
            }
        }
    });

    const result = await simulateUserPayroll(user.id, month, year, org.id);
    logSummary(result);

    // Cleanup
    await prisma.leave.delete({ where: { id: lopLeave.id } });
}

function logSummary(r) {
    console.log(`Denominator: ${r.standardMonthlyDays}`);
    console.log(`Adj. Working (UI): ${r.workingDays}`);
    console.log(`LOP Days: ${r.lopDays}`);
    console.log(`Present Days (UI): ${r.presentDays}`);
    console.log(`Adjusted Gross: ${r.adjustedGross}`);
}

testPayroll().catch(console.error).finally(() => prisma.$disconnect());
