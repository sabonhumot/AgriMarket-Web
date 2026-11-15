export default class QrScanner {
  constructor(video: HTMLVideoElement, onDecode: (result: { data: string }) => void, options?: {
    preferredCamera?: 'environment' | 'user'
    maxScansPerSecond?: number
    returnDetailedScanResult?: true
  })
  start(): Promise<void>
  stop(): void
  destroy(): void
}
