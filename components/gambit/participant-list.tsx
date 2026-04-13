import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Participant, formatUsd } from '@/types/gambit'

export function ParticipantList({
  participants,
  showAmounts = false,
  showConfirmStatus = false,
}: {
  participants: Participant[]
  showAmounts?: boolean
  showConfirmStatus?: boolean
}) {
  if (participants.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No participants yet</Text>
      </View>
    )
  }

  const sorted = [...participants].sort((a, b) => a.joinIndex - b.joinIndex)

  return (
    <View style={styles.container}>
      {sorted.map((p, i) => (
        <View key={p.wallet + i} style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(p.displayName) }]}>
              <Text style={styles.avatarText}>{p.displayName[0].toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{p.displayName}</Text>
              {showConfirmStatus && (
                <Text style={[styles.status, p.confirmedBill ? styles.confirmed : styles.unconfirmed]}>
                  {p.confirmedBill ? '✓ Confirmed' : '○ Pending'}
                </Text>
              )}
            </View>
          </View>
          {showAmounts && p.amountDue > 0n && (
            <Text style={styles.amount}>{formatUsd(p.amountDue)}</Text>
          )}
          {showAmounts && p.amountPaid > 0n && (
            <Text style={styles.paid}>✓ Paid</Text>
          )}
        </View>
      ))}
    </View>
  )
}

function getAvatarColor(name: string): string {
  const colors = [
    '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981',
    '#ef4444', '#3b82f6', '#ec4899', '#f97316',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
  confirmed: {
    color: '#10b981',
  },
  unconfirmed: {
    color: '#9ca3af',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7c3aed',
  },
  paid: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
})
