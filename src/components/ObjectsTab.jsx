import React, { useState, useEffect } from 'react';

const ObjectsTab = () => {
  const [objects, setObjects] = useState([]);
  const [selectedObjectType, setSelectedObjectType] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Get objects from the global ObjectManager
  useEffect(() => {
    const updateObjects = () => {
      if (window.objectManager) {
        setObjects(window.objectManager.objects || []);
      }
    };

    // Initial load
    updateObjects();

    // Poll for updates (since we can't directly subscribe to state changes)
    const interval = setInterval(updateObjects, 500);

    return () => clearInterval(interval);
  }, []);

  const handleAddObject = (objectType) => {
    if (window.objectManager) {
      // Add object at a random position near the player
      const randomX = (Math.random() - 0.5) * 10;
      const randomZ = (Math.random() - 0.5) * 10;
      const position = [randomX, 2, randomZ];
      
      window.objectManager.addObject(objectType, position);
      setShowAddMenu(false);
    }
  };

  const handleDeleteObject = (objectId) => {
    if (window.objectManager) {
      window.objectManager.deleteObject(objectId);
    }
  };

  const handleSelectObject = (objectId) => {
    if (window.objectManager) {
      window.objectManager.selectObject(objectId);
    }
  };

  const OBJECT_TYPES = window.objectManager?.OBJECT_TYPES || [
    { id: 'cube', name: 'Cube', color: '#3498db' },
    { id: 'sphere', name: 'Sphere', color: '#e74c3c' },
    { id: 'cylinder', name: 'Cylinder', color: '#2ecc71' },
    { id: 'cone', name: 'Cone', color: '#f39c12' },
    { id: 'torus', name: 'Torus', color: '#9b59b6' },
    { id: 'plane', name: 'Plane', color: '#95a5a6' }
  ];

  return (
    <div style={{
      padding: '20px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          Room Objects ({objects.length})
        </h2>
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
        >
          + Add Object
        </button>
      </div>

      {/* Add Object Menu */}
      {showAddMenu && (
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '10px',
          padding: '15px',
          marginBottom: '15px'
        }}>
          <h3 style={{
            margin: '0 0 10px 0',
            fontSize: '16px',
            color: '#333'
          }}>
            Choose Object Type:
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '10px'
          }}>
            {OBJECT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleAddObject(type)}
                style={{
                  padding: '10px',
                  backgroundColor: type.color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
                onMouseOver={(e) => e.target.style.opacity = '0.8'}
                onMouseOut={(e) => e.target.style.opacity = '1'}
              >
                {type.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddMenu(false)}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Objects List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {objects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            fontSize: '16px',
            marginTop: '50px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
            <div>No objects in this room</div>
            <div style={{ fontSize: '14px', marginTop: '5px' }}>
              Click "Add Object" to place your first object!
            </div>
          </div>
        ) : (
          objects.map((object) => (
            <div
              key={object.id}
              style={{
                backgroundColor: window.objectManager?.selectedObjectId === object.id ? '#e3f2fd' : 'white',
                border: window.objectManager?.selectedObjectId === object.id ? '2px solid #2196F3' : '1px solid #ddd',
                borderRadius: '10px',
                padding: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => handleSelectObject(object.id)}
              onMouseOver={(e) => {
                if (window.objectManager?.selectedObjectId !== object.id) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseOut={(e) => {
                if (window.objectManager?.selectedObjectId !== object.id) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: object.color,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  {object.type.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: '#333',
                    marginBottom: '2px'
                  }}>
                    {object.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    Position: ({object.position[0].toFixed(1)}, {object.position[1].toFixed(1)}, {object.position[2].toFixed(1)})
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    Scale: ({object.scale[0].toFixed(1)}, {object.scale[1].toFixed(1)}, {object.scale[2].toFixed(1)})
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteObject(object.id);
                }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#d32f2f'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#f44336'}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#e8f5e8',
        border: '1px solid #c8e6c9',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '12px',
        color: '#2e7d32'
      }}>
        <strong>💡 Tips:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Click on an object in the list to select it in the 3D world</li>
          <li>Selected objects appear highlighted in yellow</li>
          <li>Objects are synchronized across all players in the room</li>
        </ul>
      </div>
    </div>
  );
};

export default ObjectsTab; 