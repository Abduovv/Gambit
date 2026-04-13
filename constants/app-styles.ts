import { StyleSheet } from 'react-native'

export const appStyles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderColor: '#d1d1d1',
        borderRadius: 2,
        borderWidth: 1,
        elevation: 1,
        padding: 4,
    },
    screen: {
        flex: 1,
        gap: 16,
        paddingHorizontal: 8,
    },
    stack: {
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
})

// ── Gambit-specific color palette ─────────────────────────────────────
export const gambitColors = {
    primary: '#7c3aed',
    primaryLight: '#f5f3ff',
    primaryBorder: '#ddd6fe',
    success: '#10b981',
    successLight: '#f0fdf4',
    successBorder: '#bbf7d0',
    warning: '#f59e0b',
    warningLight: '#fffbeb',
    warningBorder: '#fde68a',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
    dangerBorder: '#fecaca',
    info: '#3b82f6',
    infoLight: '#eff6ff',
    infoBorder: '#bfdbfe',
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
    },
}

// ── Common component styles ───────────────────────────────────────────
export const gambitStyles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        gap: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    screen: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    button: {
        backgroundColor: '#7c3aed',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
})
