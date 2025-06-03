import React, { useState } from 'react';
import styled from 'styled-components';
import { useVoiceChat } from './VoiceChatProvider';
import { useMultiplayer } from './MultiplayerProvider';

const VoiceChatButton = styled.button`
  font-size: 16px;
  padding: 8px 12px;
  border-radius: 5px;
  background: ${props => {
    if (!props.isEnabled) return '#fff';
    if (props.isMuted) return '#F44336';
    return '#4CAF50';
  }};
  cursor: pointer;
  border: 1px solid #888;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  min-width: 44px;
  color: ${props => props.isEnabled ? 'white' : 'black'};
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`;

const VoiceChatModal = styled.div`
  position: fixed;
  top: 70px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 250px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1001;
  font-family: 'Roboto', sans-serif;
`;

const VoiceChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-size: 14px;
  font-weight: 500;
  font-family: 'Roboto', sans-serif;
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
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
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
  font-family: 'Roboto', sans-serif;
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

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 16px;
  font-family: 'Roboto', sans-serif;
  padding: 4px;
  
  &:hover {
    color: white;
  }
`;

const RetryButton = styled.button`
  background: rgba(255, 152, 0, 0.2);
  border: 1px solid rgba(255, 152, 0, 0.4);
  color: #FF9800;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 11px;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 152, 0, 0.3);
    border-color: rgba(255, 152, 0, 0.6);
  }
`;

export default function VoiceChatControls() {
  const {
    isVoiceChatEnabled,
    isMuted,
    isDeafened,
    voiceActivity,
    connectionStatus,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    toggleDeafen,
    retryAllConnections
  } = useVoiceChat();

  const { players, myId } = useMultiplayer();
  const [showModal, setShowModal] = useState(false);

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
    setShowModal(false);
  };

  const handleButtonClick = (e) => {
    // Remove focus to prevent spacebar from toggling the button
    e.currentTarget.blur();
    
    if (!isVoiceChatEnabled) {
      handleStartVoiceChat();
    } else {
      setShowModal(!showModal);
    }
  };

  // Check if there are any stuck connections
  const hasStuckConnections = Object.values(connectionStatus).some(
    status => status === 'connecting' || status === 'error' || status === 'retrying'
  );

  return (
    <>
      <VoiceChatButton
        onClick={handleButtonClick}
        isEnabled={isVoiceChatEnabled}
        isMuted={isMuted}
        title={isVoiceChatEnabled ? (isMuted ? 'Unmute microphone' : 'Voice chat active') : 'Start voice chat'}
      >
        {!isVoiceChatEnabled ? '🎤' : (isMuted ? '🔇' : '🎤')}
      </VoiceChatButton>

      {showModal && isVoiceChatEnabled && (
        <VoiceChatModal>
          <VoiceChatHeader>
            Voice Chat ({connectedPlayers.length} connected)
            <CloseButton onClick={() => setShowModal(false)}>
              ✕
            </CloseButton>
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

          {hasStuckConnections && (
            <RetryButton onClick={retryAllConnections}>
              🔄 Retry Connections
            </RetryButton>
          )}

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
              
              const status = connectionStatus[playerId] || 'disconnected';
              const isActive = voiceActivity[playerId];
              
              return (
                <PlayerItem key={playerId}>
                  <PlayerInfo>
                    <VoiceActivityIndicator active={isActive} />
                    <span>
                      Player {playerId.substring(0, 6)}
                    </span>
                  </PlayerInfo>
                  <StatusIndicator status={status} />
                </PlayerItem>
              );
            })}

            {Object.keys(players).length === 1 && (
              <PlayerItem>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'Roboto, sans-serif' }}>
                  No other players online
                </span>
              </PlayerItem>
            )}
          </PlayersList>
        </VoiceChatModal>
      )}
    </>
  );
} 