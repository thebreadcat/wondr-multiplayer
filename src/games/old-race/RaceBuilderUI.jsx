// RaceBuilderUI.jsx - UI controls for race building
import React from 'react';
import { useRace } from './useRace';

export default function RaceBuilderUI() {
  const {
    raceState,
    startRace,
    cancelRace,
    placeStart,
    addCheckpoint,
    undoCheckpoint,
    completeRace,
    startLine,
    checkpoints,
    raceTime,
    resetRace
  } = useRace();

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Create a basic UI interface for now
  
  // Prevent keyboard events from affecting the panel
  React.useEffect(() => {
    // Function to handle keyboard events
    const handleKeyDown = (e) => {
      // Prevent spacebar from closing the panel
      if (e.code === 'Space' && document.activeElement.tagName !== 'BUTTON') {
        // Don't prevent default as we still want jumping to work
        // But stop propagation to prevent panel interactions
        e.stopPropagation();
      }
    };
    
    // Add listener to the document
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  return (
    <div 
      id="race-builder-ui"
      style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '200px'
    }}>
      <div 
      id="race-builder-ui"
      style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>Race Builder</div>
      
      {/* Idle state - Show Start Building button */}
      {raceState === "idle" && (
        <button 
          onClick={(e) => {
            e.preventDefault(); // Prevent default button behavior
            startRace();
            // Return focus to document body to ensure movement keeps working
            document.body.focus();
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent focus change on mousedown
          style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Start Building Race
        </button>
      )}
      
      {/* Building state - Show race construction controls */}
      {raceState === "building" && (
        <>
          <div 
      id="race-builder-ui"
      style={{ marginBottom: '8px' }}>
            <strong>Building Mode</strong>
            <div>Start Line: {startLine ? '✅' : '❌'}</div>
            <div>Checkpoints: {checkpoints.length}</div>
          </div>
          
          <div 
      id="race-builder-ui"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!startLine && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  placeStart();
                  document.body.focus();
                }}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Place Start Line
              </button>
            )}
            
            {startLine && (
              <>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    addCheckpoint();
                    document.body.focus();
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Add Checkpoint
                </button>
                
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    undoCheckpoint();
                    document.body.focus();
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={checkpoints.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: checkpoints.length === 0 ? '#cccccc' : '#F44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: checkpoints.length === 0 ? 'default' : 'pointer',
                    opacity: checkpoints.length === 0 ? 0.7 : 1
                  }}
                >
                  Undo Last Checkpoint
                </button>
                
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    completeRace();
                    document.body.focus();
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={checkpoints.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: checkpoints.length === 0 ? '#cccccc' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: checkpoints.length === 0 ? 'default' : 'pointer',
                    opacity: checkpoints.length === 0 ? 0.7 : 1
                  }}
                >
                  Complete Race
                </button>
              </>
            )}
            
            <button 
              onClick={(e) => {
                e.preventDefault();
                cancelRace();
                document.body.focus();
              }}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#9E9E9E',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
      
      {/* Ready state - Show information about the created race */}
      {raceState === "ready" && (
        <>
          <div>
            <strong>Race Ready!</strong>
            <p>Wait for players to join at the start line.</p>
          </div>
          <button 
            onClick={resetRace}
            style={{
              padding: '8px 16px',
              backgroundColor: '#9E9E9E',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </>
      )}
      
      {/* Running state - Show race in progress information */}
      {raceState === "running" && (
        <div>
          <strong>Race in Progress</strong>
          <div 
      id="race-builder-ui"
      style={{ fontSize: '24px', fontWeight: 'bold', margin: '8px 0' }}>
            {formatTime(raceTime)}
          </div>
          <div>
            Checkpoints: {checkpoints.filter(cp => cp.passed).length}/{checkpoints.length}
          </div>
        </div>
      )}
      
      {/* Finished state - Show race results */}
      {raceState === "finished" && (
        <>
          <div>
            <strong>Race Complete!</strong>
            <div 
      id="race-builder-ui"
      style={{ fontSize: '24px', fontWeight: 'bold', margin: '8px 0' }}>
              Final Time: {formatTime(raceTime)}
            </div>
          </div>
          <button 
            onClick={resetRace}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            New Race
          </button>
        </>
      )}
    </div>
  );
}
