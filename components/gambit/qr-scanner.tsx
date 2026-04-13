import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, Modal, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

export function QrScannerModal({
  visible,
  onClose,
  onScan,
}: {
  visible: boolean
  onClose: () => void
  onScan: (data: string) => void
}) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  // Reset scanned state when modal closes
  useEffect(() => {
    if (!visible) setScanned(false)
  }, [visible])

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return
    setScanned(true)
    onScan(data)
    onClose()
  }

  if (!permission) return null

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionText}>
              We need camera access to scan QR codes for recipient addresses.
            </Text>
            <Pressable
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </Pressable>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        {/* Camera View */}
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          {/* Scanning overlay */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>
              Point camera at the recipient QR code
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#7c3aed',
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  scanHint: {
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
    maxWidth: 280,
  },
  // Permission card
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  permissionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '500',
  },
})
