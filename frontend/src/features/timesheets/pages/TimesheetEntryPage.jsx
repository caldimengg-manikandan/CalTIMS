import React, { useState, useEffect, useMemo } from 'react'
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
    AlertTriangle
} from 'lucide-react'
import { timesheetAPI, projectAPI, settingsAPI, taskAPI } from '@/services/endpoints'
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
    'Testing',
    'Leave',
    'Holiday'
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
        queryKey: ['projects', 'active'],
        queryFn: () => projectAPI.getAll({ status: 'active' }).then(r => r.data.data),
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
    const TASK_TYPES = tsSettings?.taskCategories
        ? ['Select Task', ...tsSettings.taskCategories, 'Leave', 'Holiday']
        : DEFAULT_TASK_TYPES

    const LEAVE_TASK_TYPES = useMemo(() => {
        const standard = tsSettings?.leaveTypes || DEFAULT_LEAVE_TYPES
        const eligible = (tsSettings?.eligibleLeaveTypes || []).map(t => t.charAt(0).toUpperCase() + t.slice(1))
        return [...new Set([...standard, ...eligible])]
    }, [tsSettings])

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

            // Otherwise fetch by date range
            const getMonday = (d) => {
                const dt = new Date(d)
                const day = dt.getDay()
                const diff = day === 0 ? -6 : 1 - day
                dt.setDate(dt.getDate() + diff)
                dt.setHours(0, 0, 0, 0)
                return dt
            }
            const mondays = new Set()
            weekDays.forEach(day => mondays.add(format(getMonday(day), 'yyyy-MM-dd')))
            const mondayList = [...mondays].sort()
            const from = mondayList[0]
            const to = format(addDays(weekStart, 13), 'yyyy-MM-dd')

            const r = await timesheetAPI.getAll({ from, to })
            return r.data?.data || r.data?.timesheets || (Array.isArray(r.data) ? r.data : [])
        },
        staleTime: 0,
    })

    // Sync existing timesheets to rows if available
    useEffect(() => {
        // Don't reset rows while still loading – avoids flash of zeros
        if (existingTimesheets === undefined) return

        if (existingTimesheets && existingTimesheets.length > 0) {
            // Map rows and merge data across all relevant week documents (e.g. Mon-start and Sun-start overlaps)
            const rowMap = new Map() // Key: projectId + category

            existingTimesheets.forEach(ts => {
                if (!ts.rows) return

                ts.rows.forEach(r => {
                    const pid = r.projectId?._id || r.projectId
                    const projectIdStr = pid ? pid.toString() : 'unknown'
                    const category = (r.category || 'Select Task').trim()
                    const key = `${projectIdStr}-${category.toLowerCase()}`

                    if (!rowMap.has(key)) {
                        rowMap.set(key, {
                            id: r._id || `temp-${Math.random()}`,
                            _id: r._id,
                            projectId: pid,
                            taskType: category,
                            dayHours: Array(7).fill('00:00'),
                            status: ts.status
                        })
                    }

                    const targetRow = rowMap.get(key)

                    // Map each entry to the displayed weekday column
                    weekDays.forEach((day, i) => {
                        const dayStr = format(day, 'yyyy-MM-dd')
                        const entry = r.entries?.find(e => {
                            if (!e.date) return false
                            // Standardize both dates to YYYY-MM-DD for comparison
                            try {
                                const eDateStr = format(new Date(e.date), 'yyyy-MM-dd')
                                return eDateStr === dayStr
                            } catch (err) { return false }
                        })

                        if (entry) {
                            const hours = entry.hoursWorked || 0
                            const h = Math.floor(hours)
                            const m = Math.round((hours - h) * 60)
                            targetRow.dayHours[i] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                        }
                    })
                })
            })

            const finalRows = Array.from(rowMap.values())
            setRows(finalRows.length > 0 ? finalRows : [{ id: Date.now(), projectId: '', taskType: 'Select Task', dayHours: Array(7).fill('00:00') }])
        } else {
            // Data loaded but no records found for this week
            setRows([{ id: Date.now(), projectId: '', taskType: 'Select Task', dayHours: Array(7).fill('00:00') }])
        }
    }, [existingTimesheets, weekStart, weekDays])

    // Mutation for bulk saving
    const bulkSaveMutation = useMutation({
        mutationFn: async (rowsToSave) => {
            const payloads = rowsToSave.filter(r => r.projectId).map(row => ({
                projectId: row.projectId,
                category: row.taskType,
                weekStartDate: format(weekStart, 'yyyy-MM-dd'),
                entries: weekDays.map((day, i) => {
                    const [h, m] = row.dayHours[i].split(':').map(Number)
                    const hoursWorked = h + (m / 60)
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
            // Basic validation: must have some hours somewhere
            const hasAnyHours = rows.some(r => r.dayHours.some(h => h !== '00:00'))
            if (!hasAnyHours) {
                throw new Error('Please enter some hours before submitting.')
            }

            const payloads = rows.filter(r => r.projectId).map(row => ({
                projectId: row.projectId,
                category: row.taskType,
                weekStartDate: format(weekStart, 'yyyy-MM-dd'),
                entries: weekDays.map((day, i) => {
                    const [h, m] = row.dayHours[i].split(':').map(Number)
                    const hoursWorked = h + (m / 60)
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
                const isGlobalType = ['Select Task', 'Leave', 'Holiday', ...(LEAVE_TASK_TYPES || [])].includes(r.taskType)

                if (!isGlobalType && !taskExistsInNewProject) {
                    updated.taskType = 'Select Task'
                }
            }

            // When task type changes to a leave type, auto-set hours to 09:00
            if (field === 'taskType' && isLeaveTaskType(value, LEAVE_TASK_TYPES)) {
                updated.dayHours = updated.dayHours.map(() => '09:00')
            }
            return updated
        }))
    }

    const handleUpdateHour = (rowId, dayIndex, value) => {
        setRows(rows.map(r => {
            if (r.id === rowId) {
                // Prevent manual editing of leave rows
                if (isLeaveTaskType(r.taskType, LEAVE_TASK_TYPES)) return r

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
                    const [oh, om] = otherRow.dayHours[dayIndex].split(':').map(Number)
                    return acc + oh + (om / 60)
                }, 0)

                if (otherRowsDayTotal + newValueTotalHours > 24) {
                    toast.error('Total hours for a day cannot exceed 24 hours.')
                    return r
                }

                // 3. Permission row limit (max 4 hours)
                if (isPermissionRow(r.taskType)) {
                    if (newValueTotalHours > 4) {
                        toast.error('Permission hours cannot exceed 4 hours per day.')
                        return r
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
            const [h, m] = time.split(':').map(Number)
            return acc + h + (m / 60)
        }, 0)
    }

    const formatHours = (total) => {
        const h = Math.floor(total)
        const m = Math.round((total - h) * 60)
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    const calculateDayTotal = (dayIndex) => {
        return rows.reduce((acc, row) => {
            const [h, m] = row.dayHours[dayIndex].split(':').map(Number)
            return acc + h + (m / 60)
        }, 0)
    }

    const totalWeekHours = useMemo(() => {
        return rows.reduce((acc, row) => acc + calculateRowTotal(row), 0)
    }, [rows])

    const isAllSubmitted = useMemo(() => {
        if (rows.length === 0) return false
        // Only check non-leave rows
        const workRows = rows.filter(r => r.projectId && !isLeaveTaskType(r.taskType, LEAVE_TASK_TYPES))
        if (workRows.length === 0) return false
        return workRows.every(row => {
            const ts = existingTimesheets?.find(t => (t.projectId?._id || t.projectId) === row.projectId)
            return ts && ['submitted', 'approved'].includes(ts.status)
        })
    }, [rows, existingTimesheets])

    const getRowStatus = (row) => {
        const ts = existingTimesheets?.find(t => (t.projectId?._id || t.projectId) === row.projectId)
        return ts?.status || 'draft'
    }

    // Derived: is the week already submitted/approved?
    const isWeekSubmitted = useMemo(() => {
        const weekTs = existingTimesheets?.[0]
        return weekTs ? ['submitted', 'approved'].includes(weekTs.status) : false
    }, [existingTimesheets])

    const isRowLocked = (row) => {
        if (isLeaveTaskType(row.taskType, LEAVE_TASK_TYPES)) return true;
        // Permission rows are NOT locked — hours are editable (capped at 4hrs/day in handleUpdateHour)
        const weekTs = existingTimesheets?.[0];
        if (!weekTs) return false;
        return ['submitted', 'approved'].includes(weekTs.status);
    }

    if (isLoading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-10">
            <PageHeader title="Timesheet Entry" />

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

                <button
                    onClick={() => setCurrentDate(new Date())}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-95"
                >
                    <Calendar size={16} />
                    CURRENT WEEK
                </button>
            </div>

            <div className="bg-white dark:bg-black rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-white">
                <div className="p-6 border-b border-slate-100 dark:border-white flex items-center justify-between bg-slate-50/50 dark:bg-black/50">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Week Entry</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleAddRow}
                            disabled={isWeekSubmitted}
                            title={isWeekSubmitted ? 'Timesheet already submitted' : 'Add a new project row'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                        >
                            <Plus size={16} /> ADD PROJECT
                        </button>
                        <button
                            onClick={handleAddPermission}
                            disabled={isWeekSubmitted || rows.some(r => isPermissionRow(r.taskType))}
                            title={isWeekSubmitted ? 'Timesheet already submitted' : rows.some(r => isPermissionRow(r.taskType)) ? 'Only one permission row allowed' : 'Add a permission row'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                        >
                            <Plus size={16} /> ADD PERMISSION
                        </button>
                        <button
                            onClick={() => bulkSaveMutation.mutate(rows.filter(r => r.projectId && !isRowLocked(r)))}
                            disabled={bulkSaveMutation.isPending || isWeekSubmitted}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {bulkSaveMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />}
                            SAVE DRAFT
                        </button>
                    </div>
                </div>

                <div className={`overflow-x-auto${rows.length > 5 ? ' overflow-y-auto max-h-[360px]' : ''}`}>
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-50 dark:bg-black border-b border-slate-200 dark:border-white text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                                <th className="px-4 py-4 text-left font-bold border-r border-slate-200 dark:border-white w-16">S.no</th>
                                <th className="px-4 py-4 text-left font-bold border-r border-slate-200 dark:border-white min-w-[200px]">Project Name</th>
                                <th className="px-4 py-4 text-left font-bold border-r border-slate-200 dark:border-white min-w-[240px]">Task / Leave Type</th>

                                {weekDays.map((day, i) => (
                                    <th key={i} className="px-2 py-3 border-r border-slate-200 dark:border-white text-center min-w-[110px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex flex-col">
                                                <span>{format(day, 'EEE')}</span>
                                                <span className="text-slate-400 capitalize font-normal">{format(day, 'MMM d')}</span>
                                            </div>
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
                                ))}

                                <th className="px-4 py-4 text-center font-bold border-r border-slate-200 dark:border-white w-24">Total</th>
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
                                                    <span className="text-sm font-semibold text-slate-600 dark:text-white">Leave</span>
                                                </div>
                                            ) : isLeave ? (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white rounded-lg opacity-75 cursor-not-allowed">
                                                    <span className="text-sm font-semibold text-slate-600 dark:text-white capitalize">{row.taskType} Leave</span>
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
                                            ) : isLeave ? (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white rounded-lg opacity-75 cursor-not-allowed">
                                                    <span className="text-sm text-slate-500 dark:text-white capitalize">{row.taskType} Leave</span>
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

                                                    <option value="Leave">Leave</option>
                                                    <option value="Holiday">Holiday</option>
                                                </select>
                                            )}
                                        </td>

                                        {row.dayHours.map((time, i) => {
                                            const [h, m] = time.split(':')
                                            return (
                                                <td key={i} className="px-2 py-3 border-r border-slate-100 dark:border-white">
                                                    <div className="flex items-center justify-center bg-slate-50 dark:bg-black border border-slate-200 dark:border-white rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                                                        <input
                                                            type="text"
                                                            maxLength={2}
                                                            placeholder="00"
                                                            className="w-6 bg-transparent text-center text-sm font-semibold outline-none disabled:opacity-60"
                                                            value={h}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                                                handleUpdateHour(row.id, i, `${val}:${m}`)
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = e.target.value.padStart(2, '0')
                                                                handleUpdateHour(row.id, i, `${val}:${m}`)
                                                            }}
                                                            disabled={isRowLocked(row)}
                                                        />
                                                        <span className="text-slate-400 font-bold select-none mx-0.5">:</span>
                                                        <input
                                                            type="text"
                                                            maxLength={2}
                                                            placeholder="00"
                                                            className="w-6 bg-transparent text-center text-sm font-semibold outline-none disabled:opacity-60"
                                                            value={m}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                                                handleUpdateHour(row.id, i, `${h}:${val}`)
                                                            }}
                                                            onBlur={(e) => {
                                                                let val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                                                const numVal = parseInt(val, 10) || 0
                                                                if (numVal > 59) val = '59'
                                                                else val = val.padStart(2, '0')
                                                                handleUpdateHour(row.id, i, `${h}:${val}`)
                                                            }}
                                                            disabled={isRowLocked(row)}
                                                        />
                                                    </div>
                                                </td>
                                            )
                                        })}

                                        <td className="px-4 py-4 border-r border-slate-100 dark:border-white text-center font-bold text-emerald-600 dark:text-white">
                                            {formatHours(calculateRowTotal(row))}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => handleRemoveRow(row.id)}
                                                disabled={isWeekSubmitted}
                                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-10 border-t-2 border-slate-100 dark:border-white">
                            <tr className="bg-blue-50 dark:bg-black font-bold">
                                <td colSpan={3} className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-white">
                                    Total Hours
                                </td>
                                {weekDays.map((_, i) => {
                                    const dayTotal = calculateDayTotal(i)
                                    const isLow = dayTotal > 0 && dayTotal < workingHoursPerDay
                                    return (
                                        <td key={i} className={clsx(
                                            "px-2 py-4 text-center text-sm font-bold transition-colors",
                                            isLow ? "text-rose-500 bg-rose-50/50 dark:bg-rose-950/20" : "text-indigo-700 dark:text-white"
                                        )}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span>{formatHours(dayTotal)}</span>
                                                {isLow && (
                                                    <span className="text-[9px] flex items-center gap-0.5 animate-pulse">
                                                        <AlertTriangle size={8} /> Low
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    )
                                })}
                                <td className="px-4 py-4 text-center text-sm text-indigo-700 dark:text-white">
                                    {formatHours(totalWeekHours)}
                                </td>
                                <td className="px-4 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span>Daily Limit: <strong>{workingHoursPerDay} hrs</strong></span>
                    </div>
                </div>

                <button
                    onClick={() => submitWeekMutation.mutate()}
                    disabled={submitWeekMutation.isPending || totalWeekHours === 0 || isWeekSubmitted}
                    title={isWeekSubmitted ? 'This week has already been submitted' : ''}
                    className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none"
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

