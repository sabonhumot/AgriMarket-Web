import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import './ImageCropDialog.css'

type CropKind = 'avatar' | 'cover'

const dimensions = {
  avatar: { preview: [480, 480], output: [512, 512], label: 'Profile photo' },
  cover: { preview: [640, 360], output: [1600, 900], label: 'Event cover' },
} as const

function cropSource(image: HTMLImageElement, width: number, height: number, zoom: number, pan: { x: number; y: number }) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom
  const excessX = (image.naturalWidth * scale - width) / 2
  const excessY = (image.naturalHeight * scale - height) / 2
  const x = Math.max(-excessX, Math.min(excessX, pan.x))
  const y = Math.max(-excessY, Math.min(excessY, pan.y))
  return { sx: (image.naturalWidth - width / scale) / 2 - x / scale, sy: (image.naturalHeight - height / scale) / 2 - y / scale, sw: width / scale, sh: height / scale }
}

function drawCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, zoom: number, pan: { x: number; y: number }, previewWidth: number) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image editing is not supported in this browser.')
  const ratio = canvas.width / previewWidth
  const { sx, sy, sw, sh } = cropSource(image, canvas.width, canvas.height, zoom, { x: pan.x * ratio, y: pan.y * ratio })
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
}

export default function ImageCropDialog({ file, kind, onCancel, onApply }: { file: File; kind: CropKind; onCancel: () => void; onApply: (file: File) => void }) {
  const config = dimensions[kind]
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const next = new Image()
    next.onload = () => setImage(next)
    next.onerror = () => setError('This image could not be opened. Choose another JPG or PNG.')
    next.src = url
    return () => { next.onload = null; next.onerror = null; URL.revokeObjectURL(url) }
  }, [file])

  useEffect(() => {
    if (image && canvas.current) drawCrop(canvas.current, image, zoom, pan, config.preview[0])
  }, [image, zoom, pan, config])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  function movePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!pointer.current || !image || !canvas.current) return
    const rect = canvas.current.getBoundingClientRect()
    const scale = Math.max(config.preview[0] / image.naturalWidth, config.preview[1] / image.naturalHeight) * zoom
    const maxX = (image.naturalWidth * scale - config.preview[0]) / 2
    const maxY = (image.naturalHeight * scale - config.preview[1]) / 2
    const x = pointer.current.panX + (event.clientX - pointer.current.x) * config.preview[0] / rect.width
    const y = pointer.current.panY + (event.clientY - pointer.current.y) * config.preview[1] / rect.height
    setPan({ x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) })
  }

  async function apply() {
    if (!image || processing) return
    setProcessing(true); setError('')
    try {
      const output = document.createElement('canvas')
      output.width = config.output[0]
      output.height = config.output[1]
      drawCrop(output, image, zoom, pan, config.preview[0])
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('The crop could not be saved.')), 'image/jpeg', 0.88))
      onApply(new File([blob], file.name.replace(/\.[^.]+$/, '') + '-cropped.jpg', { type: 'image/jpeg' }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The crop could not be saved.'); setProcessing(false) }
  }

  const previewScale = image ? Math.max(config.preview[0] / image.naturalWidth, config.preview[1] / image.naturalHeight) * zoom : 1

  return <div className="em-crop-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <div className="em-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="em-crop-title">
      <div className="em-crop-head"><div><h2 id="em-crop-title">Adjust {config.label.toLowerCase()}</h2><p>Drag to reposition. Use the slider to zoom.</p></div><button className="em-crop-close" type="button" aria-label="Close image editor" onClick={onCancel}>×</button></div>
      <div className={'em-crop-stage em-crop-stage-' + kind}><div className="em-crop-frame">
        {image && <img className="em-crop-full-image" src={image.src} alt="" aria-hidden="true" draggable={false} style={{ width: `${image.naturalWidth * previewScale / config.preview[0] * 100}%`, left: `${50 + pan.x / config.preview[0] * 100}%`, top: `${50 + pan.y / config.preview[1] * 100}%` }} />}
        <canvas ref={canvas} width={config.preview[0]} height={config.preview[1]} role="img" aria-label={config.label + ' crop preview'} tabIndex={0} onPointerDown={(event) => { if (!image) return; pointer.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={movePointer} onPointerUp={() => { pointer.current = null }} onPointerCancel={() => { pointer.current = null }} onKeyDown={(event) => { if (!image || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const delta = event.shiftKey ? 20 : 5; setPan((current) => ({ x: current.x + (event.key === 'ArrowLeft' ? delta : event.key === 'ArrowRight' ? -delta : 0), y: current.y + (event.key === 'ArrowUp' ? delta : event.key === 'ArrowDown' ? -delta : 0) })) }} />
      </div></div>
      <label className="em-crop-zoom" htmlFor="em-crop-zoom"><span>Zoom</span><input id="em-crop-zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label>
      {error && <p className="em-crop-error" role="alert">{error}</p>}
      <div className="em-crop-actions"><button type="button" className="em-button-secondary" onClick={onCancel}>Cancel</button><button type="button" className="em-button-primary" disabled={!image || processing || Boolean(error)} onClick={() => void apply()}>{processing ? 'Preparing…' : 'Use this photo'}</button></div>
    </div>
  </div>
}
