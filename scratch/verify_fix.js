const { simulateUserPayroll } = require('../backend/src/modules/payroll/payroll.service');
const { updatePolicy } = require('../backend/src/modules/policyEngine/policy.service');
const { prisma } = require('../backend/src/config/database');

async function testPayroll() {
    console.log("Starting Payroll Calculation Verification...");
    
    const org = await prisma.organization.findFirst();
    const user = await prisma.user.findFirst({
        where: { organizationId: org.id, isActive: true },
        include: { employee: { include: { payrollProfile: true } } }
    });

    const month = 4; // April (30 days, 22 working days)
    const year = 2026;

    console.log(`\nTesting for ${user.name}`);

    // Scenario: Joint on April 22nd (Wednesday)
    // Working days before: 1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21 (Total 15)
    // Working days after (including 22nd): 22, 23, 24, 27, 28, 29, 30 (Total 7)
    
    console.log("\n--- Scenario: Joined April 22nd, Denominator = Working (22) ---");
    await updatePolicy({ attendance: { workingDaysPerMonth: 0 } }, org.id); // Policy has 22 by default
    await prisma.employee.update({
        where: { id: user.employee.id },
        data: { joiningDate: new Date(2026, 3, 22) }
    });

    let result = await simulateUserPayroll(user.id, month, year, org.id);
    logSummary(result);

    console.log("\n--- Scenario: Joined April 22nd + 1 Day LOP, Denominator = Working (22) ---");
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

    result = await simulateUserPayroll(user.id, month, year, org.id);
    logSummary(result);

    // Cleanup
    await prisma.leave.delete({ where: { id: lopLeave.id } });
    console.log("\nVerification Complete.");
}

function logSummary(r) {
    console.log(`Denominator: ${r.standardMonthlyDays}`);
    console.log(`Adj. Working (UI): ${r.workingDays}`);
    console.log(`LOP Days: ${r.lopDays}`);
    console.log(`Payable Days (Calc): ${r.presentDays}`);
    console.log(`Adjusted Gross: ${r.adjustedGross}`);
}

testPayroll().catch(console.error).finally(() => prisma.$disconnect());
