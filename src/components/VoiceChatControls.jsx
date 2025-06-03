import React, { useState } from 'react';
import styled from 'styled-components';
import { useVoiceChat } from './VoiceChatProvider';
import { useMultiplayer } from './MultiplayerProvider';

const VoiceChatContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 200px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
`;

const VoiceChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-size: 14px;
  font-weight: 600;
`;

const ControlsRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const VoiceButton = styled.button`
  background: ${props => {
    if (props.disabled) return 'rgba(128, 128, 128, 0.3)';
    if (props.active) return props.activeColor || '#4CAF50';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  border: 1px solid ${props => {
    if (props.disabled) return 'rgba(128, 128, 128, 0.3)';
    if (props.active) return props.activeColor || '#4CAF50';
    return 'rgba(255, 255, 255, 0.2)';
  }};
  color: ${props => props.disabled ? 'rgba(255, 255, 255, 0.4)' : 'white'};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: ${props => {
      if (props.disabled) return 'rgba(128, 128, 128, 0.3)';
      if (props.active) return props.activeColor || '#4CAF50';
      return 'rgba(255, 255, 255, 0.2)';
    }};
  }
`;

const StatusIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch (props.status) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#757575';
    }
  }};
`;

const PlayersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
`;

const PlayerItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 12px;
`;

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const VoiceActivityIndicator = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.active ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)'};
  transition: all 0.2s ease;
  ${props => props.active && `
    box-shadow: 0 0 8px #4CAF50;
    animation: pulse 1s infinite;
  `}

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

const MicrophoneLevel = styled.div`
  width: 60px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
`;

const MicrophoneLevelBar = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A, #CDDC39, #FFEB3B, #FF9800, #F44336);
  width: ${props => Math.min(props.level, 100)}%;
  transition: width 0.1s ease;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
  
  &:hover {
    color: white;
  }
`;

const ConnectionIndicator = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 8px;

  .connection-status {
    padding: 4px 8px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-size: 10px;
    color: white;
  }

  .connected {
    background-color: #4CAF50;
  }

  .connecting {
    background-color: #FF9800;
  }

  .error {
    background-color: #F44336;
  }

  .retrying {
    background-color: #ff9800;
  }
