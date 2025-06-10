import React, { useState, useMemo } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

const AddObjectModal = ({ isOpen, onClose, onAddObject, playerPosition }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Get object types from window.objectManager if available
  const objectTypes = window.objectManager?.OBJECT_TYPES || [
    { id: 'cube', name: 'Cube', color: '#3498db', icon: '🧊' },
    { id: 'sphere', name: 'Sphere', color: '#e74c3c', icon: '⚽' },
    { id: 'cylinder', name: 'Cylinder', color: '#2ecc71', icon: '🥫' },
    { id: 'cone', name: 'Cone', color: '#f39c12', icon: '🔺' },
    { id: 'torus', name: 'Torus', color: '#9b59b6', icon: '🍩' },
    { id: 'plane', name: 'Plane', color: '#95a5a6', icon: '📄' }
  ];

  // Filter object types based on search term
  const filteredObjectTypes = useMemo(() => {
    if (!searchTerm) return objectTypes;
    return objectTypes.filter(type => 
      type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [objectTypes, searchTerm]);

  const handleAddObject = (objectType) => {
    if (onAddObject && playerPosition) {
      // Position is now calculated in EditModeManager to place objects in front of player
      onAddObject(objectType);
      onClose();
      setSearchTerm(''); // Clear search when closing
    }
  };

  const handleClose = () => {
    onClose();
    setSearchTerm(''); // Clear search when closing
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(5px)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(0, 0, 0, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.05)'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            Add New Object
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '8px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <FaSearch style={{
              position: 'absolute',
              left: '12px',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '16px'
            }} />
            <input
              type="text"
              placeholder="Search object types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
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

        {/* Object Types Grid */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {filteredObjectTypes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '16px'
            }}>
              No object types match your search
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '15px'
            }}>
              {filteredObjectTypes.map((objectType) => (
                <button
                  key={objectType.id}
                  onClick={() => handleAddObject(objectType)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    minHeight: '120px',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.borderColor = objectType.color;
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = `0 8px 25px rgba(0, 0, 0, 0.3)`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {/* Object Icon/Preview */}
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    background: objectType.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }}>
                    {objectType.icon || '📦'}
                  </div>
                  
                  {/* Object Name */}
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}>
                    {objectType.name}
                  </div>
                  
                  {/* Object Type ID */}
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    textAlign: 'center'
                  }}>
                    {objectType.id}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.05)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '8px'
          }}>
            Objects will be placed in front of you
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.4)'
          }}>
            Position: ({playerPosition?.[0]?.toFixed(1) || 0}, {playerPosition?.[1]?.toFixed(1) || 0}, {playerPosition?.[2]?.toFixed(1) || 0})
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddObjectModal; 