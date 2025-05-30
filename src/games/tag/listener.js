export function handleTagCollision({ localId, otherId, otherType, activeGames, socket }) {
    if (otherType !== "player") return;
  
    const tagRoom = Object.keys(activeGames).find(
      key => activeGames[key]?.gameType === 'tag'
    );
    const game = activeGames[tagRoom];
  
    if (!game) return;
  
    const isInGame = game.players.includes(localId);
    const isIt = game.taggedPlayer === localId;
  
    if (isInGame && isIt) {
      socket.emit("tag:attempt", {
        roomId: tagRoom,
        targetId: otherId,
        playerId: localId,
      });
    }
  }