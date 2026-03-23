import api from './api'

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data),
}

export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  getMe: () => api.get('/users/me'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, password) => api.post(`/users/${id}/reset-password`, { password }),
  deactivate: (id) => api.patch(`/users/${id}/deactivate`),
  activate: (id) => api.patch(`/users/${id}/activate`),
  changeRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  getDepartments: () => api.get('/users/departments'),
  delete: (id) => api.delete(`/users/${id}`),
}

export const timesheetAPI = {
  getAll: (params) => api.get('/timesheets', { params }),
  getById: (id) => api.get(`/timesheets/${id}`),
  getSummary: (params) => api.get('/timesheets/summary', { params }),
  getDashboardSummary: (params) => api.get('/timesheets/summary', { params }),
  getHistory: (params) => api.get('/timesheets/history', { params }),
  create: (data) => api.post('/timesheets', data),
  bulkUpsert: (data) => api.post('/timesheets/bulk', data),
  bulkSubmit: (data) => api.post('/timesheets/bulk-submit', data),
  update: (id, data) => api.put(`/timesheets/${id}`, data),
  submit: (id) => api.patch(`/timesheets/${id}/submit`),
  approve: (id) => api.patch(`/timesheets/${id}/approve`),
  reject: (id, reason) => api.patch(`/timesheets/${id}/reject`, { reason }),
  getAdminSummary: () => api.get('/timesheets/admin-summary'),
  getAdminList: (params) => api.get('/timesheets/admin-list', { params }),
  getAdminFilters: () => api.get('/timesheets/admin-filters'),
  getAdminKpi: (kpi) => api.get('/timesheets/admin-kpi', { params: { kpi } }),
  getCompliance: (params) => api.get('/timesheets/compliance', { params }),
  adminFill: (data) => api.post('/timesheets/admin-fill', data),
  delete: (id) => api.delete(`/timesheets/${id}`),
}

export const projectAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  allocate: (id, allocations) => api.patch(`/projects/${id}/allocate`, { allocations }),
  deallocate: (projectId, userId) => api.delete(`/projects/${projectId}/allocate/${userId}`),
}

export const leaveAPI = {
  getAll: (params) => api.get('/leaves', { params }),
  getById: (id) => api.get(`/leaves/${id}`),
  apply: (data) => api.post('/leaves', data),
  approve: (id) => api.patch(`/leaves/${id}/approve`),
  reject: (id, reason) => api.patch(`/leaves/${id}/reject`, { reason }),
  cancel: (id, reason) => api.patch(`/leaves/${id}/cancel`, { reason }),
  getBalance: (userId) => api.get(`/leaves/balance/${userId}`),
  syncTimesheet: (id) => api.patch(`/leaves/${id}/sync-timesheet`),
  backfillTimesheets: () => api.post('/leaves/backfill-timesheets'),
  getCalendar: (params) => api.get('/leaves/calendar', { params }),
  getFilterOptions: () => api.get('/leaves/filter-options'),
}

export const announcementAPI = {
  getAll: (params) => api.get('/announcements', { params }),
  getAllAdmin: (params) => api.get('/announcements/admin', { params }),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  delete: (id) => api.delete(`/announcements/${id}`),
}

export const calendarAPI = {
  getAll: (params) => api.get('/calendar', { params }),
  create: (data) => api.post('/calendar', data),
  update: (id, data) => api.put(`/calendar/${id}`, data),
  delete: (id) => api.delete(`/calendar/${id}`),
}

export const reportAPI = {
  getTimesheetSummary: (params) => api.get('/reports/timesheet-summary', { params }),
  getProjectUtilization: (params) => api.get('/reports/project-utilization', { params }),
  getLeaveSummary: (params) => api.get('/reports/leave-summary', { params }),
  getLeaveDetails: (params) => api.get('/reports/leave-details', { params }),
  getTimesheetDetails: (params) => api.get('/reports/timesheet-details', { params }),
  getEmployeeAttendance: (params) => api.get('/reports/employee-attendance', { params }),
  getWeeklyTrend: (params) => api.get('/reports/weekly-trend', { params }),
  getDepartmentSummary: (params) => api.get('/reports/department-summary', { params }),
  getComplianceSummary: (params) => api.get('/reports/compliance-summary', { params }),
  getSmartInsights: (params) => api.get('/reports/smart-insights', { params }),
  exportPDF: (params) => api.get('/reports/pdf-export', { params, responseType: 'blob' }),
  exportCSV: (params) => api.get('/reports/csv-export', { params, responseType: 'blob' }),
}

export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
  clearAll: () => api.delete('/notifications/clear-all'),
}

export const settingsAPI = {
  // Report settings
  getReportSettings: () => api.get('/settings/report'),
  saveReportSettings: (data) => api.post('/settings/report', data),
  sendReportNow: (data) => api.post('/settings/report/send-now', data),
  previewReport: (data) => api.post('/settings/report/preview', data),
  // Timesheet customization
  getTimesheetSettings: () => api.get('/settings/timesheet'),
  saveTimesheetSettings: (data) => api.post('/settings/timesheet', data),
  // General settings
  getGeneralSettings: () => api.get('/settings/general'),
  saveGeneralSettings: (data) => api.post('/settings/general', data),
  // Full Enterprise Settings
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
  uploadBranding: (formData) => api.post('/settings/upload-branding', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Employee list for recipient picker
  getPickerEmployees: (q) => api.get('/settings/employees', { params: { q } }),
  testHikvision: (data) => api.post('/settings/test-hikvision', data),
}

export const auditAPI = {
  getAll: (params) => api.get('/audit', { params }),
}

export const reportSchedulesAPI = {
  getAll: () => api.get('/report-schedules'),
  create: (data) => api.post('/report-schedules', data),
  update: (id, data) => api.put(`/report-schedules/${id}`, data),
  remove: (id) => api.delete(`/report-schedules/${id}`),
  sendNow: (id) => api.post(`/report-schedules/${id}/send-now`),
  getHistory: (id) => api.get(`/report-schedules/${id}/history`),
  preview: (data) => api.post('/report-schedules/preview', data),
  previewPdf: (data) => api.post('/report-schedules/preview/pdf', data, { responseType: 'blob' }),
  sendPdf: (data) => api.post('/report-schedules/preview/send-pdf', data),
}

export const taskAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  bulkCreate: (data) => api.post('/tasks/bulk-create', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
}

export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
}

export const adminAPI = {
  getDashboardMetrics: () => api.get('/admin/dashboard-metrics'),
  getOrganizations: () => api.get('/admin/organizations'),
}

export default api
