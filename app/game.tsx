import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useGambit } from '@/features/gambit/gambit-context'
import { SESSION_STATES, formatUsd } from '@/types/gambit'
import { StateBadge } from '@/components/gambit/state-badge'
import { ParticipantList } from '@/components/gambit/participant-list'
import { RouletteWheel, ShareReveal } from '@/components/gambit/roulette'

export default function GameScreen() {
  const router = useRouter()
  const {
    activeSession,
    participants,
    isHost,
    amIParticipant,
    joinSession,
    lockSession,
    confirmBill,
    requestReveal,
    simulateConsumeRandomness,
    depositShare,
    settle,
    cancelSession,
  } = useGambit()

  const [loading, setLoading] = useState<string | null>(null)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [revealIndex, setRevealIndex] = useState(-1)

  const handleAction = useCallback(async (action: string, fn: () => Promise<void>) => {
    setLoading(action)
    try {
      await fn()
    } catch (err) {
      Alert.alert('Error', String(err))
    } finally {
      setLoading(null)
    }
  }, [])

  const handleWheelFinished = useCallback(() => {
    setWheelSpinning(false)
    setRevealing(true)
    setRevealIndex(0)
    simulateConsumeRandomness()
  }, [simulateConsumeRandomness])

  // No session
  if (!activeSession) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.centerText}>No active session</Text>
          <Pressable style={styles.backButton} onPress={() => router.push('../')}>
            <Text style={styles.backButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const s = activeSession
  const myParticipant = participants.find((p) => p.wallet)
  const hasPaid = myParticipant && myParticipant.amountPaid === myParticipant.amountDue && myParticipant.amountDue > 0n
  const isTerminal = s.state === SESSION_STATES.SETTLED || s.state === SESSION_STATES.CANCELLED

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push('../')} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🎰 SplitRoulette</Text>
        </View>
        <StateBadge state={s.state} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ROULETTE WHEEL during REVEALING */}
        {s.state === SESSION_STATES.REVEALING && !revealing && (
          <View style={styles.rouletteCard}>
            <Text style={styles.rouletteTitle}>🎰 Spinning the Roulette...</Text>
            <Text style={styles.rouletteSubtitle}>VRF randomness is determining fair shares</Text>
            <RouletteWheel
              participants={participants.map((p) => p.displayName)}
              spinning={wheelSpinning}
              onFinish={handleWheelFinished}
            />
          </View>
        )}

        {/* SHARE REVEAL after wheel stops */}
        {revealing && (
          <View style={styles.rouletteCard}>
            <ShareReveal
              participants={participants.map((p) => ({ name: p.displayName, amount: p.amountDue }))}
              visible={revealing}
              revealIndex={revealIndex}
            />
            {revealIndex >= participants.length - 1 && revealIndex >= 0 && (
              <Pressable style={styles.revealDoneButton} onPress={() => setRevealing(false)}>
                <Text style={styles.revealDoneButtonText}>✓ Shares Revealed</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Bill Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {s.state === SESSION_STATES.OPEN
              ? 'Session Details'
              : s.state <= SESSION_STATES.CONFIRMING
                ? 'The Bill'
                : 'Result'}
          </Text>
          <View style={styles.summaryGrid}>
            <SummaryItem label="Total Bill" value={formatUsd(s.totalUsdt)} />
            <SummaryItem label="Fairness" value={`±${s.fairnessAlpha * 10}%`} />
            <SummaryItem label="Max Seats" value={`${s.maxParticipants}`} />
            <SummaryItem label="Players" value={`${s.participantCount}`} />
          </View>
        </View>

        {/* Progress */}
        {!isTerminal && !revealing && s.state < SESSION_STATES.REVEALING && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Progress</Text>
            <ProgressItem label="👥 Players" current={s.participantCount} total={s.maxParticipants} />
            {s.state >= SESSION_STATES.LOCKED && (
              <ProgressItem label="✓ Confirmed" current={s.confirmedCount} total={s.participantCount} />
            )}
          </View>
        )}

        {/* Payment Progress */}
        {s.state >= SESSION_STATES.PAYING && s.state < SESSION_STATES.SETTLING && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💰 Payment Progress</Text>
            <ProgressItem label="Paid" current={s.paidCount} total={s.participantCount} />
            {s.totalCollected > 0n && <SummaryItem label="Collected" value={formatUsd(s.totalCollected)} />}
          </View>
        )}

        {/* Participants */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Players ({participants.length}/{s.maxParticipants})
          </Text>
          <ParticipantList
            participants={participants}
            showAmounts={s.state >= SESSION_STATES.PAYING}
            showConfirmStatus={s.state >= SESSION_STATES.LOCKED}
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>{renderActions()}</View>
    </SafeAreaView>
  )

  function renderActions() {
    // OPEN
    if (s.state === SESSION_STATES.OPEN) {
      return (
        <>
          {!amIParticipant ? (
            <ActionButton
              title="Join the Roulette"
              variant="primary"
              onPress={() => handleAction('join', () => joinSession('Player_' + Math.floor(Math.random() * 1000)))}
              loading={loading === 'join'}
            />
          ) : (
            <ActionButton title="Waiting for more players..." variant="secondary" onPress={() => {}} />
          )}
          {isHost && (
            <ActionButton
              title={`🔒 Lock & Start (${s.participantCount}/${s.maxParticipants})`}
              variant="warning"
              onPress={() => handleAction('lock', lockSession)}
              loading={loading === 'lock'}
              disabled={s.participantCount < 2}
            />
          )}
          {isHost && (
            <ActionButton
              title="Cancel Session"
              variant="danger"
              onPress={() => handleAction('cancel', cancelSession)}
              loading={loading === 'cancel'}
            />
          )}
        </>
      )
    }

    // LOCKED
    if (s.state === SESSION_STATES.LOCKED) {
      return (
        <>
          {amIParticipant && !myParticipant?.confirmedBill && (
            <ActionButton
              title="✓ Confirm the Bill"
              variant="primary"
              onPress={() => handleAction('confirm', confirmBill)}
              loading={loading === 'confirm'}
              subtitle={`Total: ${formatUsd(s.totalUsdt)}`}
            />
          )}
          {myParticipant?.confirmedBill && (
            <View style={styles.waitingBanner}>
              <Text style={styles.waitingBannerText}>✓ You confirmed. Waiting for others...</Text>
            </View>
          )}
          {isHost && (
            <ActionButton
              title="Cancel Session"
              variant="danger"
              onPress={() => handleAction('cancel', cancelSession)}
              loading={loading === 'cancel'}
            />
          )}
        </>
      )
    }

    // CONFIRMING
    if (s.state === SESSION_STATES.CONFIRMING) {
      return (
        <>
          {isHost ? (
            <ActionButton
              title="🎰 Spin the Roulette"
              variant="primary"
              subtitle="Trigger VRF randomness"
              onPress={() => {
                setWheelSpinning(true)
                handleAction('reveal', requestReveal)
              }}
              loading={loading === 'reveal'}
            />
          ) : (
            <View style={styles.waitingBanner}>
              <Text style={styles.waitingBannerText}>All confirmed. Waiting for host to spin...</Text>
            </View>
          )}
        </>
      )
    }

    // PAYING
    if (s.state === SESSION_STATES.PAYING) {
      return (
        <>
          {amIParticipant && !hasPaid && myParticipant && myParticipant.amountDue > 0n && (
            <ActionButton
              title={`💰 Pay ${formatUsd(myParticipant.amountDue)}`}
              variant="primary"
              onPress={() => handleAction('pay', depositShare)}
              loading={loading === 'pay'}
              subtitle="Pay your exact share in USDT"
            />
          )}
          {hasPaid && (
            <View style={styles.waitingBanner}>
              <Text style={styles.waitingBannerText}>
                ✓ You paid! Waiting for others... ({s.paidCount}/{s.participantCount})
              </Text>
            </View>
          )}
        </>
      )
    }

    // SETTLING
    if (s.state === SESSION_STATES.SETTLING) {
      return (
        <ActionButton
          title="🏆 Settle & Distribute"
          variant="primary"
          onPress={() => handleAction('settle', settle)}
          loading={loading === 'settle'}
          subtitle="Drain vault to recipient"
        />
      )
    }

    // SETTLED
    if (s.state === SESSION_STATES.SETTLED) {
      return (
        <View style={styles.endedBanner}>
          <Text style={styles.endedBannerText}>✅ Session settled. Funds distributed!</Text>
        </View>
      )
    }

    // CANCELLED
    if (s.state === SESSION_STATES.CANCELLED) {
      return (
        <View style={[styles.endedBanner, { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.endedBannerText, { color: '#ef4444' }]}>✕ Session cancelled. Deposits refunded.</Text>
        </View>
      )
    }

    return null
  }
}

// ── Sub-components ────────────────────────────────────────────────────

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  )
}

