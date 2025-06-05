// client/src/components/Paddle.tsx
import React from "react";
import { Paddle as PaddleProps } from "@shared/types"; // Import the Paddle type

interface Props {
  paddle: PaddleProps;
}

const Paddle: React.FC<Props> = ({ paddle }) => {
  const paddleStyle: React.CSSProperties = {
    position: "absolute",
    left: `${paddle.x}px`,
    top: `${paddle.y}px`,
    width: `${paddle.width}px`,
    height: `${paddle.height}px`,
    backgroundColor: "white",
    boxShadow:
      "0 0 5px #fff, 0 0 10px #fff, 0 0 15px #00ff00, 0 0 20px #00ff00", // Neon green glow
  };

  return (
    <div style={paddleStyle} data-testid={`paddle-${paddle.playerId}`}></div>
  );
};

export default Paddle;
