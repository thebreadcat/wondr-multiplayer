import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getSocket } from '../utils/socketManager';
import { useMultiplayer } from './MultiplayerProvider';
import { useCameraStore } from './CameraToggleButton';

// Object types that can be placed
const OBJECT_TYPES = [
  { id: 'cube', name: 'Cube', color: '#3498db' },
  { id: 'sphere', name: 'Sphere', color: '#e74c3c' },
  { id: 'cylinder', name: 'Cylinder', color: '#2ecc71' },
  { id: 'cone', name: 'Cone', color: '#f39c12' },
  { id: 'torus', name: 'Torus', color: '#9b59b6' },
  { id: 'plane', name: 'Plane', color: '#95a5a6' }
];

// Individual object component
const RoomObject = ({ object, onUpdate, onDelete, isSelected, onSelect }) => {
  const meshRef = useRef();
  const { camera, raycaster, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(new THREE.Vector3());

  // Handle click to select object
  const handleClick = useCallback((event) => {
    event.stopPropagation();
    onSelect(object.id);
  }, [object.id, onSelect]);

  // Create geometry based on object type
  const createGeometry = () => {
    switch (object.type) {
      case 'cube':
        return <boxGeometry args={[1, 1, 1]} />;
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'cone':
        return <coneGeometry args={[0.5, 1, 32]} />;
      case 'torus':
        return <torusGeometry args={[0.5, 0.2, 16, 100]} />;
      case 'plane':
        return <planeGeometry args={[1, 1]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={handleClick}
      userData={{ type: 'room-object', id: object.id }}
    >
      {createGeometry()}
      <meshStandardMaterial 
        color={isSelected ? '#ffff00' : object.color} 
        transparent={isSelected}
        opacity={isSelected ? 0.8 : 1}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[meshRef.current?.geometry]} />
          <lineBasicMaterial color="#ffff00" />
        </lineSegments>
      )}
    </mesh>
  );
};

const ObjectManager = ({ roomId = 'main-room' }) => {
  const [objects, setObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const { isEditMode } = useCameraStore();
  const socketRef = useRef();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socketRef.current = socket;

    // Listen for object events
    const handleObjectAdded = (objectData) => {
      console.log('[ObjectManager] Object added:', objectData);
      // Check if object already exists to prevent duplicates
      setObjects(prev => {
        const exists = prev.some(obj => obj.id === objectData.id);
        if (exists) {
          console.log('[ObjectManager] Object already exists, skipping duplicate:', objectData.id);
          return prev; // Don't add if it already exists
        }
        return [...prev, objectData];
      });
    };

    const handleObjectUpdated = (updateData) => {
      console.log('[ObjectManager] Object updated:', updateData);
      setObjects(prev => {
        const objectExists = prev.some(obj => obj.id === updateData.objectId);
        if (!objectExists) {
          console.log('[ObjectManager] Object to update not found:', updateData.objectId);
          return prev; // Don't update if object doesn't exist
        }
        return prev.map(obj => 
          obj.id === updateData.objectId 
            ? { ...obj, ...updateData.updates }
            : obj
        );
      });
    };

    const handleObjectDeleted = (deleteData) => {
      console.log('[ObjectManager] Object deleted:', deleteData);
      setObjects(prev => {
        const objectExists = prev.some(obj => obj.id === deleteData.objectId);
        if (!objectExists) {
          console.log('[ObjectManager] Object to delete not found:', deleteData.objectId);
          return prev; // Don't try to delete if object doesn't exist
        }
        return prev.filter(obj => obj.id !== deleteData.objectId);
      });
      // Clear selection if the deleted object was selected
      if (selectedObjectId === deleteData.objectId) {
        setSelectedObjectId(null);
      }
    };

    const handleObjectsSync = (roomObjects) => {
      console.log('[ObjectManager] Objects sync for room:', roomId, roomObjects);
      setObjects(roomObjects);
    };

    // Register event listeners
    socket.on('object-added', handleObjectAdded);
    socket.on('object-updated', handleObjectUpdated);
    socket.on('object-deleted', handleObjectDeleted);
    socket.on('objects-sync', handleObjectsSync);

    // Request objects for current room
    socket.emit('request-objects', { roomId });

    return () => {
      socket.off('object-added', handleObjectAdded);
      socket.off('object-updated', handleObjectUpdated);
      socket.off('object-deleted', handleObjectDeleted);
      socket.off('objects-sync', handleObjectsSync);
    };
  }, [roomId, selectedObjectId]);

  // Add new object
  const addObject = useCallback((objectType, position = [0, 1, 0]) => {
    const newObject = {
      id: `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: objectType.id,
      name: objectType.name,
      position: position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: objectType.color,
      roomId: roomId,
      createdAt: Date.now()
    };

    // Only emit to server - let server confirmation add it to the scene
    // This prevents duplication issues entirely
    if (socketRef.current) {
      socketRef.current.emit('add-object', newObject);
    }

    return newObject.id;
  }, [roomId]);

  // Update object
  const updateObject = useCallback((objectId, updates) => {
    // Only emit to server - let server confirmation update the scene
    // This prevents inconsistency issues
    if (socketRef.current) {
      socketRef.current.emit('update-object', {
        objectId,
        updates,
        roomId
      });
    }
  }, [roomId]);

  // Delete object
  const deleteObject = useCallback((objectId) => {
    // Only emit to server - let server confirmation remove from scene
    // This prevents inconsistency issues
    if (socketRef.current) {
      socketRef.current.emit('delete-object', {
        objectId,
        roomId
      });
    }
  }, [roomId]);

  // Select object
  const selectObject = useCallback((objectId) => {
    setSelectedObjectId(objectId);
  }, []);

  // Expose methods for external use
  useEffect(() => {
    window.objectManager = {
      addObject,
      updateObject,
      deleteObject,
      selectObject,
      objects,
      selectedObjectId,
      isEditMode,
      OBJECT_TYPES
    };

    return () => {
      delete window.objectManager;
    };
  }, [addObject, updateObject, deleteObject, selectObject, objects, selectedObjectId, isEditMode]);

  return (
    <group name="room-objects">
      {objects.map((object) => (
        <RoomObject
          key={object.id}
          object={object}
          onUpdate={updateObject}
          onDelete={deleteObject}
          isSelected={selectedObjectId === object.id}
          onSelect={selectObject}
        />
      ))}
    </group>
  );
};

export default ObjectManager; 