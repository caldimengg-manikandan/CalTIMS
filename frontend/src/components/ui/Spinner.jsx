import React from 'react'
import { clsx } from 'clsx'

const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' }

export default function Spinner({ size = 'md', className }) {
    return (
        <div
            className={clsx(
                'rounded-full border-transparent border-t-primary-600 animate-spin',
                sizes[size],
                className
            )}
            style={{ borderWidth: size === 'lg' ? 3 : 2, borderStyle: 'solid', borderTopColor: 'currentColor' }}
        />
    )
}
