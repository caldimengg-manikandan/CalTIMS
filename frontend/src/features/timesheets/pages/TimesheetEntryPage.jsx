import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Trash2,
    Save,
    Send,
    ChevronLeft,
    ChevronRight,
    Calendar,
    PlusSquare,
    ClipboardCheck,
    Info,
    AlertTriangle,
    Clock
} from 'lucide-react'
import { timesheetAPI, projectAPI, settingsAPI, taskAPI, leaveAPI, calendarAPI, attendanceAPI } from '@/services/endpoints'
import { useSettingsStore } from '@/store/settingsStore'
import Spinner from '@/components/ui/Spinner'
import {
    format,
    startOfWeek,
    addDays,
    subDays,
    isSameDay,
    getWeek
} from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'

const DEFAULT_TASK_TYPES = [
    'Select Task',
    'Development',
    'Bug Fixing',
    'Design',
    'Meeting',
    'Documentation',
    'Testing'
]

const DEFAULT_LEAVE_TYPES = ['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Paternity']
const PERMISSION_ROW_MARKER = '__PERMISSION__'

// Detect if a row is a leave row (task is a leave type) — checked dynamically
const isLeaveTaskType = (taskType, leaveTypes = DEFAULT_LEAVE_TYPES) =>
    leaveTypes.some(lt => lt.toLowerCase() === taskType?.toLowerCase())

// Detect if a row is a permission row
const isPermissionRow = (taskType) => taskType === PERMISSION_ROW_MARKER


import PageHeader from '@/components/ui/PageHeader'

