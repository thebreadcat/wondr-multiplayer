import { useEffect } from "react";
import { useRaceStore } from "./store";

// Uses window.gameSocket for multiplayer socket logic

export function handleRaceCollision({ localId, otherId, otherType, activeGames }) {
    if (otherType !== "checkpoint") return;
  
    const raceRoom = Object.keys(activeGames).find(
      key => activeGames[key]?.gameType === 'race'
    );
    const game = activeGames[raceRoom];
  
    if (!game) return;
  
    const currentCheckpoint = game.checkpoints?.[game.currentIndex];
    if (game.state === "racing" && currentCheckpoint?.id === otherId) {
      socket.emit("race:checkpoint", {
        roomId: raceRoom,
        playerId: localId,
        checkpointId: otherId,
      });
    }
}

export function RaceSocketListeners() {
  // Extract functions from the store
  const setOpponentProgress = useRaceStore((s) => s.setOpponentProgress);
  const setRaceData = useRaceStore((s) => s.setRaceData);

  useEffect(() => {
    if (!window.gameSocket) return;

    window.gameSocket.on("opponent:checkpoint", (data) => {
      setOpponentProgress && setOpponentProgress(data);
    });

    window.gameSocket.on("race:start", (data) => {
      // Trigger race start logic (animation, sounds, etc)
    });

    window.gameSocket.on("race:data", (data) => {
      console.log('[RaceSocketListeners] Received race:data:', data);
      setRaceData(data);
      
      // Also update the individual fields for direct access
      if (data) {
        const { setCheckpoints, setStartLine, setRoomId } = useRaceStore.getState();
        
        // Update checkpoints if available
        if (data.checkpoints && Array.isArray(data.checkpoints)) {
          setCheckpoints(data.checkpoints);
        }
        
        // Update start line if available
        if (data.startLine) {
          setStartLine(data.startLine);
        }
        
        // Update room ID if available
        if (data.roomId) {
          setRoomId(data.roomId);
        }
      }
    });

    window.gameSocket.on("race:finished", (data) => {
      // Show leaderboard, update UI, etc
    });

    return () => {
      window.gameSocket.off("opponent:checkpoint");
      window.gameSocket.off("race:start");
      window.gameSocket.off("race:finished");
      window.gameSocket.off("race:data");
    };
  }, []);

  return null;
}
