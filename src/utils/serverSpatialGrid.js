/**
 * Server-side spatial grid implementation for optimized collision detection
 * This is used to efficiently track player positions and handle tag events
 */

class ServerSpatialGrid {
  /**
   * Create a new spatial grid
   * @param {number} cellSize - Size of each grid cell
   * @param {number} worldSizeX - Total world width
   * @param {number} worldSizeZ - Total world depth (using Z as depth in 3D)
   */
  constructor(cellSize = 10, worldSizeX = 200, worldSizeZ = 200) {
    this.cellSize = cellSize;
    this.worldSizeX = worldSizeX;
    this.worldSizeZ = worldSizeZ;
    
    // Calculate grid dimensions
    this.gridWidth = Math.ceil(worldSizeX / cellSize);
    this.gridDepth = Math.ceil(worldSizeZ / cellSize);
    
    // Initialize grid cells
    this.cells = {};
    
    // Track entity positions
    this.entityPositions = {};
  }
  
  /**
   * Get cell key from world position
   * @param {number} x - World X coordinate
   * @param {number} z - World Z coordinate
   * @returns {string} - Cell key in format "x,z"
   */
  getCellKey(x, z) {
    // Offset coordinates by half world size to handle negative positions
    const offsetX = x + (this.worldSizeX / 2);
    const offsetZ = z + (this.worldSizeZ / 2);
    
    // Determine cell indices
    const cellX = Math.floor(offsetX / this.cellSize);
    const cellZ = Math.floor(offsetZ / this.cellSize);
    
    return `${cellX},${cellZ}`;
  }
  
  /**
   * Update entity position in the grid
   * @param {string} entityId - Unique entity identifier
   * @param {Object|Array} position - Entity position as {x,y,z} or [x,y,z]
   */
  updateEntity(entityId, position) {
    if (!position) return;
    
    // Extract x,z coordinates regardless of position format
    const x = position.x !== undefined ? position.x : (Array.isArray(position) ? position[0] : 0);
    const z = position.z !== undefined ? position.z : (Array.isArray(position) ? position[2] : 0);
    
    // If entity already has a position, remove from old cell
    if (this.entityPositions[entityId]) {
      const oldCellKey = this.getCellKey(
        this.entityPositions[entityId].x,
        this.entityPositions[entityId].z
      );
      
      if (this.cells[oldCellKey]) {
        this.cells[oldCellKey] = this.cells[oldCellKey].filter(id => id !== entityId);
        
        // Clean up empty cells
        if (this.cells[oldCellKey].length === 0) {
          delete this.cells[oldCellKey];
        }
      }
    }
    
    // Store new position
    this.entityPositions[entityId] = { x, z };
    
    // Add to new cell
    const cellKey = this.getCellKey(x, z);
    
    if (!this.cells[cellKey]) {
      this.cells[cellKey] = [];
    }
    
    if (!this.cells[cellKey].includes(entityId)) {
      this.cells[cellKey].push(entityId);
    }
  }
  
  /**
   * Remove entity from the grid
   * @param {string} entityId - Entity to remove
   */
  removeEntity(entityId) {
    if (!this.entityPositions[entityId]) return;
    
    const { x, z } = this.entityPositions[entityId];
    const cellKey = this.getCellKey(x, z);
    
    if (this.cells[cellKey]) {
      this.cells[cellKey] = this.cells[cellKey].filter(id => id !== entityId);
      
      if (this.cells[cellKey].length === 0) {
        delete this.cells[cellKey];
      }
    }
    
    delete this.entityPositions[entityId];
  }
  
  /**
   * Get all nearby entities within a certain range
   * @param {string} entityId - Entity to find neighbors for
   * @param {number} range - Search range in world units
   * @returns {Array} - Array of nearby entity IDs
   */
  getNearbyEntities(entityId, range = 5) {
    if (!this.entityPositions[entityId]) return [];
    
    const { x, z } = this.entityPositions[entityId];
    const nearbyEntities = [];
    
    // Calculate cell range to check
    const cellRange = Math.ceil(range / this.cellSize);
    const cellX = Math.floor((x + (this.worldSizeX / 2)) / this.cellSize);
    const cellZ = Math.floor((z + (this.worldSizeZ / 2)) / this.cellSize);
    
    // Check all cells in range
    for (let i = -cellRange; i <= cellRange; i++) {
      for (let j = -cellRange; j <= cellRange; j++) {
        const checkCellKey = `${cellX + i},${cellZ + j}`;
        
        if (this.cells[checkCellKey]) {
          // Add entities from this cell except the original entity
          this.cells[checkCellKey].forEach(id => {
            if (id !== entityId && !nearbyEntities.includes(id)) {
              nearbyEntities.push(id);
            }
          });
        }
      }
    }
    
    return nearbyEntities;
  }
  
  /**
   * Check if two entities are within a specific distance of each other
   * @param {string} entityId1 - First entity ID
   * @param {string} entityId2 - Second entity ID
   * @param {number} distance - Maximum distance to consider as "within range"
   * @returns {boolean} - True if entities are within the specified distance
   */
  areEntitiesWithinDistance(entityId1, entityId2, distance) {
    const pos1 = this.entityPositions[entityId1];
    const pos2 = this.entityPositions[entityId2];
    
    if (!pos1 || !pos2) return false;
    
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    
    // Calculate squared distance (more efficient than using Math.sqrt)
    const distanceSquared = dx * dx + dz * dz;
    
    return distanceSquared <= distance * distance;
  }
}

module.exports = ServerSpatialGrid;
