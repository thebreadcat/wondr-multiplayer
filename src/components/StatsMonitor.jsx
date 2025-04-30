// StatsMonitor.jsx - Performance monitoring component
import React, { useEffect, useRef } from 'react';
import Stats from 'stats.js';

export function StatsMonitor() {
  const statsRef = useRef();
  
  useEffect(() => {
    // Create and configure stats.js
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3: custom
    
    // Add to DOM
    document.body.appendChild(stats.dom);
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.left = '0px';
    stats.dom.style.zIndex = '1000';
    
    // Store reference
    statsRef.current = stats;
    
    // Start monitoring
    const animate = () => {
      stats.begin();
      requestAnimationFrame(animate);
      stats.end();
    };
    
    requestAnimationFrame(animate);
    
    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animate);
      if (stats.dom && stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }
    };
  }, []);
  
  // Render nothing - stats.js creates its own DOM elements
  return null;
}
