import React from 'react'
import { useRef, useEffect, useState, useCallback } from 'react'

// Mobile detection utility
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
}

// Virtual Joystick Component
export function VirtualJoystick({ onMove }) {
  const joystickRef = useRef()
  const knobRef = useRef()
  const [isDragging, setIsDragging] = useState(false)
  const [joystickCenter, setJoystickCenter] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!joystickRef.current) return

    const joystick = joystickRef.current
    const knob = knobRef.current
    const rect = joystick.getBoundingClientRect()
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    setJoystickCenter(center)

    const handleStart = (e) => {
      setIsDragging(true)
      e.preventDefault()
    }

    const handleMove = (e) => {
      if (!isDragging) return
      e.preventDefault()

      const touch = e.touches ? e.touches[0] : e
      const deltaX = touch.clientX - center.x
      const deltaY = touch.clientY - center.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const maxDistance = 40

      let x = deltaX
      let y = deltaY

      if (distance > maxDistance) {
        x = (deltaX / distance) * maxDistance
        y = (deltaY / distance) * maxDistance
      }

      knob.style.transform = `translate(${x}px, ${y}px)`
      
      // Normalize values between -1 and 1
      const normalizedX = x / maxDistance
      const normalizedY = -y / maxDistance // Invert Y for game controls

      onMove({ x: normalizedX, y: normalizedY })
    }

    const handleEnd = (e) => {
      setIsDragging(false)
      knob.style.transform = 'translate(0px, 0px)'
      onMove({ x: 0, y: 0 })
      e.preventDefault()
    }

    // Touch events
    joystick.addEventListener('touchstart', handleStart)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleEnd)

    // Mouse events for testing on desktop
    joystick.addEventListener('mousedown', handleStart)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)

    return () => {
      joystick.removeEventListener('touchstart', handleStart)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
      joystick.removeEventListener('mousedown', handleStart)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
    }
  }, [isDragging, onMove])

  return (
    <div
      ref={joystickRef}
      style={{
        position: 'absolute',
        bottom: '40px',
        left: '40px',
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 1000
      }}
    >
      <div
        ref={knobRef}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}

// Mobile Action Buttons
export function MobileButtons({ onJump, onRun, isRunning }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '40px',
      right: '40px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      zIndex: 1000,
      alignItems: 'flex-end'
    }}>
      {/* Large Jump Button */}
      <button
        onTouchStart={() => onJump(true)}
        onTouchEnd={() => onJump(false)}
        onMouseDown={() => onJump(true)}
        onMouseUp={() => onJump(false)}
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: 'rgba(65, 105, 225, 0.7)',
          border: '3px solid rgba(255, 255, 255, 0.7)',
          color: 'black',
          fontSize: '24px',
          fontWeight: 'bold',
          touchAction: 'none',
          userSelect: 'none',
          boxShadow: '0 0 15px rgba(0, 0, 255, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        JUMP
      </button>
      
      {/* Smaller Run Button */}
      <button
        onTouchStart={() => onRun()}
        onMouseDown={() => onRun()}
        style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          backgroundColor: isRunning ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.5)',
          border: isRunning ? '2px solid rgba(0, 255, 0, 0.9)' : '2px solid rgba(255, 255, 255, 0.7)',
          color: isRunning ? 'black' : 'black',
          fontSize: '18px',
          fontWeight: 'bold',
          touchAction: 'none',
          userSelect: 'none',
          boxShadow: isRunning ? '0 0 15px rgba(0, 255, 0, 0.6)' : 'none',
          position: 'absolute',
          right: '0px',
          bottom: '140px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        RUN
      </button>
    </div>
  )
}
