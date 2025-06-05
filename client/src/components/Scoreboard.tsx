// client/src/components/Scoreboard.tsx
import React from "react";
import { Scores, GameState } from "@shared/types";

interface Props {
  gameState: GameState | null;
  myPlayerId: string | null; // To identify "my" score vs "opponent"
}

const Scoreboard: React.FC<Props> = ({ gameState, myPlayerId }) => {
  if (!gameState) {
    return null; // Don't render if no game state
  }

  const { scores, paddles, status } = gameState;
  let player1Id: string | null = null;
  let player2Id: string | null = null;

  // Find player1 and player2 IDs from the paddles object
  // This assumes paddles object has player IDs as keys
  // And that player1 is on the left (smaller x)
  const paddlePlayerIds = Object.keys(paddles);
  if (paddlePlayerIds.length === 2) {
    const p1 = paddles[paddlePlayerIds[0]];
    const p2 = paddles[paddlePlayerIds[1]];
    if (p1.x < p2.x) {
      player1Id = p1.playerId;
      player2Id = p2.playerId;
    } else {
      player1Id = p2.playerId;
      player2Id = p1.playerId;
    }
  }

  const scoreStyle: React.CSSProperties = {
    position: "absolute",
    top: "20px",
    width: "100%",
    textAlign: "center",
    fontSize: "2em",
    color: "white",
    display: "flex",
    justifyContent: "space-around",
    fontFamily: "'Press Start 2P', cursive", // Retro font
  };

  const playerScoreStyle: React.CSSProperties = {
    minWidth: "50px", // Ensure some space for scores
  };

  return (
    <div style={scoreStyle}>
      <span style={playerScoreStyle}>
        {player1Id
          ? scores[player1Id] !== undefined
            ? scores[player1Id]
            : 0
          : 0}
      </span>
      <span style={playerScoreStyle}>-</span>
      <span style={playerScoreStyle}>
        {player2Id
          ? scores[player2Id] !== undefined
            ? scores[player2Id]
            : 0
          : 0}
      </span>
    </div>
  );
};

export default Scoreboard;
