import { useState } from 'react'

function formatDisplay(value) {
  if (value === 'Error') return value
  const num = Number(value)
  if (Number.isNaN(num)) return value
  // Keep decimals the user is mid-typing (e.g. "12.") intact.
  if (typeof value === 'string' && value.endsWith('.')) return value
  const parts = value.toString().split('.')
  parts[0] = Number(parts[0]).toLocaleString('en-US')
  return parts.join('.')
}

function calculate(a, b, op) {
  const x = Number(a)
  const y = Number(b)
  switch (op) {
    case '+': return x + y
    case '−': return x - y
    case '×': return x * y
    case '÷': return y === 0 ? NaN : x / y
    default: return y
  }
}

export default function Calculator({ onClose }) {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState(null)
  const [operator, setOperator] = useState(null)
  const [justEvaluated, setJustEvaluated] = useState(false)

  function inputDigit(d) {
    if (display === 'Error' || justEvaluated) {
      setDisplay(d)
      setJustEvaluated(false)
      return
    }
    if (display === '0') setDisplay(d)
    else setDisplay(display + d)
  }

  function inputDecimal() {
    if (display === 'Error' || justEvaluated) {
      setDisplay('0.')
      setJustEvaluated(false)
      return
    }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  function chooseOperator(op) {
    if (display === 'Error') return
    if (stored !== null && operator && !justEvaluated) {
      const result = calculate(stored, display, operator)
      const resultStr = Number.isNaN(result) ? 'Error' : String(result)
      setStored(resultStr)
      setDisplay(resultStr)
    } else {
      setStored(display)
    }
    setOperator(op)
    setJustEvaluated(true)
  }

  function evaluate() {
    if (stored === null || operator === null || display === 'Error') return
    const result = calculate(stored, display, operator)
    setDisplay(Number.isNaN(result) ? 'Error' : String(result))
    setStored(null)
    setOperator(null)
    setJustEvaluated(true)
  }

  function clearAll() {
    setDisplay('0')
    setStored(null)
    setOperator(null)
    setJustEvaluated(false)
  }

  function backspace() {
    if (display === 'Error' || justEvaluated || display.length <= 1) {
      setDisplay('0')
      return
    }
    setDisplay(display.slice(0, -1))
  }

  function toggleSign() {
    if (display === 'Error' || display === '0') return
    setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display)
  }

  const padBtn = 'rounded-md text-base font-mono py-3 active:scale-95 transition-transform'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-paper-raised w-full md:max-w-xs rounded-t-lg md:rounded-lg p-4 md:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-sm">Calculator</h2>
          <button onClick={onClose} className="text-muted text-sm" aria-label="Close calculator">✕</button>
        </div>

        <div className="bg-paper rounded-md px-4 py-4 mb-3 text-right">
          {operator && (
            <div className="text-xs text-muted font-mono mb-1">
              {formatDisplay(stored)} {operator}
            </div>
          )}
          <div className="font-mono text-3xl font-semibold truncate">{formatDisplay(display)}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button onClick={clearAll} className={`${padBtn} btn-secondary`}>C</button>
          <button onClick={toggleSign} className={`${padBtn} btn-secondary`}>±</button>
          <button onClick={backspace} className={`${padBtn} btn-secondary`}>⌫</button>
          <button onClick={() => chooseOperator('÷')} className={`${padBtn} bg-brand-light text-brand-dark`}>÷</button>

          <button onClick={() => inputDigit('7')} className={`${padBtn} btn-secondary`}>7</button>
          <button onClick={() => inputDigit('8')} className={`${padBtn} btn-secondary`}>8</button>
          <button onClick={() => inputDigit('9')} className={`${padBtn} btn-secondary`}>9</button>
          <button onClick={() => chooseOperator('×')} className={`${padBtn} bg-brand-light text-brand-dark`}>×</button>

          <button onClick={() => inputDigit('4')} className={`${padBtn} btn-secondary`}>4</button>
          <button onClick={() => inputDigit('5')} className={`${padBtn} btn-secondary`}>5</button>
          <button onClick={() => inputDigit('6')} className={`${padBtn} btn-secondary`}>6</button>
          <button onClick={() => chooseOperator('−')} className={`${padBtn} bg-brand-light text-brand-dark`}>−</button>

          <button onClick={() => inputDigit('1')} className={`${padBtn} btn-secondary`}>1</button>
          <button onClick={() => inputDigit('2')} className={`${padBtn} btn-secondary`}>2</button>
          <button onClick={() => inputDigit('3')} className={`${padBtn} btn-secondary`}>3</button>
          <button onClick={() => chooseOperator('+')} className={`${padBtn} bg-brand-light text-brand-dark`}>+</button>

          <button onClick={() => inputDigit('0')} className={`${padBtn} btn-secondary col-span-2`}>0</button>
          <button onClick={inputDecimal} className={`${padBtn} btn-secondary`}>.</button>
          <button onClick={evaluate} className={`${padBtn} btn-primary`}>=</button>
        </div>
      </div>
    </div>
  )
}
