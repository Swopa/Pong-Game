// client/src/components/Ball.tsx
import React from "react";
import { Ball as BallProps } from "@shared/types"; // Import the Ball type

interface Props {
  ball: BallProps;
}

const Ball: React.FC<Props> = ({ ball }) => {
  const ballStyle: React.CSSProperties = {
    position: "absolute",
    // Adjust for radius to center the ball
    left: `${ball.x - ball.radius}px`,
    top: `${ball.y - ball.radius}px`,
    width: `${ball.radius * 2}px`,
    height: `${ball.radius * 2}px`,
    backgroundColor: "white",
    borderRadius: "50%",
    boxShadow:
      "0 0 8px #fff, 0 0 12px #fff, 0 0 15px #ff00ff, 0 0 20px #ff00ff", // Neon pink glow
  };

  return <div style={ballStyle} data-testid="ball"></div>;
};

export default Ball;
