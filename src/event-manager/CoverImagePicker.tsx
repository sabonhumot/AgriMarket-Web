import { useRef, type ChangeEvent } from 'react'
import './CoverImagePicker.css'

export default function CoverImagePicker({ preview, selected, existing, disabled, onChoose, onRemove }: {
  preview: string
  selected: boolean
  existing: boolean
  disabled: boolean
  onChoose: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)

  return <div className={'em-cover-card' + (preview ? ' has-image' : '')}>
    <div className="em-cover-card-visual">
      {preview ? <img src={preview} alt="Event cover preview" /> : <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="12" width="46" height="40" rx="5" /><circle cx="23" cy="25" r="4" /><path d="m11 44 12-12 9 8 9-12 13 16" /></svg>}
    </div>
    <div className="em-cover-card-content">
      <strong>{selected ? 'New cover ready' : existing ? 'Current cover image' : 'Give your event a cover'}</strong>
      <p>{selected ? 'Your cropped image will be added when you save the event.' : existing ? 'This image is shown with your event. Choose another to replace it.' : 'Choose a photo that helps farmers recognize the event.'}</p>
      <input ref={input} className="em-cover-card-input" type="file" accept="image/jpeg,image/png" aria-label="Choose event cover image" disabled={disabled} onChange={onChoose} />
      <div className="em-cover-card-actions"><button type="button" className="em-cover-card-choose" disabled={disabled} onClick={() => input.current?.click()}>{preview ? 'Change image' : 'Choose image'}</button>{selected && <button type="button" className="em-cover-card-remove" disabled={disabled} onClick={onRemove}>Remove selection</button>}</div>
      <span className="em-cover-card-hint">JPG or PNG · up to 8 MB · crop before upload</span>
    </div>
  </div>
}
