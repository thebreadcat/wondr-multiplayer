/**
 * SpatialGrid - Efficient spatial partitioning for collision detection
 * Divides the game world into cells and tracks entity positions for fast proximity queries.
 */
export class SpatialGrid {
  /**
   * Create a new spatial grid
   * @param {number} cellSize - Size of each grid cell
   * @param {number} worldSizeX - Total world width
   * @param {number} worldSizeZ - Total world depth (using Z as depth in 3D)
   */
  constructor(cellSize = 10, worldSizeX = 100, worldSizeZ = 100) {
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
    // Extract x,z coordinates regardless of position format
    const x = position.x !== undefined ? position.x : position[0] || 0;
    const z = position.z !== undefined ? position.z : position[2] || 0;
    
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
   * Debug function to get statistics about the grid
   */
  getStats() {
    return {
      cellCount: Object.keys(this.cells).length,
      entityCount: Object.keys(this.entityPositions).length,
      cellSize: this.cellSize,
      gridDimensions: `${this.gridWidth}x${this.gridDepth}`
    };
  }
}
