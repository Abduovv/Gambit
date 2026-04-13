import { createContext, ReactNode, useContext, useState, useCallback } from 'react'
import { Address } from '@solana/kit'
import { Session, Participant, SessionState, SESSION_STATES, formatSessionId } from '@/types/gambit'

// ── Mock wallet address ───────────────────────────────────────────────
const MOCK_WALLET = 'MockWallet11111111111111111111111111111111111' as Address
const MOCK_HOST = 'Host11111111111111111111111111111111111111111111' as Address
const MOCK_P1 = 'Participant11111111111111111111111111111111111' as Address
const MOCK_P2 = 'Participant22222222222222222222222222222222222' as Address
const MOCK_P3 = 'Participant33333333333333333333333333333333333' as Address
const MOCK_VAULT = 'Vault1111111111111111111111111111111111111111111' as Address
const MOCK_RECIPIENT = 'Recipient11111111111111111111111111111111111' as Address

function nowTs(): bigint {
  return BigInt(Math.floor(Date.now() / 1000))
}

// ── Context ───────────────────────────────────────────────────────────
export interface GambitContextValue {
  // Only ONE active session at a time
  activeSession: Session | null
  participants: Participant[]

  // Session lifecycle
  createSession: (input: { totalUsdt: bigint; fairnessAlpha: number; maxParticipants: number }) => Promise<void>
  joinSession: (displayName: string) => Promise<void>
  lockSession: () => Promise<void>
  confirmBill: () => Promise<void>
  requestReveal: () => Promise<void>
  simulateConsumeRandomness: () => Promise<void> // Mock VRF callback
  depositShare: () => Promise<void>
  settle: () => Promise<void>
  cancelSession: () => Promise<void>
  resetSession: () => void // Clear ended session to start fresh

  myWallet: Address
  isHost: boolean
  amIParticipant: boolean
}

export const GambitContext = createContext<GambitContextValue | null>(null)

export function GambitProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])

  const isHost = activeSession?.host === MOCK_WALLET
  const amIParticipant = participants.some((p) => p.wallet === MOCK_WALLET)

  const createSession = useCallback(
    async (input: { totalUsdt: bigint; fairnessAlpha: number; maxParticipants: number }) => {
      const sessionId = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256))
      setActiveSession({
        sessionId,
        host: MOCK_WALLET,
        totalUsdt: input.totalUsdt,
        maxParticipants: input.maxParticipants,
        participantCount: 0,
        confirmedCount: 0,
        paidCount: 0,
        totalCollected: 0n,
        state: SESSION_STATES.OPEN,
        fairnessAlpha: input.fairnessAlpha,
        deadlineTs: 0n,
        createdTs: nowTs(),
        vrfSeed: Array(32).fill(0),
        recipientTokenAccount: MOCK_RECIPIENT,
        usdtVault: MOCK_VAULT,
        bump: 255,
      })
      setParticipants([])
    },
    [],
  )

  const joinSession = useCallback(
    async (displayName: string) => {
      setActiveSession((prev) => {
        if (!prev) return prev
        return { ...prev, participantCount: prev.participantCount + 1 }
      })
      setParticipants((prev) => [
        ...prev,
        {
          session: formatSessionId((activeSession as Session).sessionId) as unknown as Address,
          wallet: MOCK_WALLET,
          displayName,
          amountDue: 0n,
          amountPaid: 0n,
          confirmedBill: false,
          joinIndex: participants.length,
          bump: 255,
        },
      ])
    },
    [activeSession, participants.length],
  )

  const lockSession = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev
      return { ...prev, state: SESSION_STATES.LOCKED }
    })
  }, [])

  const confirmBill = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev
      const newConfirmed = prev.confirmedCount + 1
      const newState = newConfirmed >= prev.participantCount ? SESSION_STATES.CONFIRMING : prev.state
      return { ...prev, confirmedCount: newConfirmed, state: newState }
    })
    setParticipants((prev) => prev.map((p) => (p.wallet === MOCK_WALLET ? { ...p, confirmedBill: true } : p)))
  }, [])

  const requestReveal = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev
      return { ...prev, state: SESSION_STATES.REVEALING }
    })
  }, [])

  /** Mock VRF callback — simulates the oracle consuming randomness */
  const simulateConsumeRandomness = useCallback(async () => {
    if (!activeSession) return
    const n = activeSession.participantCount
    const randomness = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))

    // Simple distribution: divide total evenly with some variance
    const avg = Number(activeSession.totalUsdt) / n
    const shares: bigint[] = []
    let remaining = Number(activeSession.totalUsdt)
    for (let i = 0; i < n; i++) {
      const variance = (Math.random() - 0.5) * avg * ((activeSession.fairnessAlpha * 2) / 10)
      let share = Math.round(avg + variance)
      if (i === n - 1)
        share = remaining // last one gets the remainder
      else remaining -= share
      shares.push(BigInt(share))
    }

    setActiveSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        vrfSeed: randomness,
        state: SESSION_STATES.PAYING,
        deadlineTs: nowTs() + 1800n, // 30 min
      }
    })
    setParticipants((prev) =>
      prev.map((p, i) => ({
        ...p,
        amountDue: shares[i] ?? 0n,
      })),
    )
  }, [activeSession])

  const depositShare = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev
      const me = participants.find((p) => p.wallet === MOCK_WALLET)
      if (!me) return prev
      const myDue = me.amountDue
      const newPaid = prev.paidCount + 1
      const newState = newPaid >= prev.participantCount ? SESSION_STATES.SETTLING : prev.state
      return {
        ...prev,
        paidCount: newPaid,
        totalCollected: prev.totalCollected + myDue,
        state: newState,
      }
    })
    setParticipants((prev) => prev.map((p) => (p.wallet === MOCK_WALLET ? { ...p, amountPaid: p.amountDue } : p)))
  }, [participants])

  const settle = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev
      return { ...prev, state: SESSION_STATES.SETTLED }
    })
  }, [])

  const cancelSession = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev
      return { ...prev, state: SESSION_STATES.CANCELLED }
    })
  }, [])

  const resetSession = useCallback(() => {
    setActiveSession(null)
    setParticipants([])
  }, [])

  return (
    <GambitContext.Provider
      value={{
        activeSession,
        participants,
        createSession,
        joinSession,
        lockSession,
        confirmBill,
        requestReveal,
        simulateConsumeRandomness,
        depositShare,
        settle,
        cancelSession,
        resetSession,
        myWallet: MOCK_WALLET,
        isHost,
        amIParticipant,
      }}
    >
      {children}
    </GambitContext.Provider>
  )
}

export function useGambit(): GambitContextValue {
  const ctx = useContext(GambitContext)
  if (!ctx) throw new Error('useGambit must be used within GambitProvider')
  return ctx
}
