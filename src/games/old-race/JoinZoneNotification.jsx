// JoinZoneNotification.jsx - Component to display notifications when players are in the race join zone
import React, { useEffect, useState } from 'react';
import { useRace } from './useRace';
import './raceOverlay.css';

/**
 * Component that displays notifications when players enter or exit the race join zone
 * Provides visual feedback to help players understand when they're in position to join a race
 */
export function JoinZoneNotification() {
  const { 
    raceState, 
    inJoinZone, 
    joinZoneDetected,
    joinZoneStatus 
  } = useRace();
  
  const [notification, setNotification] = useState(null);
  const [notificationType, setNotificationType] = useState('');
  
  // Update notification based on join zone status
  useEffect(() => {
    // Don't show notifications if we're already in countdown or race has started
    if (raceState === 'countdown' || raceState === 'started' || raceState === 'over') {
      setNotification(null);
      return;
    }
    
    // Show notifications based on join zone status
    if (joinZoneStatus) {
      setNotification(joinZoneStatus);
      
      // Set notification type based on status
      if (inJoinZone) {
        setNotificationType('success');
      } else if (joinZoneDetected) {
        setNotificationType('');
      } else {
        setNotificationType('warning');
      }
    } else {
      // Clear notification if no status
      setNotification(null);
    }
  }, [joinZoneStatus, inJoinZone, joinZoneDetected, raceState]);
  
  // Don't render anything if no notification
  if (!notification) return null;
  
  return (
    <div className={`join-zone-notification ${notificationType}`}>
      {notification}
    </div>
  );
}

// Initialize notification system for global access
export function setupNotifications() {
  // Create a global notification system that can be accessed from anywhere
  if (typeof window !== 'undefined' && !window.addNotification) {
    // Track active notifications
    const notifications = [];
    let notificationId = 0;
    
    // Create container for notifications if it doesn't exist
    let container = document.getElementById('race-notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'race-notifications-container';
      container.style.position = 'fixed';
      container.style.bottom = '30px';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.zIndex = '1000';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.gap = '10px';
      document.body.appendChild(container);
    }
    
    // Function to add a notification
    window.addNotification = ({ type = '', message, duration = 3000 }) => {
      const id = `notification-${notificationId++}`;
      
      // Create notification element
      const notification = document.createElement('div');
      notification.id = id;
      notification.className = `join-zone-notification ${type}`;
      notification.textContent = message;
      
      // Add to container
      container.appendChild(notification);
      notifications.push(id);
      
      // Remove after duration
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.style.opacity = '0';
          element.style.transition = 'opacity 0.5s';
          setTimeout(() => {
            if (element && element.parentNode) {
              element.parentNode.removeChild(element);
            }
            // Remove from tracking array
            const index = notifications.indexOf(id);
            if (index > -1) {
              notifications.splice(index, 1);
            }
          }, 500);
        }
      }, duration);
      
      return id;
    };
    
    // Function to remove a notification
    window.removeNotification = (id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.5s';
        setTimeout(() => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
          // Remove from tracking array
          const index = notifications.indexOf(id);
          if (index > -1) {
            notifications.splice(index, 1);
          }
        }, 500);
      }
    };
    
    console.log('[Race] Notification system initialized');
  }
}
