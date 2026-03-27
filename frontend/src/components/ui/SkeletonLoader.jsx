import React from 'react'

/**
 * SkeletonLoader — reusable shimmer placeholders for loading states.
 *
 * Usage:
 *   <TableSkeleton rows={5} cols={5} />
 *   <CardSkeleton />
 *   <StatCardSkeleton count={4} />
 *   <Skeleton className="h-4 w-32" />
 */

// Base Skeleton primitive
export function Skeleton({ className = '' }) {
    return (
        <div
            className={`skeleton rounded-lg ${className}`}
            aria-hidden="true"
        />
    )
}

// Table body skeleton rows
export function TableSkeleton({ rows = 5, cols = 5 }) {
    return (
        <tbody>
            {Array.from({ length: rows }).map((_, ri) => (
                <tr key={ri} className="border-b border-slate-50 dark:border-slate-800/50">
                    {Array.from({ length: cols }).map((_, ci) => (
                        <td key={ci} className="px-4 py-3.5">
                            <Skeleton
                                className={`h-4 ${ci === 0 ? 'w-32' : ci === cols - 1 ? 'w-20' : 'w-full'}`}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    )
}

// Single card skeleton
export function CardSkeleton({ className = '' }) {
    return (
        <div className={`card animate-pulse ${className}`}>
            <Skeleton className="h-3 w-24 mb-4" />
            <Skeleton className="h-7 w-36 mb-2" />
            <Skeleton className="h-3 w-20" />
        </div>
    )
}

// Row of stat cards for dashboard KPIs
export function StatCardSkeleton({ count = 4 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <Skeleton className="h-3 w-28 mb-3" />
                            <Skeleton className="h-8 w-32" />
                        </div>
                        <Skeleton className="w-10 h-10 rounded-xl skeleton-circle" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                </div>
            ))}
        </>
    )
}

// Full page / section skeleton
export function SectionSkeleton({ rows = 3 }) {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
            ))}
        </div>
    )
}

// List item skeleton
export function ListSkeleton({ rows = 5 }) {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full skeleton-circle flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
            ))}
        </div>
    )
}

export default Skeleton
