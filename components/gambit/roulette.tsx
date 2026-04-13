import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native'

const { width } = Dimensions.get('window')
const WHEEL_SIZE = Math.min(width - 80, 300)
const SEGMENT_COLORS = [
  '#7c3aed', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#ec4899', // pink
  '#f97316', // orange
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#e11d48', // rose
  '#6366f1', // indigo
]

interface RouletteWheelProps {
  participants: string[] // display names
  spinning?: boolean
  onFinish?: () => void
}

export function RouletteWheel({
  participants,
  spinning = false,
  onFinish,
}: RouletteWheelProps) {
  const spinValue = useRef(new Animated.Value(0)).current
  const [currentRotation, setCurrentRotation] = useState(0)
  const n = Math.max(participants.length, 1)
  const segmentAngle = 360 / n

  // Spin animation
  useEffect(() => {
    if (!spinning) return

    // Random number of full rotations (5-10) + random landing
    const extraRotations = 5 + Math.random() * 5
    const landingAngle = Math.random() * 360
    const totalRotation = currentRotation + extraRotations * 360 + landingAngle

    setCurrentRotation(totalRotation)

    Animated.timing(spinValue, {
      toValue: totalRotation,
      duration: 4000 + extraRotations * 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onFinish?.()
    })
  }, [spinning])

  const spin = spinValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.container}>
      {/* Pointer arrow at top */}
      <View style={styles.pointerContainer}>
        <View style={styles.pointer} />
      </View>

      {/* Wheel */}
      <Animated.View
        style={[
          styles.wheel,
          {
            width: WHEEL_SIZE,
            height: WHEEL_SIZE,
            transform: [{ rotate: spin }],
          },
        ]}
      >
        {participants.length === 0 ? (
          <View style={[styles.emptyWheel, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
            <Text style={styles.emptyText}>Waiting for players...</Text>
          </View>
        ) : (
          <>
            {/* Render wheel segments */}
            {Array.from({ length: n }).map((_, i) => (
              <WheelSegment
                key={i}
                index={i}
                total={n}
                color={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                name={participants[i]}
              />
            ))}
            {/* Center circle */}
            <View style={styles.centerCircle}>
              <Text style={styles.centerText}>🎲</Text>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  )
}

function WheelSegment({
  index,
  total,
  color,
  name,
}: {
  index: number
  total: number
  color: string
  name: string
}) {
  const segmentAngle = 360 / total
  const rotation = index * segmentAngle

  // For large segments, we can draw proper wedge shapes
  // For simplicity, we use a rotated rectangle overlay
  const isLarge = total <= 6

  return (
    <View
      style={[
        styles.segmentContainer,
        {
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          position: 'absolute',
        },
      ]}
    >
      {/* Segment wedge */}
      <View
        style={[
          styles.segmentWedge,
          {
            backgroundColor: color,
            transform: [{ rotate: `${rotation + segmentAngle / 2}deg` }],
            width: isLarge ? WHEEL_SIZE * 0.35 : WHEEL_SIZE * 0.25,
          },
        ]}
      />
      {/* Name label */}
      <View
        style={[
          styles.nameLabel,
          {
            transform: [
              {
                rotate: `${rotation + segmentAngle / 2}deg`,
              },
              {
                translateX: WHEEL_SIZE * 0.28,
              },
            ],
          },
        ]}
      >
        <Text style={styles.nameText} numberOfLines={1}>
          {name.length > 8 ? name.slice(0, 7) + '…' : name}
        </Text>
      </View>
    </View>
  )
}

// ── Share Reveal Animation ────────────────────────────────────────────

interface ShareRevealProps {
  participants: { name: string; amount: bigint }[]
  visible: boolean
  revealIndex: number
}

export function ShareReveal({
  participants,
  visible,
  revealIndex,
}: ShareRevealProps) {
  const animations = useRef(
    participants.map(() => new Animated.Value(0))
  ).current

  useEffect(() => {
    if (!visible || revealIndex >= participants.length) return
    const anim = animations[revealIndex]
    if (!anim) return
    Animated.spring(anim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start()
  }, [revealIndex, visible])

  if (!visible) return null

  return (
    <View style={styles.revealContainer}>
      <Text style={styles.revealTitle}>🎰 Share Distribution</Text>
      {participants.map((p, i) => {
        if (i > revealIndex) return null
        const anim = animations[i] ?? new Animated.Value(1)
        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        })
        const opacity = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        })

        return (
          <Animated.View
            key={p.name + i}
            style={[
              styles.revealRow,
              {
                transform: [{ scale }],
                opacity,
              },
            ]}
          >
            <View
              style={[
                styles.revealAvatar,
                {
                  backgroundColor:
                    SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                },
              ]}
            >
              <Text style={styles.revealAvatarText}>
                {p.name[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.revealInfo}>
              <Text style={styles.revealName}>{p.name}</Text>
              <Text style={styles.revealAmount}>
                ${Number(p.amount / 1_000_000n).toLocaleString()}
              </Text>
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  pointerContainer: {
    alignItems: 'center',
    marginBottom: -8,
    zIndex: 10,
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ef4444',
  },
  wheel: {
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#1f2937',
    backgroundColor: '#374151',
    position: 'relative',
  },
  emptyWheel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  segmentContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentWedge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: 0,
    transformOrigin: 'bottom center',
    opacity: 0.9,
  },
  nameLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  centerCircle: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#7c3aed',
    zIndex: 5,
  },
  centerText: {
    fontSize: 22,
  },
  // Share Reveal
  revealContainer: {
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  revealTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
    maxWidth: 350,
    gap: 12,
  },
  revealAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  revealInfo: {
    flex: 1,
  },
  revealName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  revealAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7c3aed',
  },
})