`;

const VoiceChatButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const VoiceChatButton = styled.button`
  background: ${props => {
    if (props.disabled) return 'rgba(128, 128, 128, 0.3)';
    if (props.active) return props.activeColor || '#4CAF50';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  border: 1px solid ${props => {
    if (props.disabled) return 'rgba(128, 128, 128, 0.3)';
    if (props.active) return props.activeColor || '#4CAF50';
    return 'rgba(255, 255, 255, 0.2)';
  }};
  color: ${props => props.disabled ? 'rgba(255, 255, 255, 0.4)' : 'white'};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: ${props => {
      if (props.disabled) return 'rgba(128, 128, 128, 0.3)';
      if (props.active) return props.activeColor || '#4CAF50';
      return 'rgba(255, 255, 255, 0.2)';
    }};
  }

  &.muted {
    background-color: rgba(255, 255, 255, 0.1);
  }

  &.deafened {
    background-color: rgba(255, 255, 255, 0.1);
  }

  &.retry {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

export default function VoiceChatControls() {
  const {
    isVoiceChatEnabled,
    isMuted,
    isDeafened,
    voiceActivity,
    connectionStatus,
    microphoneVolume,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    toggleDeafen,
    enableAudio,
    testAudio,
    retryAllConnections
  } = useVoiceChat();

  const { players, myId } = useMultiplayer();
  const [isExpanded, setIsExpanded] = useState(true);

  const connectedPlayers = Object.keys(players).filter(id => 
    id !== myId && connectionStatus[id] === 'connected'
  );

  const handleStartVoiceChat = async () => {
    try {
      console.log('[VoiceChatControls] Starting voice chat...');
      await startVoiceChat();
    } catch (error) {
      console.error('[VoiceChatControls] Failed to start voice chat:', error);
      alert('Failed to start voice chat. Please check your microphone permissions.');
    }
  };

  const handleStopVoiceChat = () => {
    console.log('[VoiceChatControls] Stopping voice chat...');
    stopVoiceChat();
  };

  // Debug function to show connection status
  const debugConnections = () => {
    console.log('=== VOICE CHAT DEBUG ===');
    console.log('My ID:', myId);
    console.log('Voice chat enabled:', isVoiceChatEnabled);
    console.log('Players:', Object.keys(players));
    console.log('Connection status:', connectionStatus);
    console.log('Socket connected:', window.gameSocket?.connected || window.socket?.connected);
    console.log('========================');
  };

  // Count connected players
  const connectedCount = Object.values(connectionStatus).filter(status => status === 'connected').length;
  const totalOtherPlayers = Object.keys(players).filter(id => id !== myId).length;

  // Check if there are any stuck connections
  const hasStuckConnections = Object.values(connectionStatus).some(
    status => status === 'connecting' || status === 'error' || status === 'retrying'
  );

  if (!isVoiceChatEnabled) {
    return (
      <VoiceChatContainer>
        <VoiceChatHeader>
          Voice Chat
        </VoiceChatHeader>
        <VoiceButton onClick={handleStartVoiceChat}>
          🎤 Join Voice Chat
        </VoiceButton>
      </VoiceChatContainer>
    );
  }

  return (
    <VoiceChatContainer>
      <VoiceChatHeader>
        Voice Chat ({connectedPlayers.length} connected)
        <ToggleButton onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? '▼' : '▲'}
        </ToggleButton>
      </VoiceChatHeader>

      <ControlsRow>
        <VoiceButton
          active={!isMuted}
          activeColor="#4CAF50"
          onClick={toggleMute}
        >
          {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
        </VoiceButton>

        <VoiceButton
          active={!isDeafened}
          activeColor="#2196F3"
          onClick={toggleDeafen}
        >
          {isDeafened ? '🔇' : '🔊'} {isDeafened ? 'Undeafen' : 'Deafen'}
        </VoiceButton>

        <VoiceButton
          onClick={handleStopVoiceChat}
          activeColor="#F44336"
        >
          ❌ Leave
        </VoiceButton>
      </ControlsRow>

      {!isMuted && (
        <div>
          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '10px', marginBottom: '4px' }}>
            Microphone Level
          </div>
          <MicrophoneLevel>
            <MicrophoneLevelBar level={(microphoneVolume / 255) * 100} />
          </MicrophoneLevel>
        </div>
      )}

      {isExpanded && (
        <PlayersList>
          {/* Show my own status */}
          <PlayerItem>
            <PlayerInfo>
              <VoiceActivityIndicator active={voiceActivity[myId]} />
              <span>You {isMuted ? '(muted)' : ''}</span>
            </PlayerInfo>
            <StatusIndicator status="connected" />
          </PlayerItem>

          {/* Show other players */}
          {Object.keys(players).map(playerId => {
            if (playerId === myId) return null;
            
            const player = players[playerId];
            const status = connectionStatus[playerId] || 'disconnected';
            const isActive = voiceActivity[playerId];
            
            return (
              <PlayerItem key={playerId}>
                <PlayerInfo>
                  <VoiceActivityIndicator active={isActive} />
                  <span>
                    Player {playerId.substring(0, 6)}
                    {status === 'connecting' && ' (connecting...)'}
                    {status === 'error' && ' (error)'}
                  </span>
                </PlayerInfo>
                <StatusIndicator status={status} />
              </PlayerItem>
            );
          })}

          {Object.keys(players).length === 1 && (
            <PlayerItem>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                No other players online
              </span>
            </PlayerItem>
          )}
        </PlayersList>
      )}

      {/* Connection Status */}
      <div style={{ fontSize: '12px', opacity: 0.8 }}>
        Status: {isVoiceChatEnabled ? 'Connected' : 'Disconnected'}
        <br />
        Connections: {connectedCount}/{totalOtherPlayers}
      </div>

      {/* Debug and Retry Buttons */}
      <div style={{ display: 'flex', gap: '5px' }}>
        <button 
          onClick={debugConnections}
          style={{
            padding: '4px 8px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            flex: 1
          }}
        >
          Debug Info
        </button>
        
        <button 
          onClick={retryAllConnections}
          style={{
            padding: '4px 8px',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            flex: 1
          }}
        >
          Retry Connections
        </button>
      </div>
      
      {/* Audio Test Buttons */}
      {isVoiceChatEnabled && (
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            onClick={testAudio}
            style={{
              padding: '4px 8px',
              backgroundColor: '#795548',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px',
              flex: 1
            }}
          >
            Test Audio
          </button>
          
          <button 
            onClick={enableAudio}
            style={{
              padding: '4px 8px',
              backgroundColor: '#009688',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px',
              flex: 1
            }}
          >
            Enable Audio
          </button>
        </div>
      )}
      
      {/* Connection Details */}
      {isVoiceChatEnabled && Object.keys(connectionStatus).length > 0 && (
        <div style={{ fontSize: '10px', opacity: 0.7 }}>
          <div>Connections:</div>
          <ConnectionIndicator>
            {Object.entries(connectionStatus).map(([playerId, status]) => (
              <div key={playerId} className={`connection-status ${status}`}>
                {playerId.substring(0, 6)}: {status}
              </div>
            ))}
          </ConnectionIndicator>
        </div>
      )}
    </VoiceChatContainer>
  );
} 