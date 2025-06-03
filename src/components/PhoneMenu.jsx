import React, { useState } from 'react';
import { FaPhone, FaHome, FaGamepad, FaUser, FaCog, FaTimes, FaSnowboarding, FaVideo, FaEye } from 'react-icons/fa';
import { useCameraStore } from './CameraToggleButton';
import './PhoneMenu.css';

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
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
          <div className="phone-navigation">
            <button 
              className={`nav-button ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
              style={{
                flex: 1,
                padding: '15px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'home' ? '#3498db' : '#777',
                borderTop: activeTab === 'home' ? '3px solid #3498db' : '3px solid transparent'
              }}
            >
              <FaHome size={20} />
              <span style={{ fontSize: '12px', marginTop: '5px' }}>Home</span>
            </button>
            <button 
              className={`nav-button ${activeTab === 'games' ? 'active' : ''}`}
              onClick={() => setActiveTab('games')}
              style={{
                flex: 1,
                padding: '15px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'games' ? '#3498db' : '#777',
                borderTop: activeTab === 'games' ? '3px solid #3498db' : '3px solid transparent'
              }}
            >
              <FaGamepad size={20} />
              <span style={{ fontSize: '12px', marginTop: '5px' }}>Games</span>
            </button>
            <button 
              className={`nav-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              style={{
                flex: 1,
                padding: '15px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'profile' ? '#3498db' : '#777',
                borderTop: activeTab === 'profile' ? '3px solid #3498db' : '3px solid transparent'
              }}
            >
              <FaUser size={20} />
              <span style={{ fontSize: '12px', marginTop: '5px' }}>Profile</span>
            </button>
            <button 
              className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              style={{
                flex: 1,
                padding: '15px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'settings' ? '#3498db' : '#777',
                borderTop: activeTab === 'settings' ? '3px solid #3498db' : '3px solid transparent'
              }}
            >
              <FaCog size={20} />
              <span style={{ fontSize: '12px', marginTop: '5px' }}>Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMenu;
