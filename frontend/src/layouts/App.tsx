import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import "../content/App.css";
import Overview from '../content/Analytics/Overview';
import Login from '../content/Auth/Login';
import ProfileSettings from '../content/Profile/ProfileSettings';
import nolimitLogo from '../assets/nolimit-logo.png';
import { logoutFromFastApi } from '../services/api';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  avatarUrl: string;
}

const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';

const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Cameron Williamson',
  email: 'cameron@nolimit.id',
  phone: '+62 812 3456 7890',
  location: 'Bandung, Indonesia',
  avatarUrl: DEFAULT_AVATAR_URL,
};

const DASHBOARD_THEME = {
  bgMain: '#f3f4f8',
  bgCard: '#ffffff',
  textMain: '#0f172a',
  textMuted: '#64748b',
  inputBg: '#ffffff',
  border: '#e2e8f0',
  hoverBg: '#f1f5f9',
};

function App() {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('all');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(loadInitialAuthStatus);
  const [currentUser, setCurrentUser] = useState<UserProfile>(loadInitialUserProfile);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogin = (userData?: Partial<UserProfile>) => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    if (userData) {
      setCurrentUser((previousUser) => {
        const updatedUser = { ...previousUser, ...userData };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return updatedUser;
      });
    }
  };

  const handleUpdateUser = (updatedData: Partial<UserProfile>) => {
    setCurrentUser((previousUser) => {
      const updatedUser = { ...previousUser, ...updatedData };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logoutFromFastApi();
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
    setShowLogoutConfirm(false);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const displayAvatar = currentUser.avatarUrl || DEFAULT_AVATAR_URL;

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />

        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <ProfileSettings
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
                onLogoutClick={handleLogoutClick}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <ProfileSettings
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
                onLogoutClick={handleLogoutClick}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <div
                style={{
                  minHeight: '100vh',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0,
                  padding: 0,
                  backgroundColor: DASHBOARD_THEME.bgMain,
                }}
              >
                <header
                  style={{
                    height: '64px',
                    backgroundColor: '#003399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 32px',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    zIndex: 100,
                    position: 'sticky',
                    top: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                      src={nolimitLogo}
                      alt="NoLimit Logo"
                      style={{ height: '36px', width: 'auto', objectFit: 'contain', cursor: 'pointer' }}
                      onClick={() => navigate('/dashboard')}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      onClick={() => navigate('/profile')}
                      style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                      title="Pengaturan Profil"
                    >
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>
                        Welcome Back !
                      </span>
                      <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: '800' }}>{currentUser.name}</span>
                    </div>

                    <div
                      onClick={() => navigate('/profile')}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6',
                        border: '2px solid #ffffff',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '15px',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                      title="Pengaturan Profil"
                    >
                      {displayAvatar ? (
                        <img
                          src={displayAvatar}
                          alt={currentUser.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        extractUserInitials(currentUser.name)
                      )}
                    </div>

                    <button
                      onClick={() => navigate('/profile')}
                      title="Pengaturan Akun & Password"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                      Profil
                    </button>

                    <button
                      onClick={handleLogoutClick}
                      title="Keluar / Logout"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        color: '#ffffff',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Keluar
                    </button>
                  </div>
                </header>

                <main
                  className="konten-utama"
                  style={{
                    flex: 1,
                    padding: '32px 40px',
                    backgroundColor: DASHBOARD_THEME.bgMain,
                    color: DASHBOARD_THEME.textMain,
                    textAlign: 'left',
                    position: 'relative',
                    boxSizing: 'border-box',
                    maxWidth: '1600px',
                    width: '100%',
                    margin: '0 auto',
                  }}
                >
                  <Overview theme={DASHBOARD_THEME} timeFilter={timeFilter} setTimeFilter={setTimeFilter} />
                </main>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>

      {showLogoutConfirm && (
        <LogoutConfirmationModal
          userName={currentUser.name}
          onCancel={cancelLogout}
          onConfirm={confirmLogout}
        />
      )}
    </>
  );
}

interface LogoutConfirmationModalProps {
  userName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function LogoutConfirmationModal({ userName, onCancel, onConfirm }: LogoutConfirmationModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            border: '1px solid #fecaca',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </div>

        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
          Konfirmasi Keluar
        </h3>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
          Apakah Anda yakin ingin keluar dari akun <strong>{userName}</strong>?
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = '#e2e8f0';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
          >
            Batal
          </button>

          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = '#dc2626';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = '#ef4444';
            }}
          >
            Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  );
}

function loadInitialAuthStatus(): boolean {
  return localStorage.getItem('isAuthenticated') === 'true';
}

function loadInitialUserProfile(): UserProfile {
  const savedUserJson = localStorage.getItem('currentUser');
  if (!savedUserJson) {
    return DEFAULT_USER_PROFILE;
  }

  try {
    const parsedUser = JSON.parse(savedUserJson);
    return {
      name: parsedUser.name || DEFAULT_USER_PROFILE.name,
      email: parsedUser.email || DEFAULT_USER_PROFILE.email,
      phone: parsedUser.phone || DEFAULT_USER_PROFILE.phone,
      location: parsedUser.location || DEFAULT_USER_PROFILE.location,
      avatarUrl: parsedUser.avatarUrl || DEFAULT_USER_PROFILE.avatarUrl,
    };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

function extractUserInitials(fullName: string): string {
  const initials = fullName
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  return initials || 'CW';
}

export default App;
