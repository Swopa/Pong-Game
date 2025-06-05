import React from 'react';
import { GameState, GAME_WIDTH, GAME_HEIGHT } from '@shared/types';
import Paddle from './Paddle';
import Ball from './Ball';
import Scoreboard from './Scoreboard';

interface Props {
  gameState: GameState | null;
  myPlayerId: string | null;
}

const GameArea: React.FC<Props> = ({ gameState, myPlayerId }) => {
  const gameAreaStyle: React.CSSProperties = {
    position: 'relative', // For absolute positioning of children
    width: `${GAME_WIDTH}px`,
    height: `${GAME_HEIGHT}px`,
    backgroundColor: 'black',
    border: '2px solid white',
    margin: '20px auto', // Center it
    overflow: 'hidden', // Keep elements within bounds
    boxShadow: '0 0 20px #00bfff, 0 0 30px #00bfff', // Neon blue border glow
  };

  // Center line (optional decorative element)
  const centerLineStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '4px', // Dashed line width
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  const dashStyle: React.CSSProperties = {
    height: '20px', // Height of each dash
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Semi-transparent white
    marginBottom: '15px', // Space between dashes
  };


  if (!gameState) {
    return <div style={gameAreaStyle}><p style={{color: 'white', textAlign: 'center', paddingTop: '40%'}}>Waiting for game data...</p></div>;
  }

  const { paddles, ball } = gameState;

  return (
    <div style={gameAreaStyle} data-testid="game-area">
      <Scoreboard gameState={gameState} myPlayerId={myPlayerId} />
      {/* Center Line */}
      <div style={centerLineStyle}>
        {Array.from({ length: Math.floor(GAME_HEIGHT / (20 + 15)) }).map((_, index) => (
          <div key={index} style={dashStyle}></div>
        ))}
      </div>

      {Object.values(paddles).map((paddle) => (
        <Paddle key={paddle.playerId} paddle={paddle} />
      ))}
      <Ball ball={ball} />
    </div>
  );
};

export default GameArea;