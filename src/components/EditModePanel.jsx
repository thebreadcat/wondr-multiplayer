import React, { useState, useMemo } from 'react';
import { useCameraStore } from './CameraToggleButton';
import { FaSearch, FaTrash, FaEye, FaEyeSlash, FaTimes, FaArrowsAlt, FaSyncAlt, FaExpandArrowsAlt, FaCheck, FaUndo } from 'react-icons/fa';

const EditModePanel = () => {
  const { isEditMode, toggleEditMode } = useCameraStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [objects, setObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [transformMode, setTransformMode] = useState('translate');
  const [isTransforming, setIsTransforming] = useState(false);
  const [originalTransform, setOriginalTransform] = useState(null);

  // Get objects from window.objectManager if available
  React.useEffect(() => {
    const updateObjects = () => {
      if (window.objectManager) {
        setObjects(window.objectManager.objects || []);
        setSelectedObjectId(window.objectManager.selectedObjectId);
        setTransformMode(window.objectManager.transformMode || 'translate');
        setIsTransforming(window.objectManager.isTransforming || false);
        setOriginalTransform(window.objectManager.originalTransform);
      }
    };

    // Update immediately
    updateObjects();

    // Set up interval to keep objects in sync
    const interval = setInterval(updateObjects, 100);
    return () => clearInterval(interval);
  }, []);

  // Filter objects based on search term
  const filteredObjects = useMemo(() => {
    if (!searchTerm) return objects;
    return objects.filter(obj => 
      obj.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obj.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obj.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [objects, searchTerm]);

  const handleSelectObject = (objectId) => {
    if (window.objectManager) {
      window.objectManager.selectObject(objectId);
    }
  };

  const handleDeleteObject = (objectId, event) => {
    event.stopPropagation();
    if (window.objectManager && window.confirm('Are you sure you want to delete this object?')) {
      window.objectManager.deleteObject(objectId);
    }
  };

  const handleTransformModeChange = (mode) => {
    if (window.objectManager && window.objectManager.setTransformMode) {
      window.objectManager.setTransformMode(mode);
    }
  };

  const handleConfirmTransform = () => {
    if (window.objectManager && window.objectManager.confirmTransform) {
      window.objectManager.confirmTransform();
    }
  };

  const handleCancelTransform = () => {
    if (window.objectManager && window.objectManager.cancelTransform) {
      window.objectManager.cancelTransform();
    }
  };

  // Get selected object data
  const selectedObject = selectedObjectId ? objects.find(obj => obj.id === selectedObjectId) : null;
  const hasPendingChanges = originalTransform !== null;

  if (!isEditMode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '320px',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRight: 'none',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={toggleEditMode}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '8px',
            cursor: 'pointer',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Close Edit Mode"
        >
          <FaTimes size={14} />
        </button>
        
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
          paddingRight: '40px' // Make room for close button
        }}>
          Scene Objects ({objects.length})
        </h3>
        
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <FaSearch style={{
            position: 'absolute',
            left: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px'
          }} />
          <input
            type="text"
            placeholder="Search objects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 35px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.15)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }}
            onBlur={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          />
        </div>
      </div>

      {/* Transform Controls Panel */}
      {selectedObject && (
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: hasPendingChanges 
            ? 'rgba(255, 193, 7, 0.1)' 
            : 'rgba(74, 144, 226, 0.1)'
        }}>
          <h4 style={{
            margin: '0 0 15px 0',
            fontSize: '16px',
            fontWeight: 'bold',
            color: hasPendingChanges ? '#ffc107' : '#4a90e2'
          }}>
            Transform: {selectedObject.name}
            {hasPendingChanges && (
              <span style={{
                fontSize: '12px',
                color: '#ffc107',
                marginLeft: '8px'
              }}>
                (Unsaved Changes)
              </span>
            )}
          </h4>
          
          {/* Transform Mode Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '15px'
          }}>
            {[
              { mode: 'translate', icon: FaArrowsAlt, label: 'Move' },
              { mode: 'rotate', icon: FaSyncAlt, label: 'Rotate' },
              { mode: 'scale', icon: FaExpandArrowsAlt, label: 'Scale' }
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => handleTransformModeChange(mode)}
                disabled={hasPendingChanges}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: transformMode === mode 
                    ? 'rgba(74, 144, 226, 0.3)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  border: transformMode === mode 
                    ? '1px solid rgba(74, 144, 226, 0.6)' 
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: hasPendingChanges ? 'rgba(255, 255, 255, 0.5)' : 'white',
                  cursor: hasPendingChanges ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  transition: 'all 0.2s ease',
                  opacity: hasPendingChanges ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (transformMode !== mode && !hasPendingChanges) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (transformMode !== mode && !hasPendingChanges) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Confirm/Cancel Buttons */}
          {hasPendingChanges && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '15px'
            }}>
              <button
                onClick={handleConfirmTransform}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'rgba(46, 204, 113, 0.2)',
                  border: '1px solid rgba(46, 204, 113, 0.4)',
                  borderRadius: '6px',
                  color: '#2ecc71',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(46, 204, 113, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(46, 204, 113, 0.2)';
                }}
              >
                <FaCheck size={14} />
                Confirm
              </button>
              <button
                onClick={handleCancelTransform}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'rgba(231, 76, 60, 0.2)',
                  border: '1px solid rgba(231, 76, 60, 0.4)',
                  borderRadius: '6px',
                  color: '#e74c3c',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(231, 76, 60, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(231, 76, 60, 0.2)';
                }}
              >
                <FaUndo size={14} />
                Cancel
              </button>
            </div>
          )}
          
          {/* Transform Values */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '10px',
            fontSize: '11px'
          }}>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '4px' }}>Position</div>
              <div style={{ color: '#fff' }}>
                X: {selectedObject.position?.[0]?.toFixed(2) || 0}<br/>
                Y: {selectedObject.position?.[1]?.toFixed(2) || 0}<br/>
                Z: {selectedObject.position?.[2]?.toFixed(2) || 0}
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '4px' }}>Rotation</div>
              <div style={{ color: '#fff' }}>
                X: {((selectedObject.rotation?.[0] || 0) * 180 / Math.PI).toFixed(1)}°<br/>
                Y: {((selectedObject.rotation?.[1] || 0) * 180 / Math.PI).toFixed(1)}°<br/>
                Z: {((selectedObject.rotation?.[2] || 0) * 180 / Math.PI).toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '4px' }}>Scale</div>
              <div style={{ color: '#fff' }}>
                X: {selectedObject.scale?.[0]?.toFixed(2) || 1}<br/>
                Y: {selectedObject.scale?.[1]?.toFixed(2) || 1}<br/>
                Z: {selectedObject.scale?.[2]?.toFixed(2) || 1}
              </div>
            </div>
          </div>
          
          {isTransforming && (
            <div style={{
              marginTop: '10px',
              padding: '8px',
              background: 'rgba(46, 204, 113, 0.2)',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#2ecc71',
              textAlign: 'center'
            }}>
              🎯 Transforming object...
            </div>
          )}

          {hasPendingChanges && !isTransforming && (
            <div style={{
              marginTop: '10px',
              padding: '8px',
              background: 'rgba(255, 193, 7, 0.2)',
              border: '1px solid rgba(255, 193, 7, 0.4)',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#ffc107',
              textAlign: 'center'
            }}>
              ⚠️ You have unsaved changes. Confirm or cancel to continue.
            </div>
          )}
        </div>
      )}

      {/* Objects List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px'
      }}>
        {filteredObjects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '14px'
          }}>
            {objects.length === 0 ? 'No objects in scene' : 'No objects match your search'}
          </div>
        ) : (
          filteredObjects.map((obj) => (
            <div
              key={obj.id}
              onClick={() => handleSelectObject(obj.id)}
              style={{
                padding: '12px',
                margin: '5px 0',
                background: selectedObjectId === obj.id 
                  ? 'rgba(74, 144, 226, 0.3)' 
                  : 'rgba(255, 255, 255, 0.05)',
                border: selectedObjectId === obj.id 
                  ? '1px solid rgba(74, 144, 226, 0.6)' 
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                if (selectedObjectId !== obj.id) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedObjectId !== obj.id) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  color: '#fff'
                }}>
                  {obj.name || obj.type}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '4px'
                }}>
                  Type: {obj.type}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  Position: ({obj.position?.[0]?.toFixed(1) || 0}, {obj.position?.[1]?.toFixed(1) || 0}, {obj.position?.[2]?.toFixed(1) || 0})
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                {/* Color indicator */}
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: obj.color || '#666',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }} />
                
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteObject(obj.id, e)}
                  style={{
                    background: 'rgba(231, 76, 60, 0.2)',
                    border: '1px solid rgba(231, 76, 60, 0.4)',
                    borderRadius: '4px',
                    padding: '6px',
                    cursor: 'pointer',
                    color: '#e74c3c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(231, 76, 60, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(231, 76, 60, 0.2)';
                  }}
                  title="Delete object"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '15px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center'
      }}>
        Click objects to select • Use + button to add new objects
        {selectedObject && (
          <>
            <br />
            🎯 Use gizmos to transform selected object • Changes sync to all players
          </>
        )}
      </div>
    </div>
  );
};

export default EditModePanel; 