export default function TimesheetEntryPage() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const editId = searchParams.get('id')           // direct timesheet _id for edit
    const initialDateStr = searchParams.get('date') || searchParams.get('weekStart')

    const { general } = useSettingsStore()
    const workingHoursPerDay = general?.workingHoursPerDay || 8
    const weekStartDay = general?.weekStartDay || 'monday' // 'monday' or 'sunday'
    const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1

    const [currentDate, setCurrentDate] = useState(() => {
        if (!initialDateStr) return new Date()
        try {
            // Handle ISO strings (like 2026-03-02T00:00:00.000Z) or YYYY-MM-DD
            if (initialDateStr.includes('T')) {
                return new Date(initialDateStr)
            }
            const parts = initialDateStr.trim().split(/[- /]/).map(Number)
            if (parts.length >= 3) {
                return new Date(parts[0], parts[1] - 1, parts[2])
            }
            return new Date(initialDateStr)
        } catch (e) {
            console.error('Failed to parse date:', initialDateStr)
            return new Date()
        }
    })

    // Calculate week range
    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn }), [currentDate, weekStartsOn])
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

    // Local state for rows to allow inline editing
    const [rows, setRows] = useState([
        { id: Date.now(), projectId: '', taskType: 'Select Task', dayHours: Array(7).fill('00:00') }
    ])

    // Shifts state per day

    // Fetch active projects
    const { data: projects } = useQuery({
        queryKey: ['projects', 'active', 'assigned'],
        queryFn: () => projectAPI.getAll({ status: 'active', assignedOnly: true }).then(r => r.data.data),
    })

    // Fetch dynamic task/leave types from settings
    const { data: tsSettings } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
        staleTime: 5 * 60 * 1000,
    })

    // Fetch active tasks
    const { data: allTasks } = useQuery({
        queryKey: ['tasks', 'active-list'],
        queryFn: () => taskAPI.getAll({ isActive: true }).then(r => r.data.data),
    })

    // Fetch full settings for integration status
    const { data: fullSettings } = useQuery({
        queryKey: ['settings', 'full'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
        staleTime: 5 * 60 * 1000,
    })

    // Fetch attendance for the week
    const { data: attendanceLogs } = useQuery({
        queryKey: ['attendance', format(weekStart, 'yyyy-MM-dd')],
        queryFn: () => attendanceAPI.getAll({
            from: format(weekStart, 'yyyy-MM-dd'),
            to: format(addDays(weekStart, 6), 'yyyy-MM-dd')
        }).then(r => r.data.data),
    })

    // Determine if any biometric integration is enabled
    const isAttendanceEnabled = useMemo(() => {
        if (!fullSettings?.hardwareGateways) return false;
        return Object.values(fullSettings.hardwareGateways).some(gw => gw.enabled);
    }, [fullSettings])
    const TASK_TYPES = tsSettings?.taskCategories
        ? ['Select Task', ...tsSettings.taskCategories, 'Leave', 'Holiday']
        : DEFAULT_TASK_TYPES

    const LEAVE_TASK_TYPES = useMemo(() => {
        const standard = tsSettings?.leaveTypes || DEFAULT_LEAVE_TYPES
        const eligible = (tsSettings?.eligibleLeaveTypes || []).map(t => t.charAt(0).toUpperCase() + t.slice(1))
        return [...new Set([...standard, ...eligible])]
    }, [tsSettings])

    // Fetch leaves for the week range to inject pending/approved leaves visually
    const { data: weekLeaves, isLoading: isLoadingLeaves } = useQuery({
        queryKey: ['leaves', 'week', format(weekStart, 'yyyy-MM-dd')],
        queryFn: async () => {
            const from = format(weekStart, 'yyyy-MM-dd')
            const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
            const r = await leaveAPI.getAll({ from, to, limit: 100 })
            return r.data?.data || r.data?.leaves || []
        },
        staleTime: 0,
    })

    // Fetch global holidays for the week
    const { data: globalHolidays } = useQuery({
        queryKey: ['calendar-holidays', format(weekStart, 'yyyy-MM-dd')],
        queryFn: async () => {
            const from = format(weekStart, 'yyyy-MM-dd')
            const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
            const r = await calendarAPI.getAll({ from, to, eventType: 'holiday' })
            return (r.data?.data || []).filter(e => e.isPublic)
        },
        staleTime: 5 * 60 * 1000,
    })

    const holidays = useMemo(() => {
        const holidaySet = new Set()
        globalHolidays?.forEach(event => {
            const start = new Date(event.startDate)
            const end = new Date(event.endDate)
            let curr = new Date(start)
            while (curr <= end) {
                holidaySet.add(format(curr, 'yyyy-MM-dd'))
                curr = addDays(curr, 1)
            }
        })
        return holidaySet
    }, [globalHolidays])

    // Fetch existing timesheet for the week.
    // If editing by ID, fetch directly to avoid date-range mismatch.
    const { data: existingTimesheets, isLoading } = useQuery({
        queryKey: ['timesheets', 'week', format(weekStart, 'yyyy-MM-dd'), editId],
        queryFn: async () => {
            if (editId) {
                // Fetch the specific draft document directly
                const res = await timesheetAPI.getById(editId)
                const doc = res.data?.data
                return doc ? [doc] : []
            }

            // Fetch ONLY this exact week's timesheet using the precise weekStart date
            // Using a 13-day range was causing next-week timesheets (with leave rows)
            // to bleed into previous weeks visually.
            const from = format(weekStart, 'yyyy-MM-dd')
            const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')

            const r = await timesheetAPI.getAll({ from, to })
            return r.data?.data || r.data?.timesheets || (Array.isArray(r.data) ? r.data : [])
        },
        staleTime: 0,
    })

    const lastJumpedId = useRef(null)

    // Sync existing timesheets to rows if available
    useEffect(() => {
        // Only run when all critical data is loaded to avoid partial mapping race conditions
        if (existingTimesheets === undefined || projects === undefined || allTasks === undefined) return

        // If we have data from a specific editId and it's not in our current view, 
        // jump the calendar to where the data is.
        if (editId && existingTimesheets.length > 0 && lastJumpedId.current !== editId) {
            const doc = existingTimesheets[0]
            if (doc) {
                // Find first date with hours, or fallback to doc's weekStartDate
                let targetDate = null
                if (doc.rows) {
                    for (const r of doc.rows) {
                        const entry = r.entries?.find(e => (e.hoursWorked || 0) > 0)
                        if (entry) {
                            targetDate = new Date(entry.date)
                            break
                        }
                    }
                }
                if (!targetDate) targetDate = new Date(doc.weekStartDate)

                // If this target date isn't visible in the current 7-day columns
                const dayStr = format(targetDate, 'yyyy-MM-dd')
                const isVisible = weekDays.some(d => format(d, 'yyyy-MM-dd') === dayStr)

                if (!isVisible) {
                    setCurrentDate(targetDate)
                    lastJumpedId.current = editId
                    return // Effect will re-run with new currentDate/weekDays
                }
            }
            lastJumpedId.current = editId
        }

        // Map rows and merge data across all relevant week documents
        const rowMap = new Map() // Key: projectId + category

        const leaveMetaArray = Array(7).fill(null)
        const leaveHoursArray = Array(7).fill('00:00')

        if (existingTimesheets && existingTimesheets.length > 0) {
            existingTimesheets.forEach(ts => {
                if (!ts.rows) return

                ts.rows.forEach(r => {
                    const pid = r.projectId?._id || r.projectId
                    const projectIdStr = pid ? pid.toString() : 'unknown'
                    const category = (r.category || 'Select Task').trim()

                    const projectCode = r.projectId?.code || projects?.find(p => p._id === projectIdStr)?.code || ''
                    const isSystemLeave = projectCode === 'LEAVE-SYS' || (typeof pid === 'string' && pid === 'LEAVE-SYS') || (pid && projectIdStr.includes('LEAVE-SYS'))

                    if (isSystemLeave) {
                        weekDays.forEach((day, i) => {
                            const dayStr = format(day, 'yyyy-MM-dd')
                            const entry = r.entries?.find(e => {
                                if (!e.date) return false
                                try { return format(new Date(e.date), 'yyyy-MM-dd') === dayStr } catch (err) { return false }
                            })

                            if (entry) {
                                const hours = entry.hoursWorked || 0
                                const h = Math.floor(hours)
                                const m = Math.round((hours - h) * 60)
                                const isFullDay = (hours >= workingHoursPerDay) || category.toLowerCase().includes('lop') || entry.leaveType?.toLowerCase() === 'lop';

                                leaveMetaArray[i] = { type: category, isApproved: true, isFullDay }
                                leaveHoursArray[i] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                            }
                        })
                    } else {
                        let key = `${projectIdStr}-${category.toLowerCase()}`

                        if (!rowMap.has(key)) {
                            rowMap.set(key, {
                                id: (r._id || `temp-${Math.random()}`),
                                _id: r._id,
                                projectId: pid,
                                projectCode: projectCode,
                                taskType: category,
                                dayHours: Array(7).fill('00:00'),
                                dayMeta: Array(7).fill(null),
                                status: ts.status,
                                isLeaveRow: false
                            })
                        }

                        const targetRow = rowMap.get(key)
                        weekDays.forEach((day, i) => {
                            const dayStr = format(day, 'yyyy-MM-dd')
                            const entry = r.entries?.find(e => {
                                if (!e.date) return false
                                try { return format(new Date(e.date), 'yyyy-MM-dd') === dayStr } catch (err) { return false }
                            })

                            if (entry) {
                                const hours = entry.hoursWorked || 0
                                const h = Math.floor(hours)
                                const m = Math.round((hours - h) * 60)
                                targetRow.dayHours[i] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                            }
                        })
                    }
                })
            })
        }

        // Process weekLeaves to inject PENDING leaves
        if (weekLeaves && weekLeaves.length > 0) {
            weekLeaves.forEach(leave => {
                if (leave.status !== 'pending') return

                const getWorkingDaysBetween = (start, end) => {
                    const days = [];
                    const cur = new Date(start);
                    const e = new Date(end);
                    cur.setHours(0, 0, 0, 0);
                    e.setHours(23, 59, 59, 999);
                    while (cur <= e) {
                        const day = cur.getDay();
                        if (day !== 0 && day !== 6) days.push(new Date(cur));
                        cur.setDate(cur.getDate() + 1);
                    }
                    return days;
                }

                const leaveDays = getWorkingDaysBetween(leave.startDate, leave.endDate)
                const leaveHours = leave.leaveType.toLowerCase() === 'lop' ? 0 : (leave.isHalfDay ? workingHoursPerDay / 2 : workingHoursPerDay)
                const category = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)

                weekDays.forEach((day, i) => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    const isLeaveDay = leaveDays.some(ld => format(new Date(ld), 'yyyy-MM-dd') === dayStr)

                    if (isLeaveDay) {
                        const isFullDay = !leave.isHalfDay;
                        const hours = leaveHours
                        const h = Math.floor(hours)
                        const m = Math.round((hours - h) * 60)

                        leaveMetaArray[i] = { type: `${category} (Pending)`, isPending: true, isFullDay }
                        leaveHoursArray[i] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                    }
                })
            })
        }

        let finalRows = Array.from(rowMap.values())
        if (finalRows.length === 0) {
            finalRows = [{ id: Date.now(), projectId: '', taskType: 'Select Task', dayHours: Array(7).fill('00:00'), dayMeta: Array(7).fill(null) }]
        }

        // Apply leave data visually
        finalRows.forEach((row, rowIndex) => {
            row.dayMeta = [...leaveMetaArray];

            if (rowIndex === 0) {
                leaveHoursArray.forEach((h, i) => {
                    if (h !== '00:00') {
                        row.dayHours[i] = h;
                    }
                })
            } else {
                leaveMetaArray.forEach((m, i) => {
                    if (m && m.isFullDay) {
                        row.dayHours[i] = '00:00';
                    }
                })
            }
        });

        setRows(finalRows)
    }, [existingTimesheets, weekLeaves, weekStart, weekDays, editId, projects, allTasks, tsSettings])


    const bulkSaveMutation = useMutation({
        mutationFn: async (rowsToSave) => {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const hasFutureEntry = rowsToSave.some(r => r.dayHours.some((h, idx) => {
                if (h !== '00:00' && h !== '-8') {
                    return weekDays[idx].getTime() > today.getTime();
                }
                return false;
            }));

            if (hasFutureEntry) {
                throw new Error('Cannot save draft with entries for future dates.');
            }

            const payloads = rowsToSave.filter(r => r.projectId && !r.isLeaveRow && r.projectId !== 'LEAVE-SYS').map(row => ({
                projectId: row.projectId,
                category: row.taskType,
                weekStartDate: format(weekStart, 'yyyy-MM-dd'),
                entries: weekDays.map((day, i) => {
                    const isLeaveCell = row.dayMeta && (row.dayMeta[i]?.isPending || row.dayMeta[i]?.isApproved);
                    const isFullDay = isLeaveCell && row.dayMeta[i]?.isFullDay;

                    let hoursWorked = 0;
                    if (!isFullDay) {
                        const [h, m] = row.dayHours[i].split(':').map(Number)
                        hoursWorked = h + (m / 60)
                    }

                    return {
                        date: format(day, 'yyyy-MM-dd'),
                        hoursWorked
                    }
                })
            }))

            if (payloads.length === 0) return null
            return timesheetAPI.bulkUpsert(payloads)
        },
        onSuccess: (res) => {
            if (res) {
                toast.success('Timesheets saved successfully')
                queryClient.invalidateQueries({ queryKey: ['timesheets'] })
            }
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to save timesheets')
        }
    })

    const submitWeekMutation = useMutation({
        mutationFn: async () => {
            // Basic validation: must have some hours somewhere, unless there's a holiday or leave
            const hasAnyHours = rows.some(r => r.dayHours.some(h => h !== '00:00'))
            const hasHolidayOrLeave = holidays.size > 0 || rows.some(r => r.isLeaveRow)
            if (!hasAnyHours && !hasHolidayOrLeave) {
                throw new Error('Please enter some hours before submitting.')
            }

            // Future date validation
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const hasFutureEntry = rows.some(r => r.dayHours.some((h, idx) => {
                if (h !== '00:00' && h !== '-8') {
                    return weekDays[idx].getTime() > today.getTime();
                }
                return false;
            }));

            if (hasFutureEntry) {
                throw new Error('Cannot submit timesheet with entries for future dates.');
            }

            // Policy-Driven Daily Hours Guardrails (min/max from Timesheet Policy settings)
            if (tsSettings?.enforceMinHoursOnSubmit && (tsSettings?.minHoursPerDay > 0 || tsSettings?.maxHoursPerDay > 0)) {
                for (let i = 0; i < 7; i++) {
                    const day = weekDays[i];
                    const isWeekendDay = day.getDay() === 0 || day.getDay() === 6;
                    if (!general?.isWeekendWorkable && isWeekendDay) continue;

                    // Skip fully locked leave days
                    if (lockedDays[i]) continue;

                    // Compute day total excluding permission rows
                    const dayTotal = rows.reduce((acc, row) => {
                        if (isPermissionRow(row.taskType)) return acc; // exclude permission from min check
                        const time = row.dayHours[i];
                        if (!time || time === '-8' || time === '00:00') return acc;
                        const [h, m] = time.split(':').map(Number);
                        return acc + h + (m / 60);
                    }, 0);

                    if (dayTotal === 0) continue; // don't block completely empty days

                    const minHrs = tsSettings?.minHoursPerDay || 0;
                    const maxHrs = tsSettings?.maxHoursPerDay || 24;
                    const dayName = format(day, 'EEEE, MMM d');

                    if (minHrs > 0 && dayTotal < minHrs) {
                        throw new Error(`${dayName}: logged ${formatHours(dayTotal)} but minimum is ${minHrs}h. Please add more hours before submitting.`);
                    }
                    if (maxHrs > 0 && dayTotal > maxHrs) {
                        throw new Error(`${dayName}: logged ${formatHours(dayTotal)} exceeds the maximum of ${maxHrs}h.`);
                    }
                }
            }

            const payloads = rows.filter(r => r.projectId && !r.isLeaveRow && r.projectId !== 'LEAVE-SYS').map(row => ({
                projectId: row.projectId,
                category: row.taskType,
                weekStartDate: format(weekStart, 'yyyy-MM-dd'),
                entries: weekDays.map((day, i) => {
                    const isLeaveCell = row.dayMeta && (row.dayMeta[i]?.isPending || row.dayMeta[i]?.isApproved);
                    const isFullDay = isLeaveCell && row.dayMeta[i]?.isFullDay;

                    let hoursWorked = 0;
                    if (!isFullDay) {
                        const [h, m] = row.dayHours[i].split(':').map(Number)
                        hoursWorked = h + (m / 60)
                    }

                    return {
                        date: format(day, 'yyyy-MM-dd'),
                        hoursWorked
                    }
                })
            }))

            return timesheetAPI.bulkSubmit(payloads)
        },
        onSuccess: () => {
            toast.success('Week submitted for approval')
            queryClient.invalidateQueries({ queryKey: ['timesheets'] })
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to submit week')
        }
    })

    const handleAddRow = () => {
        if (isWeekSubmitted) return
        setRows([...rows, { id: Date.now(), projectId: '', taskType: 'Select Task', dayHours: Array(7).fill('00:00') }])
    }

    const handleAddPermission = () => {
        if (isWeekSubmitted) return
        const alreadyHasPermission = rows.some(r => isPermissionRow(r.taskType))
        if (alreadyHasPermission) {
            toast.error('Only one permission row is allowed per week.')
            return
        }
        setRows([...rows, { id: Date.now(), projectId: PERMISSION_ROW_MARKER, taskType: PERMISSION_ROW_MARKER, dayHours: Array(7).fill('00:00'), permissionNote: '' }])
    }

    const handleRemoveRow = (id) => {
        setRows(rows.filter(r => r.id !== id))
    }

    const handleUpdateRow = (id, field, value) => {
        setRows(rows.map(r => {
            if (r.id !== id) return r
            let updated = { ...r, [field]: value }

            // If project changes, reset task type if it's not a global type or doesn't belong to the new project
            if (field === 'projectId') {
                const projectTasks = allTasks?.filter(t => (t.projectId?._id || t.projectId) === value) || []
                const taskExistsInNewProject = projectTasks.some(t => t.name === r.taskType)
                const isGlobalType = ['Select Task', ...(LEAVE_TASK_TYPES || [])].includes(r.taskType)

                if (!isGlobalType && !taskExistsInNewProject) {
                    updated.taskType = 'Select Task'
                }
            }

            return updated
        }))
    }

    const handleUpdateHour = (rowId, dayIndex, value) => {
        setRows(rows.map(r => {
            if (r.id === rowId) {
                // Prevent manual editing of leave rows
                if (r.isLeaveRow) return r

                const [hStr, mStr] = value.split(':')
                const h = parseInt(hStr, 10) || 0
                const m = parseInt(mStr, 10) || 0
                const newValueTotalHours = h + (m / 60)

                // 1. Individual entry limit
                if (newValueTotalHours > 24) {
                    toast.error('Individual entry cannot exceed 24 hours.')
                    return r
                }

                // 2. Day total across all rows limit
                const otherRowsDayTotal = rows.reduce((acc, otherRow) => {
                    if (otherRow.id === rowId) return acc
                    const time = otherRow.dayHours[dayIndex]
                    if (!time || time === '-8') return acc;
                    const [oh, om] = time.split(':').map(Number)
                    return acc + oh + (om / 60)
                }, 0)

                const maxDayHrs = tsSettings?.maxHoursPerDay || 24;
                if (otherRowsDayTotal + newValueTotalHours > maxDayHrs) {
                    toast.error(`Daily hour limit exceeded. Maximum allowed: ${maxDayHrs} hours.`);
                    return r
                }

                // 3. Permission row limits
                if (isPermissionRow(r.taskType)) {
                    const maxPermHours = tsSettings?.permissionMaxHoursPerDay || 4
                    const maxPermDays = tsSettings?.permissionMaxDaysPerWeek || 0

                    if (newValueTotalHours > maxPermHours) {
                        toast.error(`Daily hour limit exceeded. Maximum allowed: ${maxPermHours} hours.`)
                        return r
                    }

                    // Check if this is a new day for permissions and if it exceeds weekly limit
                    const currentPermissionDays = new Set()
                    rows.forEach(row => {
                        if (isPermissionRow(row.taskType)) {
                            row.dayHours.forEach((h, idx) => {
                                if (h !== '00:00' && h !== '-8' && (row.id !== rowId || idx !== dayIndex)) {
                                    currentPermissionDays.add(idx)
                                }
                            })
                        }
                    })

                    // If we are adding hours to a day that didn't have permission hours before
                    if (newValueTotalHours > 0 && !currentPermissionDays.has(dayIndex)) {
                        if (maxPermDays > 0 && currentPermissionDays.size >= maxPermDays) {
                            toast.error(`Weekly days limit exceeded. Maximum allowed: ${maxPermDays} days.`)
                            return r
                        }
                    }
                }

                const newHours = [...r.dayHours]
                newHours[dayIndex] = value
                return { ...r, dayHours: newHours }
            }
            return r
        }))
    }

    // Calculations
    const calculateRowTotal = (row) => {
        return row.dayHours.reduce((acc, time) => {
            if (!time || time === '-8') return acc;
            if (!time) return acc;
            const [h, m] = time.split(':').map(Number)
            return acc + h + (m / 60)
        }, 0)
    }

    const calculateDayTotal = (dayIndex) => {
        return rows.reduce((acc, row) => {
            const time = row.dayHours[dayIndex]
            if (!time || time === '-8') return acc;
            const [h, m] = time.split(':').map(Number)
            return acc + h + (m / 60)
        }, 0)
    }

    const formatHours = (total) => {
        return (Number(total) || 0).toFixed(2) + 'h'
    }


    const totalWeekHours = useMemo(() => {
        return rows.reduce((acc, row) => acc + calculateRowTotal(row), 0)
    }, [rows])

    const getRowStatus = (row) => {
        const weekStr = format(weekStart, 'yyyy-MM-dd')
        const currentWeekTs = existingTimesheets?.find(t => format(new Date(t.weekStartDate), 'yyyy-MM-dd') === weekStr)
        if (!currentWeekTs) return 'draft'
        const rowData = currentWeekTs.rows?.find(r => (r.projectId?._id || r.projectId) === row.projectId)
        return currentWeekTs.status || 'draft'
    }

    // Derived: is the week already submitted/approved?
    const isWeekSubmitted = useMemo(() => {
        const weekStr = format(weekStart, 'yyyy-MM-dd')
        const currentWeekTs = existingTimesheets?.find(t => format(new Date(t.weekStartDate), 'yyyy-MM-dd') === weekStr)
        return currentWeekTs ? ['submitted', 'approved', 'frozen', 'admin_filled'].includes(currentWeekTs.status) : false
    }, [existingTimesheets, weekStart])

    const isWeekFrozen = useMemo(() => {
        const weekStr = format(weekStart, 'yyyy-MM-dd')
        const currentWeekTs = existingTimesheets?.find(t => format(new Date(t.weekStartDate), 'yyyy-MM-dd') === weekStr)
        return currentWeekTs ? currentWeekTs.status === 'frozen' : false
    }, [existingTimesheets, weekStart])

    // Optional banner for "pending near deadline" can be implemented later. For now focus on Frozen.

    const lockedDays = useMemo(() => {
        const locked = Array(7).fill(false)
        rows.forEach(row => {
            if (row.dayMeta) {
                row.dayMeta.forEach((meta, i) => {
                    if (meta && meta.isFullDay) {
                        locked[i] = true
                    }
                })
            }
        })
        return locked
    }, [rows])

    const isRowLocked = (row) => {
        if (row.isLeaveRow) return true;
        // Permission rows are NOT locked — hours are editable
        const weekStr = format(weekStart, 'yyyy-MM-dd')
        const currentWeekTs = existingTimesheets?.find(t => format(new Date(t.weekStartDate), 'yyyy-MM-dd') === weekStr)
        if (!currentWeekTs) return false;
        return ['submitted', 'approved', 'frozen', 'admin_filled'].includes(currentWeekTs.status);
    }

    if (isLoading || isLoadingLeaves) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6 fluid-container animate-fade-in pb-10">
            <PageHeader title="Timesheet Entry" />

            {isWeekFrozen && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg shadow-sm flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-rose-500 mt-0.5" size={20} />
                        <div>
                            <h3 className="text-rose-800 font-bold text-sm">Timesheet Frozen</h3>
                            <p className="text-rose-700 text-sm mt-1">
                                Your timesheet for the previous week has been frozen because it was not submitted before the deadline. Please raise a Help & Support ticket so the admin can assist you.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/incidents', { state: { autoOpen: true, type: 'frozen' } })}
                        className="whitespace-nowrap bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                        Raise Ticket
                    </button>
                </div>
            )}

            {/* Top Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-4 bg-white dark:bg-black px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-white">
                    <button
                        onClick={() => setCurrentDate(subDays(currentDate, 7))}
                        className="p-1.5 hover:bg-slate-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} className="text-slate-600" />
                    </button>
                    <div className="flex items-center gap-2 px-2">
                        <Calendar size={18} className="text-primary-500" />
                        <span className="font-semibold text-slate-800 dark:text-white capitalize">
                            {format(weekStart, 'MMMM yyyy')}
                        </span>
                        <span className="text-slate-400 mx-1">|</span>
                        <span className="text-sm font-medium text-slate-500 italic">
                            Week: {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')} (Week {getWeek(weekStart)})
                        </span>
                    </div>
                    <button
                        onClick={() => setCurrentDate(addDays(currentDate, 7))}
                        disabled={isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn }))}
                        className="p-1.5 hover:bg-slate-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={20} className="text-slate-600" />
                    </button>
                </div>

                {tsSettings?.submissionDeadline && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                        <Clock size={14} className="text-slate-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deadline:</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-white">{tsSettings.submissionDeadline}</span>
                    </div>
                )}

                <button
                    onClick={() => setCurrentDate(new Date())}
                    className="flex items-center gap-2 px-4 py-2 btn-primary hover:bg-primary-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-95"
                >
                    <Calendar size={16} />
                    CURRENT WEEK
                </button>
            </div>

            <div className="bg-white dark:bg-black rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-white">
                <div className="p-4 md:p-6 border-b border-slate-100 dark:border-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-black/50">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight shrink-0">Week Entry</h2>
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <button
                            onClick={handleAddRow}
                            disabled={isWeekSubmitted}
                            title={isWeekSubmitted ? 'Timesheet already submitted' : 'Add a new project row'}
                            className="flex items-center gap-2 px-3 lg:px-4 py-2 btn-primary hover:bg-primary-700 text-white rounded-lg text-xs lg:text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none flex-1 lg:flex-none justify-center"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">ADD PROJECT</span><span className="sm:hidden">PROJECT</span>
                        </button>
                        <button
                            onClick={handleAddPermission}
                            disabled={isWeekSubmitted || rows.some(r => isPermissionRow(r.taskType))}
                            title={
                                isWeekSubmitted
                                    ? 'Timesheet already submitted'
                                    : rows.some(r => isPermissionRow(r.taskType))
                                        ? 'Only one permission row allowed'
                                        : `Add a permission row (Limit: ${tsSettings?.permissionMaxHoursPerDay || 4}h/day${tsSettings?.permissionMaxDaysPerWeek > 0 ? `, ${tsSettings.permissionMaxDaysPerWeek} days/week` : ''})`
                            }
                            className="flex items-center gap-2 px-3 lg:px-4 py-2 btn-primary hover:bg-primary-700 text-white rounded-lg text-xs lg:text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none flex-1 lg:flex-none justify-center"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">ADD PERMISSION</span><span className="sm:hidden">PERM</span>
                        </button>
                        <button
                            onClick={() => bulkSaveMutation.mutate(rows.filter(r => !r.isLeaveRow))}
                            disabled={bulkSaveMutation.isPending || isWeekSubmitted}
                            className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-xs lg:text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 lg:flex-none justify-center"
                        >
                            {bulkSaveMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />}
                            <span className="hidden sm:inline">SAVE DRAFT</span><span className="sm:hidden">SAVE</span>
                        </button>
                    </div>
                </div>

                <div className={`overflow-x-auto${rows.length > 5 ? ' scroll-v-adaptive' : ''}`}>
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-50 dark:bg-black border-b border-slate-200 dark:border-white text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                                <th className="px-4 py-4 text-left font-bold border-r border-slate-200 dark:border-white w-16">S.no</th>
                                <th className="px-4 py-4 text-left font-bold border-r border-slate-200 dark:border-white min-w-[200px]">Project Name</th>
                                <th className="px-4 py-4 text-left font-bold border-r border-slate-200 dark:border-white min-w-[240px]">Task / Leave Type</th>

                                {weekDays.map((day, i) => {
                                    const isHoliday = holidays.has(format(day, 'yyyy-MM-dd'));
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                    if (!general?.isWeekendWorkable && isWeekend) return null;

                                    const hEvent = isHoliday ? globalHolidays?.find(e => {
                                        const d = format(day, 'yyyy-MM-dd')
                                        return format(new Date(e.startDate), 'yyyy-MM-dd') <= d && format(new Date(e.endDate), 'yyyy-MM-dd') >= d
                                    }) : null
                                    return (
                                        <th key={i} className={clsx(
                                            "px-2 py-3 border-r border-slate-200 dark:border-white text-center min-w-[110px] transition-colors relative",
                                            isHoliday ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 shadow-inner" : ""
                                        )}>
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex flex-col">
                                                    <span>{format(day, 'EEE')}</span>
                                                    <span className={clsx(
                                                        "capitalize font-normal",
                                                        isHoliday ? "text-orange-500/80 dark:text-orange-400" : "text-slate-400"
                                                    )}>{format(day, 'MMM d')}</span>
                                                </div>
                                                {isHoliday && hEvent && (
                                                    <span className="text-[9px] text-orange-500 font-bold uppercase tracking-tighter truncate max-w-[90px]" title={hEvent.title}>
                                                        🎉 {hEvent.title}
                                                    </span>
                                                )}
                                                {calculateDayTotal(i) < workingHoursPerDay && calculateDayTotal(i) > 0 && (
                                                    <div className="absolute -top-1 -right-1 group/warn">
                                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                        <div className="hidden group-hover/warn:block absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap shadow-xl">
                                                            Low hours: {formatHours(calculateDayTotal(i))}
                                                        </div>
                                                    </div>
                                                )}
                                                {calculateDayTotal(i) > 24 && (
                                                    <div className="absolute -top-1 -right-1">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    )
                                })}

                                <th className="px-4 py-4 text-center font-bold border-r border-slate-200 dark:border-white w-24">Work Hours</th>
                                <th className="px-4 py-4 text-center font-bold w-20">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white">
                            {rows.map((row, index) => {
                                const isPermission = isPermissionRow(row.taskType)
                                const isLeave = isLeaveTaskType(row.taskType, LEAVE_TASK_TYPES)
                                return (
                                    <tr key={row.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white dark:hover:text-black">
                                        <td className="px-4 py-4 text-center border-r border-slate-100 dark:border-white text-sm font-medium text-slate-600 dark:text-white">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-white">
                                            {isPermission ? (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white rounded-lg opacity-75 cursor-not-allowed">
                                                    <span className="text-sm font-semibold text-slate-600 dark:text-white">Permission</span>
                                                </div>
                                            ) : row.isLeaveRow ? (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 rounded-lg cursor-not-allowed">
                                                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">System Leave</span>
                                                </div>
                                            ) : (
                                                <select
                                                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
                                                    value={row.projectId}
                                                    onChange={(e) => handleUpdateRow(row.id, 'projectId', e.target.value)}
                                                    disabled={isRowLocked(row)}
                                                >
                                                    <option value="">Select Project</option>
                                                    {projects?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-white">
                                            {isPermission ? (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white rounded-lg opacity-75 cursor-not-allowed">
                                                    <span className="text-sm text-slate-500 dark:text-white">Permission</span>
                                                </div>
                                            ) : row.isLeaveRow ? (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 rounded-lg cursor-not-allowed">
                                                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-200 capitalize">{row.taskType || 'Leave'}</span>
                                                </div>
                                            ) : (
                                                <select
                                                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
                                                    value={row.taskType}
                                                    onChange={(e) => handleUpdateRow(row.id, 'taskType', e.target.value)}
                                                    disabled={isRowLocked(row)}
                                                >
                                                    <option value="Select Task">Select Task</option>
                                                    {/* Project specific tasks */}
                                                    {row.projectId && allTasks?.filter(t => (t.projectId?._id || t.projectId) === row.projectId).map(t => (
                                                        <option key={t._id} value={t.name}>{t.name}</option>
                                                    ))}

                                                    {/* Show global categories ONLY if project doesn't isolate tasks or no project is selected */}
                                                    {(() => {
                                                        const projectObj = projects?.find(p => p._id === row.projectId);
                                                        const showGlobal = !projectObj || !projectObj.onlyProjectTasks;

                                                        if (showGlobal) {
                                                            return (tsSettings?.taskCategories || DEFAULT_TASK_TYPES.filter(t => !['Select Task', 'Leave', 'Holiday'].includes(t)))
                                                                .map(t => (
                                                                    <option key={t} value={t}>{t}</option>
                                                                ));
                                                        }
                                                        return null;
                                                    })()}

                                                </select>
                                            )}
                                        </td>

                                        {row.dayHours.map((time, i) => {
                                            const day = weekDays[i];
                                            const isWeekendDay = day.getDay() === 0 || day.getDay() === 6;
                                            if (!general?.isWeekendWorkable && isWeekendDay) return null;

                                            const isPendingCell = row.dayMeta?.[i]?.isPending;
                                            const isApprovedCell = row.dayMeta?.[i]?.isApproved;
                                            const cellLeaveType = row.dayMeta?.[i]?.type;
                                            const isLeaveCell = isPendingCell || isApprovedCell;
                                            const isLop = cellLeaveType?.toLowerCase().includes('lop');

                                            const isHoliday = holidays.has(format(day, 'yyyy-MM-dd'));
                                            const isFutureDate = day.getTime() > new Date().setHours(23, 59, 59, 999);
                                            const isProjectOrTaskNotSelected = !row.isLeaveRow && !isPermissionRow(row.taskType) && (!row.projectId || row.taskType === 'Select Task');
                                            const isDisabledInput = isRowLocked(row) || isWeekSubmitted || lockedDays[i] || isHoliday || isFutureDate || isProjectOrTaskNotSelected;

                                            return (
                                                <td key={i} className={`px-2 py-3 border-r border-slate-100 dark:border-white transition-colors ${isHoliday ? 'bg-blue-50/80 dark:bg-blue-900/20' : ''}`}>
                                                    <div className={`flex flex-col items-center justify-center p-1.5 transition-all ${!isDisabledInput ? 'focus-within:ring-1 focus-within:ring-indigo-500' : ''} ${isLop && isPendingCell ? 'bg-rose-100/50 border-rose-200 dark:border-rose-900 border rounded-lg' :
                                                        isLop && isApprovedCell ? 'bg-rose-100/30 border-rose-300 dark:border-rose-800 border rounded-lg' :
                                                            isPendingCell ? 'bg-amber-100/30 border-amber-200 dark:border-amber-800 border rounded-lg' :
                                                                isApprovedCell ? 'bg-emerald-100/30 border-emerald-200 dark:border-emerald-800 border rounded-lg' :
                                                                    isHoliday ? 'bg-blue-100/60 dark:bg-blue-800/40 border-blue-300 dark:border-blue-600 border rounded-lg' :
                                                                        'bg-slate-50 dark:bg-black border-slate-200 dark:border-white border rounded-lg'
                                                        } ${isDisabledInput && !row.isLeaveRow ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800' : ''}`}
                                                        title={isProjectOrTaskNotSelected ? "Please select a project and task first" : isFutureDate ? "Cannot enter time for future dates" : ""}
                                                    >
                                                        <div className="flex items-center justify-center w-full">
                                                            {isLop && isLeaveCell ? (
                                                                <div className="flex items-center justify-center w-full relative group/lop">
                                                                    <span className={`text-sm font-bold ${isPendingCell ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                                                        } px-2`}>0</span>
                                                                    <div className="hidden group-hover/lop:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap shadow-xl">
                                                                        LOP Leave
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <input
                                                                        type="text"
                                                                        maxLength={2}
                                                                        placeholder="00"
                                                                        className="w-6 bg-transparent text-center text-sm font-semibold outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                                        value={time.split(':')[0]}
                                                                        onChange={(e) => {
                                                                            const h = e.target.value.replace(/\D/g, '')
                                                                            const m = time.split(':')[1] || '00'
                                                                            handleUpdateHour(row.id, i, `${h}:${m}`)
                                                                        }}
                                                                        disabled={isDisabledInput}
                                                                    />
                                                                    <span className="text-slate-400 font-medium px-0.5">:</span>
                                                                    <input
                                                                        type="text"
                                                                        maxLength={2}
                                                                        placeholder="00"
                                                                        className="w-6 bg-transparent text-center text-sm font-semibold outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                                        value={time.split(':')[1]}
                                                                        onChange={(e) => {
                                                                            const m = e.target.value.replace(/\D/g, '')
                                                                            const h = time.split(':')[0] || '00'
                                                                            handleUpdateHour(row.id, i, `${h}:${m}`)
                                                                        }}
                                                                        disabled={isDisabledInput}
                                                                        onBlur={(e) => {
                                                                            let m = parseInt(e.target.value, 10) || 0
                                                                            if (m > 59) m = 59
                                                                            const h = time.split(':')[0] || '00'
                                                                            handleUpdateHour(row.id, i, `${h}:${String(m).padStart(2, '0')}`)
                                                                        }}
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {isHoliday && !isLeaveCell && (() => {
                                                        const hEvent = globalHolidays?.find(e => {
                                                            const d = format(weekDays[i], 'yyyy-MM-dd')
                                                            return format(new Date(e.startDate), 'yyyy-MM-dd') <= d && format(new Date(e.endDate), 'yyyy-MM-dd') >= d
                                                        })
                                                        return (
                                                            <div className="mt-1 flex items-center justify-center gap-1">
                                                                <span className="text-[9px] text-orange-500 font-bold uppercase tracking-tighter truncate max-w-[90px]" title={hEvent?.title}>
                                                                    🎉 {hEvent?.title || 'Holiday'}
                                                                </span>
                                                            </div>
                                                        )
                                                    })()}
                                                    {isLeaveCell && cellLeaveType && (
                                                        <div className={`text-[10px] text-center mt-1 font-semibold ${isLop && isPendingCell ? 'text-rose-600/80 dark:text-rose-400/80' :
                                                            isLop && isApprovedCell ? 'text-rose-600/80 dark:text-rose-400/80' :
                                                                isPendingCell ? 'text-amber-600/80 dark:text-amber-400/80' :
                                                                    'text-emerald-600/80 dark:text-emerald-400/80'
                                                            }`}>
                                                            {cellLeaveType}
                                                        </div>
                                                    )}
                                                </td>
                                            )
                                        })}

                                        <td className={`px-4 py-4 border-r border-slate-100 dark:border-white text-center font-bold ${row.isLeaveRow ? 'text-emerald-600 dark:text-emerald-400' :
                                            'text-emerald-600 dark:text-white'
                                            }`}>
                                            {formatHours(calculateRowTotal(row))}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {row.isLeaveRow ? (
                                                <div className="p-1.5 text-slate-300 flex justify-center">
                                                    <span className="w-2 h-2 rounded-full opacity-50 bg-slate-300"></span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleRemoveRow(row.id)}
                                                    disabled={isWeekSubmitted}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-10 border-t-2 border-slate-100 dark:border-white">
                            <tr className="bg-slate-50 dark:bg-black font-medium text-slate-700 dark:text-white border-t border-slate-100 dark:border-white">
                                <td colSpan={3} className="px-6 py-4 text-sm font-bold border-r border-slate-100 dark:border-white">
                                    <div className="flex items-center gap-2">
                                        Office Presence (Swipe Hours)
                                        <div className="group relative">
                                            <Info size={14} className="text-slate-400 cursor-help" />
                                            <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-2xl z-50 font-medium leading-relaxed">
                                                Office swipe hours will be automatically captured once attendance integration is enabled by your organization.
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                {weekDays.map((day, i) => {
                                    const isWeekendDay = day.getDay() === 0 || day.getDay() === 6;
                                    if (!general?.isWeekendWorkable && isWeekendDay) return null;
                                    
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const dayLogs = attendanceLogs?.filter(log => format(new Date(log.timestamp), 'yyyy-MM-dd') === dayStr) || [];
                                    let swipeHours = 0;
                                    if (dayLogs.length >= 2) {
                                        // Calculate duration between first and last swipe of the day
                                        const timestamps = dayLogs.map(log => new Date(log.timestamp).getTime());
                                        const startTime = Math.min(...timestamps);
                                        const endTime = Math.max(...timestamps);
                                        
                                        // Duration in decimal hours (e.g., 8.5)
                                        swipeHours = (endTime - startTime) / (1000 * 60 * 60);
                                    }

                                    return (
                                        <td key={i} className="px-2 py-4 text-center text-sm font-bold text-slate-400">
                                            {isAttendanceEnabled ? (swipeHours > 0 ? formatHours(swipeHours) : '0.00h') : '—'}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-4 text-center text-sm text-slate-400">—</td>
                                <td className="px-4 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Attendance Integration Status */}
            <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-primary" />
                        Office Swipe Integration
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {isAttendanceEnabled 
                            ? "Biometric attendance integration is active. Your swipe hours are automatically synced from the office gateway."
                            : "Attendance device integration is not configured for this organization. Contact your administrator to enable real-time swipe tracking."
                        }
                    </p>
                </div>
                <div className={clsx(
                    "px-4 py-2 border text-[10px] font-bold rounded-lg uppercase tracking-widest",
                    isAttendanceEnabled 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                )}>
                    Status: {isAttendanceEnabled ? 'Active' : 'Not Configured'}
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 px-2 mt-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span>Daily Limit: <strong>{workingHoursPerDay} hrs</strong></span>
                    </div>
                    {tsSettings?.permissionMaxHoursPerDay > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>Permission: <strong>{tsSettings.permissionMaxHoursPerDay} hrs/day</strong></span>
                            {tsSettings.permissionMaxDaysPerWeek > 0 && (
                                <span className="opacity-70 whitespace-nowrap">({tsSettings.permissionMaxDaysPerWeek} d/week max)</span>
                            )}
                            {tsSettings.permissionMaxDaysPerMonth > 0 && (
                                <span className="opacity-70 whitespace-nowrap">/ ({tsSettings.permissionMaxDaysPerMonth} d/month max)</span>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => submitWeekMutation.mutate()}
                    disabled={submitWeekMutation.isPending || (totalWeekHours === 0 && holidays.size === 0 && !rows.some(r => r.isLeaveRow)) || isWeekSubmitted}
                    title={isWeekSubmitted ? 'This week has already been submitted' : ''}
                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 btn-primary hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none"
                >
                    {submitWeekMutation.isPending ? (
                        <Spinner size="sm" className="text-white" />
                    ) : (
                        <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    )}
                    {isWeekSubmitted ? '✓ WEEK SUBMITTED' : `SUBMIT WEEK (${formatHours(totalWeekHours)})`}
                </button>
            </div>
        </div>
    )
}

