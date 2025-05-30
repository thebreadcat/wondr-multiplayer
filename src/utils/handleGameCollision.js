import { handleTagCollision } from "../games/tag/listener";
import { handleRaceCollision } from "../games/race/listeners";

const gameHandlers = [
  handleTagCollision,
  handleRaceCollision,
  // Add more here...
];

export function handleGameCollision(params) {
  for (const handler of gameHandlers) {
    try {
      handler(params); // Each handler decides whether to do anything
    } catch (err) {
      console.error("[Collision Handler Error]", err);
    }
  }
}
