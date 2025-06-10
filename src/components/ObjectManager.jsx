import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';
import { TransformControls } from '@react-three/drei';
import { getSocket } from '../utils/socketManager';
import { useMultiplayer } from './MultiplayerProvider';
import { useCameraStore } from './CameraToggleButton';
import { Tree } from './models/Tree';
import JumpPad from './JumpPad';

// Object types that can be placed
const OBJECT_TYPES = [
  { id: 'cube', name: 'Cube', color: '#3498db', icon: '🧊' },
  { id: 'sphere', name: 'Sphere', color: '#e74c3c', icon: '⚽' },
  { id: 'cylinder', name: 'Cylinder', color: '#2ecc71', icon: '🥫' },
  { id: 'cone', name: 'Cone', color: '#f39c12', icon: '🔺' },
  { id: 'torus', name: 'Torus', color: '#9b59b6', icon: '🍩' },
  { id: 'plane', name: 'Plane', color: '#95a5a6', icon: '📄' },
  { id: 'tree', name: 'Tree', color: '#27ae60', icon: '🌴' },
  { id: 'jumppad', name: 'Jump Pad', color: '#ff6b6b', icon: '🚀' }
];

// Individual object component
const RoomObject = React.forwardRef(({ object, onUpdate, onDelete, isSelected, onSelect, myId, isEditMode }, ref) => {
  const meshRef = useRef();
  const groupRef = useRef();
  const { camera, raycaster, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(new THREE.Vector3());

  // Expose the appropriate ref to parent
  React.useImperativeHandle(ref, () => {
    if (object.type === 'tree' || object.type === 'jumppad') {
      return groupRef.current;
    }
    return meshRef.current;
  }, [object.type]);

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
      case 'jumppad':
        return <cylinderGeometry args={[0.8, 0.8, 0.1, 16]} />;
      case 'tree':
        return null; // Tree component handles its own geometry
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  // Special handling for tree objects
  if (object.type === 'tree') {
    const treeContent = (
      <group
        ref={groupRef}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        onClick={handleClick}
        userData={{ type: 'room-object', id: object.id }}
      >
        <Tree 
          scale={[1, 1, 1]}
          userData={{ type: 'room-object', id: object.id }}
        />
        {isSelected && (
          <mesh>
            <boxGeometry args={[225, 450, 225]} />
            <meshBasicMaterial color="#ffff00" wireframe transparent opacity={0.3} />
          </mesh>
        )}
      </group>
    );

    // Only add physics when not in edit mode
    if (isEditMode) {
      return treeContent;
    } else {
      // Scale the collider args by the object's scale
      const scaleX = object.scale[0] || 1;
      const scaleY = object.scale[1] || 1;
      const scaleZ = object.scale[2] || 1;
      const colliderArgs = [112.5 * scaleX, 225 * scaleY, 112.5 * scaleZ];
      
      return (
        <RigidBody type="fixed" colliders="cuboid" args={colliderArgs} position={object.position} rotation={object.rotation}>
          <group
            ref={groupRef}
            scale={object.scale}
            onClick={handleClick}
            userData={{ type: 'room-object', id: object.id }}
          >
            <Tree 
              scale={[1, 1, 1]}
              userData={{ type: 'room-object', id: object.id }}
            />
            {isSelected && (
              <mesh>
                <boxGeometry args={[225, 450, 225]} />
                <meshBasicMaterial color="#ffff00" wireframe transparent opacity={0.3} />
              </mesh>
            )}
          </group>
        </RigidBody>
      );
    }
  }

  // Special handling for jump pad objects
  if (object.type === 'jumppad') {
    return (
      <group 
        ref={groupRef}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        onClick={handleClick}
        userData={{ type: 'room-object', id: object.id }}
      >
        <JumpPad 
          position={[0, 0, 0]} // Position relative to group
          mini={true}
          baseForce={{ x: 0, y: 12, z: 0 }} // Strong upward force
          directionMultiplier={2}
          radius={1.2}
        />
        {isSelected && (
          <mesh 
            position={[0, 0.5, 0]} // Position relative to group
            userData={{ type: 'room-object', id: object.id, jumpPad: true }}
          >
            <cylinderGeometry args={[1.5, 1.5, 0.1, 16]} />
            <meshBasicMaterial color="#ffff00" wireframe transparent opacity={0.3} />
          </mesh>
        )}
      </group>
    );
  }

  // Regular mesh objects
  const meshContent = (
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

  // Only add physics when not in edit mode
  if (isEditMode) {
    return meshContent;
  } else {
    // Use default hull collider for regular objects
    return (
      <RigidBody type="fixed" colliders="hull">
        {meshContent}
      </RigidBody>
    );
  }
});

const ObjectManager = ({ roomId = 'main-room' }) => {
  const [objects, setObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const { isEditMode } = useCameraStore();
  const { myId } = useMultiplayer();
  const socketRef = useRef();
  const updateTimeoutRef = useRef();
  
  // Transform controls state
  const [transformMode, setTransformMode] = useState('translate');
  const [isTransforming, setIsTransforming] = useState(false);
  const [originalTransform, setOriginalTransform] = useState(null);
  const [originalScaleRatio, setOriginalScaleRatio] = useState(null);
  const transformControlsRef = useRef();
  const selectedObjectRef = useRef();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socketRef.current = socket;

    // Listen for object events with debouncing
    const handleObjectAdded = (objectData) => {
      console.log('[ObjectManager] Object added:', objectData);
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Debounce rapid additions
      updateTimeoutRef.current = setTimeout(() => {
        setObjects(prev => {
          const exists = prev.some(obj => obj.id === objectData.id);
          if (exists) {
            console.log('[ObjectManager] Object already exists, skipping duplicate:', objectData.id);
            return prev;
          }
          return [...prev, objectData];
        });
      }, 50); // 50ms debounce
    };

    const handleObjectUpdated = (updateData) => {
      console.log('[ObjectManager] Object updated:', updateData);
      setObjects(prev => {
        const objectExists = prev.some(obj => obj.id === updateData.objectId);
        if (!objectExists) {
          console.log('[ObjectManager] Object to update not found:', updateData.objectId);
          return prev;
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
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Debounce rapid deletions
      updateTimeoutRef.current = setTimeout(() => {
        setObjects(prev => {
          const objectExists = prev.some(obj => obj.id === deleteData.objectId);
          if (!objectExists) {
            console.log('[ObjectManager] Object to delete not found:', deleteData.objectId);
            return prev;
          }
          return prev.filter(obj => obj.id !== deleteData.objectId);
        });
        
        // Clear selection if the deleted object was selected
        if (selectedObjectId === deleteData.objectId) {
          setSelectedObjectId(null);
        }
      }, 50); // 50ms debounce
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
      if (socket) {
        socket.off('object-added', handleObjectAdded);
        socket.off('object-updated', handleObjectUpdated);
        socket.off('object-deleted', handleObjectDeleted);
        socket.off('objects-sync', handleObjectsSync);
      }
      
      // Clear any pending timeout to prevent memory leaks
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [roomId, selectedObjectId]);

  // Add new object (simplified without collider type)
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

  // Clear selection when edit mode is turned off
  useEffect(() => {
    if (!isEditMode) {
      setSelectedObjectId(null);
    }
  }, [isEditMode]);

  // Handle transform changes
  const handleTransformChange = useCallback(() => {
    if (!selectedObjectRef.current || !selectedObjectId || !isTransforming) return;
    
    const object = selectedObjectRef.current;
    
    // For scale mode, maintain uniform scaling
    if (transformMode === 'scale' && originalScaleRatio) {
      // Get the maximum scale change from any axis
      const scaleX = object.scale.x / originalScaleRatio.x;
      const scaleY = object.scale.y / originalScaleRatio.y;
      const scaleZ = object.scale.z / originalScaleRatio.z;
      
      // Use the largest scale change and apply it uniformly
      const uniformScale = Math.max(scaleX, scaleY, scaleZ);
      
      // Apply uniform scale while maintaining original ratios
      object.scale.set(
        originalScaleRatio.x * uniformScale,
        originalScaleRatio.y * uniformScale,
        originalScaleRatio.z * uniformScale
      );
    }
    
    const updates = {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z]
    };
    
    // Update local state immediately for responsiveness (but don't emit to server yet)
    setObjects(prev => prev.map(obj => 
      obj.id === selectedObjectId 
        ? { ...obj, ...updates }
        : obj
    ));
  }, [selectedObjectId, isTransforming, transformMode, originalScaleRatio]);

  const handleTransformStart = useCallback(() => {
    setIsTransforming(true);
    
    // Store original transform for cancel functionality
    if (selectedObjectRef.current) {
      const object = selectedObjectRef.current;
      setOriginalTransform({
        position: [object.position.x, object.position.y, object.position.z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: [object.scale.x, object.scale.y, object.scale.z]
      });
      
      // Store original scale ratios for uniform scaling
      setOriginalScaleRatio({
        x: object.scale.x,
        y: object.scale.y,
        z: object.scale.z
      });
    }
  }, []);

  const handleTransformEnd = useCallback(() => {
    // Don't automatically save - wait for user confirmation
    setIsTransforming(false);
    setOriginalScaleRatio(null);
  }, []);

  // Confirm transform changes
  const confirmTransform = useCallback(() => {
    if (selectedObjectRef.current && selectedObjectId) {
      const object = selectedObjectRef.current;
      const updates = {
        position: [object.position.x, object.position.y, object.position.z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: [object.scale.x, object.scale.y, object.scale.z]
      };
      
      // Emit to server to save changes
      updateObject(selectedObjectId, updates);
      setOriginalTransform(null);
    }
  }, [selectedObjectId, updateObject]);

  // Cancel transform changes
  const cancelTransform = useCallback(() => {
    if (selectedObjectRef.current && originalTransform && selectedObjectId) {
      // Revert to original transform
      const object = selectedObjectRef.current;
      object.position.set(...originalTransform.position);
      object.rotation.set(...originalTransform.rotation);
      object.scale.set(...originalTransform.scale);
      
      // Update local state to match
      setObjects(prev => prev.map(obj => 
        obj.id === selectedObjectId 
          ? { ...obj, ...originalTransform }
          : obj
      ));
      
      setOriginalTransform(null);
      setOriginalScaleRatio(null);
    }
  }, [selectedObjectId, originalTransform]);

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
      OBJECT_TYPES,
      // Transform controls
      transformMode,
      setTransformMode,
      isTransforming,
      originalTransform,
      confirmTransform,
      cancelTransform
    };

    return () => {
      delete window.objectManager;
    };
  }, [addObject, updateObject, deleteObject, selectObject, objects, selectedObjectId, isEditMode, transformMode, isTransforming, originalTransform, confirmTransform, cancelTransform]);

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
          myId={myId}
          isEditMode={isEditMode}
          ref={selectedObjectId === object.id ? selectedObjectRef : null}
        />
      ))}
      
      {/* Transform Controls for selected object */}
      {isEditMode && selectedObjectId && selectedObjectRef.current && (
        <TransformControls
          ref={transformControlsRef}
          object={selectedObjectRef.current}
          mode={transformMode}
          size={1}
          showX={true}
          showY={true}
          showZ={true}
          space="world"
          onChange={handleTransformChange}
          onMouseDown={handleTransformStart}
          onMouseUp={handleTransformEnd}
        />
      )}
    </group>
  );
};

export default ObjectManager; 