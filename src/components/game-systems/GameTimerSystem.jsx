/**
 * GameTimerSystem.jsx
 * Reusable component for game timers (countdowns, game duration, cooldowns)
 */
import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../utils/socketManager';

const GameTimerSystem = ({
  gameType,
  roomId,
  initialTime = 60, // Default 60 seconds
  autoStart = false,
  timerType = 'countdown', // 'countdown', 'stopwatch', 'cooldown'
  onTimerStart,
  onTimerEnd,
  onTimerTick,
  children,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const socket = getSocket();

  // Start the timer
  const startTimer = () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setIsComplete(false);
    startTimeRef.current = Date.now();
    
    // Call the onTimerStart callback if provided
    if (onTimerStart) {
      onTimerStart(timeRemaining, gameType, roomId);
    }
    
    // Emit timer event if socket is available
    if (socket) {
      socket.emit('gameTimerStarted', { 
        gameType, 
        roomId, 
        duration: timeRemaining,
        timerType
      });
    }
  };

  // Stop the timer
  const stopTimer = () => {
    if (!isRunning) return;
    
    setIsRunning(false);
    
    // Emit timer event if socket is available
    if (socket) {
      socket.emit('gameTimerStopped', { 
        gameType, 
        roomId,
        timeRemaining,
        timerType
      });
    }
  };

  // Reset the timer
  const resetTimer = () => {
    stopTimer();
    setTimeRemaining(initialTime);
    setIsComplete(false);
    startTimeRef.current = null;
  };

  // Handle socket events for timer synchronization
  useEffect(() => {
    if (!socket || !gameType || !roomId) return;

    // Handle timer start event from server
    const handleTimerStart = (data) => {
      if (data.gameType === gameType && data.roomId === roomId) {
        setTimeRemaining(data.duration || initialTime);
        setIsRunning(true);
        setIsComplete(false);
        startTimeRef.current = Date.now();
      }
    };

    // Handle timer stop event from server
    const handleTimerStop = (data) => {
      if (data.gameType === gameType && data.roomId === roomId) {
        setIsRunning(false);
        if (data.timeRemaining !== undefined) {
          setTimeRemaining(data.timeRemaining);
        }
      }
    };

    // Subscribe to events
    socket.on('gameTimerStarted', handleTimerStart);
    socket.on('gameTimerStopped', handleTimerStop);

    // Cleanup
    return () => {
      socket.off('gameTimerStarted', handleTimerStart);
      socket.off('gameTimerStopped', handleTimerStop);
    };
  }, [socket, gameType, roomId, initialTime]);

  // Timer tick effect
  useEffect(() => {
    if (!isRunning || isComplete) return;

    const tickTimer = () => {
      if (timerType === 'countdown') {
        // Countdown timer (counts down to zero)
        setTimeRemaining((prev) => {
          const newTime = Math.max(0, prev - 1);
          
          // Call onTimerTick callback if provided
          if (onTimerTick) {
            onTimerTick(newTime, gameType, roomId);
          }
          
          // Check if timer is complete
          if (newTime === 0 && !isComplete) {
            setIsComplete(true);
            setIsRunning(false);
            
            // Call onTimerEnd callback if provided
            if (onTimerEnd) {
              onTimerEnd(gameType, roomId);
            }
            
            // Emit timer event if socket is available
            if (socket) {
              socket.emit('gameTimerEnded', { 
                gameType, 
                roomId,
                timerType
              });
            }
          }
          
          return newTime;
        });
      } else if (timerType === 'stopwatch') {
        // Stopwatch timer (counts up from zero)
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setTimeRemaining(elapsed);
        
        // Call onTimerTick callback if provided
        if (onTimerTick) {
          onTimerTick(elapsed, gameType, roomId);
        }
      } else if (timerType === 'cooldown') {
        // Cooldown timer (counts down to zero)
        setTimeRemaining((prev) => {
          const newTime = Math.max(0, prev - 1);
          
          // Call onTimerTick callback if provided
          if (onTimerTick) {
            onTimerTick(newTime, gameType, roomId);
          }
          
          // Check if timer is complete
          if (newTime === 0 && !isComplete) {
            setIsComplete(true);
            setIsRunning(false);
            
            // Call onTimerEnd callback if provided
            if (onTimerEnd) {
              onTimerEnd(gameType, roomId);
            }
          }
          
          return newTime;
        });
      }
    };

    // Set up interval for timer
    timerRef.current = setInterval(tickTimer, 1000);

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, isComplete, timerType, gameType, roomId, onTimerTick, onTimerEnd, socket]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return children({
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isRunning,
    isComplete,
    startTimer,
    stopTimer,
    resetTimer,
  });
};

export default GameTimerSystem;
