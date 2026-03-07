import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
    currentPage = 1,
    totalPages = 1,
    totalResults = 0,
    limit = 1000,
    onPageChange,
    onLimitChange
}) {
    const startResult = (currentPage - 1) * limit + 1;
    const endResult = Math.min(currentPage * limit, totalResults);

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        // Show first, last, current, and pages around current
        if (
            i === 1 ||
            i === totalPages ||
            (i >= currentPage - 1 && i <= currentPage + 1)
        ) {
            pages.push(i);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            pages.push('...');
        }
    }

    // Remove duplicate ellipses
    const uniquePages = pages.filter((item, index) => pages.indexOf(item) === index);

    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-black sticky bottom-0 z-20 shrink-0">
            <div className="flex items-center gap-3">
                <label className="text-sm text-slate-500 dark:text-slate-400">Items per page:</label>
                <select
                    value={limit}
                    onChange={(e) => onLimitChange(Number(e.target.value))}
                    className="h-9 px-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                    {[5, 10, 20, 50, 100].map((v) => (
                        <option key={v} value={v}>
                            {v}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Showing <span className="font-medium text-slate-700 dark:text-slate-200">{totalResults === 0 ? 0 : startResult}</span> to{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-200">{endResult}</span> of{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-200">{totalResults}</span> results
                </p>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {uniquePages.map((page, idx) => (
                        <React.Fragment key={idx}>
                            {page === '...' ? (
                                <span className="px-3 text-slate-400">...</span>
                            ) : (
                                <button
                                    onClick={() => onPageChange(page)}
                                    className={`w-9 h-9 rounded-lg border text-sm font-medium transition-all ${currentPage === page
                                        ? 'bg-white dark:bg-black border-primary-500 text-primary-600'
                                        : 'bg-white dark:bg-black border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                        }`}
                                >
                                    {page}
                                </button>
                            )}
                        </React.Fragment>
                    ))}

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
