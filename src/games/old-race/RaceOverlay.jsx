// RaceOverlay.jsx - Provides UI overlays for race countdown and timer
import React, { useEffect, useState } from "react";
import { useRace } from "./useRace";
import "./raceOverlay.css";

// Joined Overlay Component - Shows when player has just joined the race
export function JoinedOverlay() {
  const { raceState, inJoinZone } = useRace();
  
  // Show during joined state OR when player is in the join zone
  if (raceState !== "joined" && !(inJoinZone && raceState === "joinable")) return null;
  
  return (
    <div className="race-overlay">
      <div className="race-message">{raceState === "joined" ? "Joined Race" : "In Starting Zone"}</div>
      <div className="countdown-message">{raceState === "joined" ? "Countdown Starting..." : "Stay in the blue circle to join race"}</div>
    </div>
  );
}

// Countdown Overlay Component
export function CountdownOverlay() {
  const { raceState, countdown } = useRace();
  
  // Only show during countdown state
  if (raceState !== "countdown") return null;
  
  return (
    <div className="race-overlay">
      <div className="race-message">Race Starting In</div>
      <div className="countdown-number">{countdown}</div>
      <div className="race-message">Get Ready!</div>
    </div>
  );
}

// Race Timer Component - Shows during the race
export function RaceTimer() {
  const { raceState, raceTime } = useRace();
  const [displayTime, setDisplayTime] = useState("00:00.000");
  
  useEffect(() => {
    if (raceState === "started") {
      const formatTime = (time) => {
        const minutes = Math.floor(time / 60).toString().padStart(2, '0');
        const seconds = Math.floor(time % 60).toString().padStart(2, '0');
        const milliseconds = Math.floor((time % 1) * 1000).toString().padStart(3, '0');
        return `${minutes}:${seconds}.${milliseconds}`;
      };
      
      setDisplayTime(formatTime(raceTime));
    }
  }, [raceTime, raceState]);
  
  // Only show during started state (previously running)
  if (raceState !== "started") return null;
  
  return (
    <div className="timer-display">
      {displayTime}
    </div>
  );
}

// Race Completion Overlay
export function RaceCompletionOverlay() {
  const { raceState, raceTime, resetRace } = useRace();
  
  // Only show in OVER state (previously finished)
  if (raceState !== "over") return null;
  
  // Format race time in a readable format
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleRestart = () => {
    resetRace();
  };
  
  return (
    <div className="race-overlay">
      <div className="race-message">Race Complete!</div>
      <div className="time-result">Your Time: {formatTime(raceTime)}</div>
      <button className="restart-button" onClick={handleRestart}>
        Race Again
      </button>
    </div>
  );
}

// Export a single component that includes all overlays
export function RaceOverlays() {
  return (
    <>
      <JoinedOverlay />
      <CountdownOverlay />
      <RaceTimer />
      <RaceCompletionOverlay />
    </>
  );
}
