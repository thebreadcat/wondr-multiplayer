import React, { useState, useEffect, useRef, useContext } from 'react';
import { FaPhone, FaHome, FaGamepad, FaUser, FaCog, FaTimes, FaSnowboarding, FaVideo, FaEye } from 'react-icons/fa';
import { useCameraStore } from './CameraToggleButton';
import './PhoneMenu.css';
import { useMultiplayer } from './MultiplayerProvider';
import { GameSystemContext } from './GameSystemProvider';
import { getSocket } from '../utils/socketManager';
import ObjectsTab from './ObjectsTab';

// Tab content components
const HomeTab = ({ onCustomizeClick, onCloseMenu, onToggleSkateboard, showSkateboard }) => {
  const { isFirstPerson, toggleView } = useCameraStore();
  
  return (
  <div className="tab-content">
    <h2>Apps</h2>
    <div className="app-grid">
      <div 
        className="app-icon" 
        onClick={() => {
          onCustomizeClick();
          onCloseMenu();
        }}
      >
        <div className="app-icon-circle">
          <FaUser size={24} />
        </div>
        <span>Customize</span>
      </div>
      <div className="app-icon">
        <div className="app-icon-circle">
          <FaGamepad size={24} />
        </div>
        <span>Games</span>
      </div>
      <div 
        className="app-icon" 
        onClick={() => {
          onToggleSkateboard();
        }}
      >
        <div className={`app-icon-circle ${showSkateboard ? 'active' : ''}`}>
          <FaSnowboarding size={24} />
        </div>
        <span>Board</span>
      </div>
      <div className="app-icon">
        <div className="app-icon-circle">
          <FaCog size={24} />
        </div>
        <span>Settings</span>
      </div>
      <div className="app-icon">
        <div className="app-icon-circle">
          <FaHome size={24} />
        </div>
        <span>Home</span>
      </div>
      <div 
        className="app-icon"
        onClick={() => {
          toggleView();
        }}
      >
        <div className={`app-icon-circle ${isFirstPerson ? 'active' : ''}`}>
          {isFirstPerson ? <FaEye size={24} /> : <FaVideo size={24} />}
        </div>
        <span>{isFirstPerson ? '1st Person' : '3rd Person'}</span>
      </div>
    </div>
  </div>
  );
};

const GamesTab = () => (
  <div className="tab-content">
    <h2>Games</h2>
    <div className="game-list">
      <div className="game-item">
        <h3>Tag Game</h3>
        <p>Classic tag game - don't get caught!</p>
        <button className="game-button">Play Now</button>
      </div>
      <div className="game-item">
        <h3>Race Game</h3>
        <p>Race through checkpoints for the best time!</p>
        <button className="game-button">Play Now</button>
      </div>
    </div>
  </div>
);

const ProfileTab = ({ onCustomizeClick }) => (
  <div className="tab-content">
    <h2>Profile</h2>
    <div className="profile-info">
      <div className="avatar-placeholder"></div>
      <h3>Player</h3>
      <p>Customize your appearance and settings</p>
      <button 
        className="profile-button" 
        onClick={onCustomizeClick}
      >
        Customize Character
      </button>
    </div>
  </div>
);

const SettingsTab = () => (
  <div className="tab-content">
    <h2>Settings</h2>
    <div className="settings-list">
      <div className="setting-item">
        <label>Sound Volume</label>
        <input type="range" min="0" max="100" defaultValue="80" />
      </div>
      <div className="setting-item">
        <label>Music Volume</label>
        <input type="range" min="0" max="100" defaultValue="60" />
      </div>
      <div className="setting-item">
        <label>Graphics Quality</label>
        <select defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>
  </div>
);

// Phone Menu Button Component
export const PhoneMenuButton = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      fontSize: '16px',
      padding: '8px 12px',
      backgroundColor: 'transparent',
      color: 'white',
      border: 'white 2px solid',
      borderRadius: '5px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '36px',
      minWidth: '44px',
    }}
  >
    <FaPhone size={16} />
  </button>
);

// Main Phone Menu Component
const PhoneMenu = ({ isOpen, onClose, onCustomizeClick, onToggleSkateboard, showSkateboard }) => {
  const [activeTab, setActiveTab] = useState('home');

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeTab 
            onCustomizeClick={onCustomizeClick} 
            onCloseMenu={onClose} 
            onToggleSkateboard={onToggleSkateboard}
            showSkateboard={showSkateboard}
          />
        );
      case 'games':
        return <GamesTab />;
      case 'objects':
        return <ObjectsTab />;
      case 'profile':
        return <ProfileTab onCustomizeClick={onCustomizeClick} />;
      case 'settings':
        return <SettingsTab />;
      default:
        return (
          <HomeTab 
            onCustomizeClick={onCustomizeClick} 
            onCloseMenu={onClose} 
            onToggleSkateboard={onToggleSkateboard}
            showSkateboard={showSkateboard}
          />
        );
    }
  };

  return (
    <div className="phone-menu-overlay" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: '0px 0px',
      zIndex: 16569306,
      width: '100vw',
      height: '100vh',
      right: 0,
      bottom: 0,
    }}>
      <div className="phone-menu-backdrop" style={{
        position: 'absolute',
        transform: 'none',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }} onClick={onClose}>
        <div className="phone-menu-container"
          onClick={(e) => e.stopPropagation()}
          style={{
            border: '12px solid #8ee88e',
            boxShadow: '8px 8px 0px #4a9e4a'
          }}
        >
          {/* Phone Header */}
          <div className="phone-header">
            <button 
              onClick={onClose}
              style={{
                background: '#8ee88e',
                border: '1px solid #4a9e4a',
                borderRadius: '50%',
                color: '#333',
                cursor: 'pointer',
                fontSize: '18px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
            >
              <FaTimes />
            </button>
          </div>

          {/* Phone Content */}
          <div className="phone-content">
            {renderTabContent()}
          </div>

          {/* Phone Navigation */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '10px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'home' ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
            >
              🏠
            </button>
            <button
              onClick={() => setActiveTab('games')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'games' ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
            >
              🎮
            </button>
            <button
              onClick={() => setActiveTab('objects')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'objects' ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
            >
              📦
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'profile' ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
            >
              👤
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'settings' ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMenu;
