import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SessionState, SESSION_STATE_LABELS, SESSION_STATE_COLORS, formatSessionId } from '@/types/gambit'

export function StateBadge({ state }: { state: SessionState }) {
  const label = SESSION_STATE_LABELS[state]
  const color = SESSION_STATE_COLORS[state]

  return (
    <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

export function SessionIdBadge({ sessionId }: { sessionId: number[] }) {
  const code = formatSessionId(sessionId)
  return (
    <View style={styles.idBadge}>
      <Text style={styles.idText}>{code}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  idBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  idText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#374151',
  },
})
