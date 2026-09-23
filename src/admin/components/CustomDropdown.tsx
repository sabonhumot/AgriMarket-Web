import { useEffect, useRef, useState } from 'react'

export type DropdownOption = {
  value: string
  label: string
  color?: string
}

type CustomDropdownProps = {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  label?: string
  ariaLabel?: string
  name?: string
  id?: string
  variant?: 'card' | 'filter' | 'mobile'
  className?: string
}

export default function CustomDropdown({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  id,
  variant = 'filter',
  className = '',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value) || options[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleSelect(val: string) {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div
      ref={dropdownRef}
      className={`custom-dropdown custom-dropdown-${variant} ${isOpen ? 'is-open' : ''} ${className}`}
      id={id}
    >
      {/* Hidden accessible select to ensure programmatic, form, and screen-reader compatibility */}
      <select
        className="custom-dropdown-native-select sr-only"
        aria-label={ariaLabel || label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="custom-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || label || selectedOption?.label}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="custom-dropdown-selected-label">
          {selectedOption?.label}
        </span>
        <svg
          className={`custom-dropdown-chevron ${isOpen ? 'is-open' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <ul
          className="custom-dropdown-menu"
          role="listbox"
          aria-label={ariaLabel || label}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="custom-dropdown-item-text">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="custom-dropdown-check"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 10.5 8 14.5 16 5.5" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
