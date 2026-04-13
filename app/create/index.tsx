import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useGambit } from '@/features/gambit/gambit-context'
import {
  MIN_PARTICIPANTS,
  MAX_PARTICIPANTS,
  MIN_FAIRNESS_ALPHA,
  MAX_FAIRNESS_ALPHA,
  FAIRNESS_ALPHA_LABELS,
  formatUsd,
} from '@/types/gambit'

export default function CreateSessionScreen() {
  const router = useRouter()
  const { createSession } = useGambit()

  const [totalUsdtInput, setTotalUsdtInput] = useState('50')
  const [fairnessAlpha, setFairnessAlpha] = useState(5)
  const [maxParticipants, setMaxParticipants] = useState(4)
  const [loading, setLoading] = useState(false)

  const totalUsdt = BigInt(Math.floor(Number(totalUsdtInput || '0') * 1_000_000))

  const handleCreate = async () => {
    if (Number(totalUsdtInput) <= 0) {
      Alert.alert('Error', 'Total bill must be greater than 0')
      return
    }
    if (maxParticipants < MIN_PARTICIPANTS) {
      Alert.alert('Error', `Need at least ${MIN_PARTICIPANTS} participants`)
      return
    }
    if (fairnessAlpha < MIN_FAIRNESS_ALPHA || fairnessAlpha > MAX_FAIRNESS_ALPHA) {
      Alert.alert('Error', `Fairness must be between ${MIN_FAIRNESS_ALPHA} and ${MAX_FAIRNESS_ALPHA}`)
      return
    }

    setLoading(true)
    try {
      await createSession({ totalUsdt, fairnessAlpha, maxParticipants })
      router.replace('./game')
    } catch (err) {
      Alert.alert('Error', String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎰 New Roulette</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Bill */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Bill</Text>
          <View style={styles.inputRow}>
            <Text style={styles.dollarSign}>$</Text>
            <Text style={styles.bigInput}>{totalUsdtInput || '0'}</Text>
          </View>
          <View style={styles.inputButtons}>
            {[10, 25, 50, 100].map((amt) => (
              <Pressable key={amt} style={styles.quickButton} onPress={() => setTotalUsdtInput(String(amt))}>
                <Text style={styles.quickButtonText}>${amt}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>The total amount to split among players</Text>
        </View>

        {/* Fairness */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fairness Spread</Text>
          <Text style={styles.fairnessValue}>{FAIRNESS_ALPHA_LABELS[fairnessAlpha]}</Text>
          <View style={styles.sliderTrack}>
            {Array.from({ length: MAX_FAIRNESS_ALPHA }, (_, i) => i + 1).map((val) => (
              <Pressable
                key={val}
                style={[styles.sliderDot, val <= fairnessAlpha && styles.sliderDotActive]}
                onPress={() => setFairnessAlpha(val)}
              />
            ))}
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>±10% (Equal)</Text>
            <Text style={styles.sliderLabel}>±100% (Wild)</Text>
          </View>
        </View>

        {/* Players */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Max Players</Text>
          <View style={styles.participantSelector}>
            <Pressable
              style={styles.participantButton}
              onPress={() => setMaxParticipants(Math.max(MIN_PARTICIPANTS, maxParticipants - 1))}
            >
              <Text style={styles.participantButtonText}>−</Text>
            </Pressable>
            <Text style={styles.participantValue}>{maxParticipants}</Text>
            <Pressable
              style={styles.participantButton}
              onPress={() => setMaxParticipants(Math.min(MAX_PARTICIPANTS, maxParticipants + 1))}
            >
              <Text style={styles.participantButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Summary */}
        <View style={[styles.card, styles.summaryCard]}>
          <Text style={styles.summaryTitle}>Session Preview</Text>
          <SummaryRow label="Bill" value={formatUsd(totalUsdt)} />
          <SummaryRow label="Avg per person" value={formatUsd(totalUsdt / BigInt(maxParticipants))} />
          <SummaryRow label="Fairness" value={FAIRNESS_ALPHA_LABELS[fairnessAlpha]} />
          <SummaryRow label="Seats" value={`${maxParticipants}`} />
        </View>
      </ScrollView>

      {/* Create Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>{loading ? 'Spinning Up...' : '🎰 Start the Roulette'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 15,
    color: '#7c3aed',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dollarSign: {
    fontSize: 32,
    fontWeight: '300',
    color: '#9ca3af',
  },
  bigInput: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
  },
  inputButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  helper: {
    fontSize: 12,
    color: '#9ca3af',
  },
  fairnessValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#7c3aed',
    textAlign: 'center',
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  sliderDotActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  participantSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  participantButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  participantValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    minWidth: 60,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3aed',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  createButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#c4b5fd',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
})
