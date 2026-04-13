import React from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useGambit } from '@/features/gambit/gambit-context'
import { SESSION_STATES, formatUsd } from '@/types/gambit'
import { StateBadge } from '@/components/gambit/state-badge'

export default function HomeScreen() {
  const router = useRouter()
  const { activeSession, resetSession } = useGambit()

  const isTerminal =
    activeSession?.state === SESSION_STATES.SETTLED || activeSession?.state === SESSION_STATES.CANCELLED

  // No session — show landing page
  if (!activeSession) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.landing}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🎰</Text>
            <Text style={styles.logoTitle}>SplitRoulette</Text>
            <Text style={styles.logoSubtitle}>Spin the wheel. Split the bill. Fairly.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How it works</Text>
            <Step number={1} text="Host creates a session with the total bill" />
            <Step number={2} text="Friends join the roulette" />
            <Step number={3} text="Everyone confirms the bill" />
            <Step number={4} text="Host spins the VRF roulette wheel" />
            <Step number={5} text="Shares revealed — everyone pays their portion" />
            <Step number={6} text="Session settles — funds distributed" />
          </View>

          <Pressable style={styles.createButton} onPress={() => router.push('./create')}>
            <Text style={styles.createButtonText}>🎲 Start a New Session</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // Session ended — show result
  if (isTerminal) {
    const isSettled = activeSession.state === SESSION_STATES.SETTLED
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.landing}>
          <View style={styles.resultContainer}>
            <Text style={styles.resultEmoji}>{isSettled ? '✅' : '❌'}</Text>
            <Text style={styles.resultTitle}>{isSettled ? 'Session Settled!' : 'Session Cancelled'}</Text>
            <Text style={styles.resultSubtitle}>
              {isSettled
                ? `Bill of ${formatUsd(activeSession.totalUsdt)} has been distributed`
                : 'All deposits have been refunded'}
            </Text>
          </View>

          <Pressable
            style={styles.createButton}
            onPress={() => {
              resetSession()
              router.push('./create')
            }}
          >
            <Text style={styles.createButtonText}>🎲 Start a New Session</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // Active session — redirect to session view
  // This screen should briefly show then redirect, or we just show the session inline
  // For simplicity, we show the current session state here
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🎰 SplitRoulette</Text>
          <Text style={styles.headerSubtitle}>Session Active</Text>
        </View>
        <StateBadge state={activeSession.state} />
      </View>

      <View style={styles.sessionInfo}>
        <Text style={styles.sessionLabel}>Current Session</Text>
        <Text style={styles.sessionBill}>{formatUsd(activeSession.totalUsdt)}</Text>
        <Text style={styles.sessionMeta}>
          {activeSession.participantCount}/{activeSession.maxParticipants} players
          {' · '}±{activeSession.fairnessAlpha * 10}% fairness
        </Text>
      </View>

      <Pressable style={styles.viewButton} onPress={() => router.push('./game')}>
        <Text style={styles.viewButtonText}>▶ Enter the Roulette</Text>
      </Pressable>

      <Pressable
        style={styles.createButton}
        onPress={() => {
          resetSession()
          router.push('./create')
        }}
      >
        <Text style={styles.createButtonText}>🎲 Start a New Session</Text>
      </Pressable>
    </SafeAreaView>
  )
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  landing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 8,
  },
  logoEmoji: {
    fontSize: 72,
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },
  logoSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
    gap: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  createButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  // Active session view
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
  sessionInfo: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sessionLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  sessionBill: {
    fontSize: 36,
    fontWeight: '900',
    color: '#7c3aed',
  },
  sessionMeta: {
    fontSize: 14,
    color: '#6b7280',
  },
  viewButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    marginHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  // Result screen
  resultContainer: {
    alignItems: 'center',
    gap: 12,
  },
  resultEmoji: {
    fontSize: 64,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  resultSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 280,
  },
})
