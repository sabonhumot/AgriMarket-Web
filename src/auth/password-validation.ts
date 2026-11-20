export interface PasswordCriteria {
  hasMinLength: boolean
  hasLower: boolean
  hasUpper: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

export interface PasswordValidationResult extends PasswordCriteria {
  isValid: boolean
  errors: string[]
  primaryError: string | null
}

export function checkPasswordCriteria(password: string): PasswordCriteria {
  return {
    hasMinLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9\s]/.test(password),
  }
}

export function validateNewPassword(password: string): PasswordValidationResult {
  const criteria = checkPasswordCriteria(password)
  const errors: string[] = []

  if (!criteria.hasMinLength) {
    errors.push('Password must be at least 8 characters long.')
  }
  if (!criteria.hasLower || !criteria.hasUpper) {
    errors.push('Password must include both uppercase and lowercase letters.')
  }
  if (!criteria.hasNumber) {
    errors.push('Password must contain at least one number.')
  }
  if (!criteria.hasSpecial) {
    errors.push('Password must contain at least one special character.')
  }

  return {
    ...criteria,
    isValid: errors.length === 0,
    errors,
    primaryError: errors[0] || null,
  }
}
