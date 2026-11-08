import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import nolimitLogo from '../../assets/nolimit-logo.png';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  avatarUrl: string;
}

interface ProfileSettingsProps {
  currentUser: UserProfile;
  onUpdateUser: (updatedData: Partial<UserProfile>) => void;
  onLogoutClick?: () => void;
}

const VALID_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const TOAST_DURATION_MS = 3000;
const PASSWORD_UPDATE_CLOSE_DELAY_MS = 1200;

export default function ProfileSettings({ currentUser, onUpdateUser, onLogoutClick }: ProfileSettingsProps) {
  const navigate = useNavigate();

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [editName, setEditName] = useState(currentUser.name || 'Cameron Williamson');
  const [editEmail, setEditEmail] = useState(currentUser.email || 'cameron@nolimit.id');
  const [editPhone, setEditPhone] = useState(currentUser.phone || '+62 812 3456 7890');
  const [editLocation, setEditLocation] = useState(currentUser.location || 'Bandung, Indonesia');
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passErrorMsg, setPassErrorMsg] = useState('');
  const [passSuccessMsg, setPassSuccessMsg] = useState('');

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  const [language, setLanguage] = useState('id');
  const [timezone, setTimezone] = useState('WIB');

  const showToast = (message: string) => {
    setToastMsg(message);
    setTimeout(() => {
      setToastMsg('');
    }, TOAST_DURATION_MS);
  };

  const handleFileSelected = (selectedFile: File) => {
    if (!VALID_AVATAR_MIME_TYPES.includes(selectedFile.type)) {
      alert('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.');
      return;
    }
    if (selectedFile.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      alert('Ukuran file terlalu besar. Maksimal 2MB.');
      return;
    }
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      const base64DataUrl = fileReader.result as string;
      setEditAvatarUrl(base64DataUrl);
      setAvatarPreview(base64DataUrl);
    };
    fileReader.readAsDataURL(selectedFile);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelected(droppedFiles[0]);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelected(selectedFiles[0]);
    }
  };

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      alert('Nama dan Email tidak boleh kosong.');
      return;
    }

    onUpdateUser({
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      location: editLocation.trim(),
      avatarUrl: editAvatarUrl,
    });

    setAvatarPreview('');
    setActiveModal(null);
    showToast('✓ Profil berhasil diperbarui!');
  };

  const handleDeleteAvatar = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus foto avatar Anda?')) {
      onUpdateUser({ avatarUrl: '' });
      setEditAvatarUrl('');
      setAvatarPreview('');
      showToast('✓ Avatar foto berhasil dihapus!');
    }
  };

  const handleChangePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPassErrorMsg('');
    setPassSuccessMsg('');

    const validationError = validatePasswordChangeInput(currentPass, newPass, confirmNewPass);
    if (validationError) {
      setPassErrorMsg(validationError);
      return;
    }

    setPassSuccessMsg('✓ Kata sandi berhasil diperbarui!');
    setTimeout(() => {
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
      setActiveModal(null);
      showToast('✓ Kata sandi Anda telah berhasil diubah!');
    }, PASSWORD_UPDATE_CLOSE_DELAY_MS);
  };

  const handleSaveNotifications = (event: React.FormEvent) => {
    event.preventDefault();
    setActiveModal(null);
    showToast('✓ Preferensi notifikasi telah disimpan.');
  };

  const handleSavePreferences = (event: React.FormEvent) => {
    event.preventDefault();
    setActiveModal(null);
    showToast('✓ Preferensi tampilan telah diperbarui.');
  };

  const displayAvatar = currentUser.avatarUrl || '';
  const userInitials = extractUserInitials(currentUser.name);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
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
          boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
          title="Kembali ke Dashboard"
        >
          <img
            src={nolimitLogo}
            alt="NoLimit Logo"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
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
              userInitials
            )}
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: '36px 20px 60px 20px',
          maxWidth: '920px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              color: '#003399',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5"></path>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Kembali ke Dashboard
          </button>

          {onLogoutClick && (
            <button
              onClick={onLogoutClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#dc2626',
                cursor: 'pointer',
              }}
            >
              Keluar Sesi
            </button>
          )}
        </div>

        {toastMsg && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '12px 18px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{toastMsg}</span>
            <button
              onClick={() => setToastMsg('')}
              style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px 36px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0',
            marginBottom: '28px',
          }}
        >
          <h2
            style={{
              margin: '0 0 24px 0',
              fontSize: '20px',
              fontWeight: '800',
              color: '#0f172a',
            }}
          >
            Informasi Akun
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: '#e2e8f0',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
                border: '3px solid #ffffff',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={currentUser.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).style.display = 'none';
                    if (event.currentTarget.parentElement) {
                      event.currentTarget.parentElement.innerHTML = `<span style="font-size:36px;font-weight:bold;color:#003399">${userInitials}</span>`;
                    }
                  }}
                />
              ) : (
                <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#003399' }}>{userInitials}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setEditName(currentUser.name);
                  setEditEmail(currentUser.email);
                  setEditPhone(currentUser.phone);
                  setEditLocation(currentUser.location);
                  setEditAvatarUrl(currentUser.avatarUrl || '');
                  setAvatarPreview(currentUser.avatarUrl || '');
                  setActiveModal('editProfile');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Profile
              </button>

              <button
                onClick={handleDeleteAvatar}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#003399',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 51, 153, 0.2)',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = '#002266';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = '#003399';
                }}
              >
                Delete Avatar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderTop: '1px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>Nama Lengkap</div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{currentUser.name}</div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>Email</div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>{currentUser.email}</div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>No. Telepon</div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                {currentUser.phone || '+62 812 3456 7890'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>Lokasi</div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                {currentUser.location || 'Bandung, Indonesia'}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px 36px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0',
          }}
        >
          <h2
            style={{
              margin: '0 0 24px 0',
              fontSize: '20px',
              fontWeight: '800',
              color: '#0f172a',
            }}
          >
            Pengaturan
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              onClick={() => {
                setPassErrorMsg('');
                setPassSuccessMsg('');
                setCurrentPass('');
                setNewPass('');
                setConfirmNewPass('');
                setActiveModal('changePassword');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderTop: '1px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Ubah Password
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: '14px',
                  color: '#003399',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{currentUser.name}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Ubah 🔒 ❯</span>
              </div>
            </div>

            <div
              onClick={() => setActiveModal('notifications')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>Notifikasi</div>
              <div
                style={{
                  flex: 1,
                  fontSize: '14px',
                  color: '#003399',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{currentUser.email}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Atur 🔔 ❯</span>
              </div>
            </div>

            <div
              onClick={() => setActiveModal('preferences')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Preferensi Tampilan
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: '14px',
                  color: '#003399',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{currentUser.phone || '+62 812 3456 7890'}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Atur ⚙ ❯</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {activeModal && (
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
            zIndex: 1000,
            padding: '24px 16px',
            overflowY: 'auto',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveModal(null);
            }
          }}
        >
          <div
            className="modal-scrollable"
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: 'min(90vh, 760px)',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              overflowY: 'auto',
              margin: 'auto',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: '-16px',
                display: 'flex',
                justifyContent: 'flex-end',
                zIndex: 30,
                height: 0,
                pointerEvents: 'none',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  pointerEvents: 'auto',
                  marginTop: '-4px',
                  marginRight: '-4px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = '#e2e8f0';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
              >
                ✕
              </button>
            </div>

            {activeModal === 'editProfile' && (
              <form onSubmit={handleSaveProfile} style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#003399' }}>
                  Edit Informasi Profil
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  Perbarui data identitas diri dan informasi kontak Anda.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      Alamat Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      No. Telepon
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      Lokasi / Kota
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(event) => setEditLocation(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '6px',
                      }}
                    >
                      Foto Avatar
                    </label>

                    {avatarPreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '2px solid #003399',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={avatarPreview}
                            alt="Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarPreview('');
                            setEditAvatarUrl('');
                          }}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Hapus Foto
                        </button>
                      </div>
                    )}

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: isDragging ? '2px dashed #003399' : '2px dashed #cbd5e1',
                        borderRadius: '10px',
                        padding: '24px 16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: isDragging ? '#eef2ff' : '#f8fafc',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ color: isDragging ? '#003399' : '#94a3b8', marginBottom: '6px' }}>
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ margin: '0 auto' }}
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                        {isDragging ? 'Lepaskan file di sini...' : 'Seret & lepaskan foto, atau klik untuk memilih'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        JPG, PNG, GIF, WebP — Maks. 2MB
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#003399',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'changePassword' && (
              <form onSubmit={handleChangePasswordSubmit} style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#003399' }}>
                  Ubah Kata Sandi
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                  Pastikan kata sandi baru Anda mengombinasikan setidaknya 8 karakter huruf dan angka.
                </p>

                {passErrorMsg && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '14px',
                    }}
                  >
                    ⚠️ {passErrorMsg}
                  </div>
                )}

                {passSuccessMsg && (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '14px',
                    }}
                  >
                    {passSuccessMsg}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      Password Saat Ini <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan kata sandi lama Anda"
                      value={currentPass}
                      onChange={(event) => setCurrentPass(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      Password Baru <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Minimal 8 karakter (huruf + angka)"
                      value={newPass}
                      onChange={(event) => setNewPass(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      Konfirmasi Password Baru <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Ketik ulang password baru Anda"
                      value={confirmNewPass}
                      onChange={(event) => setConfirmNewPass(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#003399',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    Simpan Password
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'notifications' && (
              <form onSubmit={handleSaveNotifications} style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#003399' }}>
                  Pengaturan Notifikasi
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  Pilih cara NoLimit mengabarkan tren dan lonjakan narasi media sosial kepada Anda.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Email Alerts</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Terima notifikasi email saat ada tren lanskap baru.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotif}
                      onChange={(event) => setEmailNotif(event.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#003399' }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Push Notifications</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Notifikasi langsung pada browser &amp; perangkat.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={pushNotif}
                      onChange={(event) => setPushNotif(event.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#003399' }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                        Laporan Analisis Mingguan
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Kirimkan rangkuman sentimen setiap hari Senin.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={weeklyReport}
                      onChange={(event) => setWeeklyReport(event.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#003399' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#003399',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    Simpan Notifikasi
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'preferences' && (
              <form onSubmit={handleSavePreferences} style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#003399' }}>
                  Preferensi Tampilan
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  Sesuaikan bahasa dan zona waktu sistem NoLimit Anda.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '6px',
                      }}
                    >
                      Bahasa Tampilan
                    </label>
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
                    >
                      <option value="id">Bahasa Indonesia (ID)</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '6px',
                      }}
                    >
                      Zona Waktu Data
                    </label>
                    <select
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
                    >
                      <option value="WIB">WIB - Waktu Indonesia Barat (UTC+7)</option>
                      <option value="WITA">WITA - Waktu Indonesia Tengah (UTC+8)</option>
                      <option value="WIT">WIT - Waktu Indonesia Timur (UTC+9)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#003399',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    Simpan Preferensi
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function validatePasswordChangeInput(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): string | null {
  if (!currentPassword) {
    return 'Harap masukkan kata sandi Anda saat ini.';
  }
  if (!newPassword) {
    return 'Harap masukkan kata sandi baru Anda.';
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return 'Kata sandi baru minimal 8 karakter.';
  }
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  if (!hasLetter || !hasNumber) {
    return 'Kata sandi baru harus mengombinasikan huruf dan angka.';
  }
  if (newPassword !== confirmNewPassword) {
    return 'Konfirmasi kata sandi baru tidak cocok.';
  }
  return null;
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
