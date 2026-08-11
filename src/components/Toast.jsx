import { useEffect } from 'react'

export default function Toast({ message, onClose, duration = 1600 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null
  return <div className="toast">{message}</div>
}
