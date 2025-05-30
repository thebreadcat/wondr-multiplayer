import React, { useState, useEffect } from "react";
import { useRaceStore } from "./store";

export default function RaceOverlay() {
  const { 
    isRaceRunning, 
    timeStart, 
    isJoined,
    isCountdownActive,
    countdownStartTime,
    countdownDuration
  } = useRaceStore();
  
  const [now, setNow] = useState(Date.now());
  const [countdownValue, setCountdownValue] = useState(3);

  // Update current time for countdown and timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, []);

  // Calculate countdown value
  useEffect(() => {
    if (!isCountdownActive || !countdownStartTime || !countdownDuration) return;
    
    const elapsed = now - countdownStartTime;
    const remaining = Math.max(0, countdownDuration - elapsed);
    const seconds = Math.ceil(remaining / 1000);
    
    // Only update if value changed to prevent re-renders
    if (seconds !== countdownValue && seconds >= 0 && seconds <= 3) {
      setCountdownValue(seconds);
    }
  }, [now, isCountdownActive, countdownStartTime, countdownDuration, countdownValue]);

  // Race timer when race is running
  if (isRaceRunning && timeStart) {
    const elapsed = now - timeStart;
    const seconds = (elapsed / 1000).toFixed(2);
    
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transformOrigin: '0px 0px',
        zIndex: 16569306,
        width: '100vw',
        height: '100vh',
        right: 0,
        bottom: 0,
        pointerEvents: 'none' // Allow clicking through the timer
      }}>
        <div style={{
          position: 'absolute',
          transform: 'none',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
        }}>
          <div style={{ 
            position: 'fixed', 
            top: 20, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            fontSize: 24, 
            fontWeight: 'bold', 
            color: 'white', 
            textShadow: '2px 2px 4px rgba(0,0,0,0.7)' 
          }}>
            ⏱️ {seconds}s
          </div>
        </div>
      </div>
    );
  }
  
  // Countdown overlay
  if (isCountdownActive && countdownValue >= 0) {
    let text = countdownValue > 0 ? countdownValue : "GO!";
    let color = countdownValue > 0 ? "white" : "#00FF00";
    let size = countdownValue > 0 ? 120 : 150;
    
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transformOrigin: '0px 0px',
        zIndex: 16569306,
        width: '100vw',
        height: '100vh',
        right: 0,
        bottom: 0
      }}>
        <div style={{
          position: 'absolute',
          transform: 'none',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}>
            <div style={{
              fontSize: size,
              fontWeight: 'bold',
              color: color,
              textShadow: '0 0 20px rgba(255,255,255,0.5)'
            }}>
              {text}
            </div>
            {countdownValue > 0 && (
              <div style={{ 
                marginTop: 30, 
                fontSize: 36, 
                color: '#AAFFFF',
                textShadow: '2px 2px 4px rgba(0,0,0,0.7)'
              }}>
                Get ready!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Nothing to show
  return null;
}