function ProgressItem({ label, current, total }: { label: string; current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0
  const complete = current >= total
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressCount, complete && styles.progressCountComplete]}>
          {current}/{total}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: complete ? '#10b981' : '#7c3aed' }]} />
      </View>
    </View>
  )
}

function ActionButton({
  title,
  variant = 'primary',
  subtitle,
  onPress,
  loading = false,
  disabled = false,
}: {
  title: string
  variant?: 'primary' | 'warning' | 'danger' | 'secondary'
  subtitle?: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    primary: { bg: '#7c3aed', text: '#ffffff' },
    warning: { bg: '#f59e0b', text: '#ffffff' },
    danger: { bg: '#fef2f2', text: '#ef4444' },
    secondary: { bg: '#f3f4f6', text: '#374151' },
  }
  const v = colors[variant]
  return (
    <View style={styles.actionWrapper}>
      <Pressable
        style={[styles.actionButton, { backgroundColor: disabled ? '#e5e7eb' : v.bg, opacity: loading ? 0.7 : 1 }]}
        onPress={onPress}
        disabled={disabled || loading}
      >
        <Text style={[styles.actionButtonText, { color: v.text }]}>{loading ? 'Processing...' : title}</Text>
      </Pressable>
      {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerText: { fontSize: 18, fontWeight: '600', color: '#6b7280' },
  backButton: { backgroundColor: '#7c3aed', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  backButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  backIcon: { padding: 4 },
  backIconText: { fontSize: 20, color: '#374151' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { flex: 1, minWidth: '45%', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, gap: 4 },
  summaryLabel: { fontSize: 12, color: '#6b7280' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  progressItem: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  progressCount: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  progressCountComplete: { color: '#10b981' },
  progressTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  rouletteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#7c3aed',
    gap: 8,
  },
  rouletteTitle: { fontSize: 18, fontWeight: '800', color: '#7c3aed', textAlign: 'center' },
  rouletteSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  revealDoneButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  revealDoneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  actionWrapper: { gap: 4 },
  actionButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { fontSize: 16, fontWeight: '700' },
  actionSubtitle: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  waitingBanner: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, alignItems: 'center' },
  waitingBannerText: { fontSize: 14, fontWeight: '500', color: '#166534' },
  endedBanner: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, alignItems: 'center' },
  endedBannerText: { fontSize: 14, fontWeight: '500', color: '#166534' },
})
