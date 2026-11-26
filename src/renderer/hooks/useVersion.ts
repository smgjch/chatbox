import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

import platform from '../platform'

function getInitialTime() {
  let initialTime = parseInt(localStorage.getItem('initial-time') || '')
  if (!initialTime) {
    initialTime = Date.now()
    localStorage.setItem('initial-time', `${initialTime}`)
  }

  return initialTime
}

export function isFirstDay(): boolean {
  const initialTime = getInitialTime()
  const today = dayjs()
  const installDay = dayjs(initialTime)

  // Compare only the date part (year, month, day) in user's local timezone
  // This ensures the comparison is based on the user's current timezone,
  // which is more intuitive for the user experience
  return today.isSame(installDay, 'day')
}

export default function useVersion() {
  const [version, setVersion] = useState('')
  useEffect(() => {
    void platform.getVersion().then(setVersion)
  }, [])
  return { version, versionLoaded: !!version, isExceeded: false, isExceededResolved: true, needCheckUpdate: false }
}
