import { useZxing } from 'react-zxing'

// Shared camera scanner used wherever a barcode/QR code needs to be read —
// currently the Sell page (scan a product to add it to the cart) and the
// Products form (scan to fill in the Barcode field instead of typing it).
export function ScannerModal({ onResult, onClose, instructions = "Point the camera at a product's barcode or QR code." }) {
  const { ref } = useZxing({
    onDecodeResult(result) {
      onResult(result.rawValue)
    },
    onError(err) {
      console.error('Scanner error:', err)
    },
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-paper-raised rounded-lg p-4 w-full max-w-sm">
        <h2 className="font-display font-semibold mb-3 text-center">Scan code</h2>
        <video ref={ref} className="w-full rounded-md bg-black aspect-square object-cover" />
        <p className="text-xs text-muted text-center mt-3">{instructions}</p>
        <button onClick={onClose} className="btn-secondary w-full mt-4">Cancel</button>
      </div>
    </div>
  )
}

export function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V4a1 1 0 0 1 1-1h3M3 17v3a1 1 0 0 0 1 1h3M21 7V4a1 1 0 0 0-1-1h-3M21 17v3a1 1 0 0 1-1 1h-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
