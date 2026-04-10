const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { enforceOrg } = require('../../shared/utils/prismaHelper');

const attendanceService = {
  /**
   * Synchronize logs from a daemon or direct push.
   * We map raw logs (Check-In/Out) to the daily Attendance record.
   */
  async syncLogs(logs, globalOrganizationId = null) {
    const results = { received: logs.length, created: 0, updated: 0, errors: 0 };

    for (const log of logs) {
      try {
        const orgId = log.organizationId || globalOrganizationId;
        if (!orgId) { results.errors++; continue; }

        const success = await this.syncLogEntry(log, orgId);
        if (success) {
          results.created++; // Incremented even if it was an update for simplicity
        } else {
          results.errors++;
        }
      } catch (err) {
        results.errors++;
      }
    }
    return results;
  },

  /**
   * Refined sync logic using findFirst to avoid duplicates on the same workDate
   */
  async syncLogEntry(log, orgId) {
     // Find employee by code (hard-scoped)
     const employee = await prisma.employee.findUnique({ 
        where: { 
          organizationId_employeeCode: { 
            employeeCode: log.employeeId.toString(), 
            organizationId: orgId 
          } 
        } 
     });
     if (!employee) return false;

     const ts = new Date(log.timestamp);
     const workDate = new Date(ts);
     workDate.setHours(0,0,0,0);

     // Find existing record for this employee and date
     const existing = await prisma.attendance.findFirst({
        where: { 
          employeeId: employee.id, 
          workDate,
          organizationId: orgId,
          isDeleted: false
        }
     });

     const type = (log.type || 'IN').toUpperCase();
     const data = {};
     if (type === 'IN' || type === 'CHKIN') data.checkIn = ts;
     else if (type === 'OUT' || type === 'CHKOUT') data.checkOut = ts;

     if (existing) {
        // Hard isolation in update
        await prisma.attendance.update({ 
           where: { id_organizationId: { id: existing.id, organizationId: orgId } }, 
           data 
        });
     } else {
        await prisma.attendance.create({ 
           data: { ...data, employeeId: employee.id, organizationId: orgId, workDate } 
        });
     }
     return true;
  },

  /**
   * Fetch attendance for a date range
   */
  async getAttendance(userIdOrEmployeeId, from, to, organizationId) {
    const employee = await prisma.employee.findFirst({
       where: { 
         OR: [
           { id: userIdOrEmployeeId }, 
           { userId: userIdOrEmployeeId }
         ],
         organizationId,
         isDeleted: false
       }
    });
    
    if (!employee) return [];

    const scopedQuery = enforceOrg({
      where: {
        employeeId: employee.id,
        workDate: { gte: new Date(from), lte: new Date(to) }
      },
      include: { employee: { include: { user: { select: { name: true } } } } },
      orderBy: { workDate: 'asc' }
    }, organizationId);

    return await prisma.attendance.findMany(scopedQuery);
  }
};

module.exports = attendanceService;
