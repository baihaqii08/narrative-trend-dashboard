// @ts-nocheck
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

export default function ProfileSettings({ currentUser, onUpdateUser, onLogoutClick }: ProfileSettingsProps) {
  const navigate = useNavigate();

  // Active modal state: 'editProfile' | 'changePassword' | 'notifications' | 'preferences' | null
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Success / Info Toast state
  const [toastMsg, setToastMsg] = useState<string>('');

  // File Input Ref & Drag State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form State - Edit Profile
  const [editName, setEditName] = useState(currentUser.name || 'Cameron Williamson');
  const [editEmail, setEditEmail] = useState(currentUser.email || 'cameron@nolimit.id');
  const [editPhone, setEditPhone] = useState(currentUser.phone || '+62 812 3456 7890');
  const [editLocation, setEditLocation] = useState(currentUser.location || 'Bandung, Indonesia');
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  // Form State - Change Password
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passErrorMsg, setPassErrorMsg] = useState('');
  const [passSuccessMsg, setPassSuccessMsg] = useState('');

  // Form State - Notifications
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  // Form State - Preferences
  const [language, setLanguage] = useState('id');
  const [themeMode, setThemeMode] = useState('light');
  const [timezone, setTimezone] = useState('WIB');

  // Trigger Toast Notification
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg('');
    }, 3000);
  };

  // Handle file selection (from file picker or drag & drop)
  const handleFileSelected = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.');
      return;
    }
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file terlalu besar. Maksimal 2MB.');
      return;
    }
    // Convert to base64 data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setEditAvatarUrl(base64);
      setAvatarPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  // Handle Edit Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      alert('Nama dan Email tidak boleh kosong.');
      return;
    }

    onUpdateUser({
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      location: editLocation.trim(),
      avatarUrl: editAvatarUrl
    });

    setAvatarPreview('');
    setActiveModal(null);
    showToast('✓ Profil berhasil diperbarui!');
  };

  // Handle Delete Avatar — truly clears the avatar
  const handleDeleteAvatar = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus foto avatar Anda?')) {
      onUpdateUser({ avatarUrl: '' });
      setEditAvatarUrl('');
      setAvatarPreview('');
      showToast('✓ Avatar foto berhasil dihapus!');
    }
  };

  // Handle Change Password Submit
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPassErrorMsg('');
    setPassSuccessMsg('');

    if (!currentPass) {
      setPassErrorMsg('Harap masukkan kata sandi Anda saat ini.');
      return;
    }
    if (!newPass) {
      setPassErrorMsg('Harap masukkan kata sandi baru Anda.');
      return;
    }
    if (newPass.length < 8) {
      setPassErrorMsg('Kata sandi baru minimal 8 karakter.');
      return;
    }
    const hasLetter = /[a-zA-Z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    if (!hasLetter || !hasNumber) {
      setPassErrorMsg('Kata sandi baru harus mengombinasikan huruf dan angka.');
      return;
    }
    if (newPass !== confirmNewPass) {
      setPassErrorMsg('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setPassSuccessMsg('✓ Kata sandi berhasil diperbarui!');
    setTimeout(() => {
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
      setActiveModal(null);
      showToast('✓ Kata sandi Anda telah berhasil diubah!');
    }, 1200);
  };

  // Handle Save Notifications
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveModal(null);
    showToast('✓ Preferensi notifikasi telah disimpan.');
  };

  // Handle Save Preferences
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveModal(null);
    showToast('✓ Preferensi tampilan telah diperbarui.');
  };

  // Avatar display — show actual avatar or initials (NO default fallback)
  const displayAvatar = currentUser.avatarUrl || '';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a'
    }}>

      {/* Top Header Navbar - Royal Blue Bar */}
      <header style={{
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
        zIndex: 100
      }}>
        {/* Left Logo Section */}
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

        {/* Right User Profile Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Welcome Back !</span>
            <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: '800' }}>{currentUser.name}</span>
          </div>

          {/* User Avatar Circle */}
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
              cursor: 'pointer'
            }}
          >
            {displayAvatar ? (
              <img 
                src={displayAvatar} 
                alt={currentUser.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CW'
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        padding: '36px 20px 60px 20px',
        maxWidth: '920px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>

        {/* Back Navigation Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
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
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            {/* Left Arrow Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                cursor: 'pointer'
              }}
            >
              Keluar Sesi
            </button>
          )}
        </div>

        {/* Toast Alert Banner */}
        {toastMsg && (
          <div style={{
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
            justifyContent: 'space-between'
          }}>
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {/* Card 1: Informasi Akun */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '32px 36px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          marginBottom: '28px'
        }}>
          {/* Card Header Title */}
          <h2 style={{
            margin: '0 0 24px 0',
            fontSize: '20px',
            fontWeight: '800',
            color: '#0f172a'
          }}>
            Informasi Akun
          </h2>

          {/* Avatar Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px'
          }}>
            {/* Avatar Circle Container */}
            <div style={{
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
              justifyContent: 'center'
            }}>
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={currentUser.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span style="font-size:36px;font-weight:bold;color:#003399">${currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CW'}</span>`;
                  }}
                />
              ) : (
                <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#003399' }}>
                  {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CW'}
                </span>
              )}
            </div>

            {/* Avatar Action Buttons */}
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
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              >
                {/* Edit Pencil Icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#002266'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#003399'}
              >
                Delete Avatar
              </button>
            </div>
          </div>

          {/* Account Details Rows List */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Row 1: Nama Lengkap */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 0',
              borderTop: '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* User Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Nama Lengkap
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                {currentUser.name}
              </div>
            </div>

            {/* Row 2: Email */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 0',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* Email Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Email
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                {currentUser.email}
              </div>
            </div>

            {/* Row 3: No. Telepon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 0',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* Phone Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                No. Telepon
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                {currentUser.phone || '+62 812 3456 7890'}
              </div>
            </div>

            {/* Row 4: Lokasi */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 0',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* Location Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Lokasi
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                {currentUser.location || 'Bandung, Indonesia'}
              </div>
            </div>

          </div>
        </div>

        {/* Card 2: Pengaturan */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '32px 36px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0'
        }}>
          {/* Card Header Title */}
          <h2 style={{
            margin: '0 0 24px 0',
            fontSize: '20px',
            fontWeight: '800',
            color: '#0f172a'
          }}>
            Pengaturan
          </h2>

          {/* Settings Rows List */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Row 1: Ubah Password */}
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
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* Lock Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Ubah Password
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#003399', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{currentUser.name}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Ubah 🔒 ❯</span>
              </div>
            </div>

            {/* Row 2: Notifikasi */}
            <div 
              onClick={() => setActiveModal('notifications')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* Bell Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Notifikasi
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#003399', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{currentUser.email}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Atur 🔔 ❯</span>
              </div>
            </div>

            {/* Row 3: Preferensi Tampilan */}
            <div 
              onClick={() => setActiveModal('preferences')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ width: '40px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* Gear Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <div style={{ width: '220px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                Preferensi Tampilan
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#003399', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{currentUser.phone || '+62 812 3456 7890'}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Atur ⚙ ❯</span>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Interactive Modals */}
      {activeModal && (
        <div style={{
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
          overflowY: 'auto'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setActiveModal(null);
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
              margin: 'auto'
            }}
          >

            {/* Sticky Close Button */}
            <div style={{
              position: 'sticky',
              top: '-16px',
              display: 'flex',
              justifyContent: 'flex-end',
              zIndex: 30,
              height: 0,
              pointerEvents: 'none'
            }}>
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
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              >
                ✕
              </button>
            </div>

            {/* Modal 1: Edit Profile Form */}
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Alamat Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      No. Telepon
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Lokasi / Kota
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Avatar Upload — Drag & Drop + File Picker */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                      Foto Avatar
                    </label>

                    {/* Preview */}
                    {avatarPreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2px solid #003399',
                          flexShrink: 0
                        }}>
                          <img
                            src={avatarPreview}
                            alt="Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAvatarPreview(''); setEditAvatarUrl(''); }}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Hapus Foto
                        </button>
                      </div>
                    )}

                    {/* Drag & Drop Zone */}
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
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ color: isDragging ? '#003399' : '#94a3b8', marginBottom: '6px' }}>
                        {/* Upload Cloud Icon */}
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
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

                    {/* Hidden File Input */}
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
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '12px', backgroundColor: '#003399', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}

            {/* Modal 2: Change Password Form */}
            {activeModal === 'changePassword' && (
              <form onSubmit={handleChangePasswordSubmit} style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#003399' }}>
                  Ubah Kata Sandi
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                  Pastikan kata sandi baru Anda mengombinasikan setidaknya 8 karakter huruf dan angka.
                </p>

                {/* Error Banner */}
                {passErrorMsg && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                    ⚠️ {passErrorMsg}
                  </div>
                )}

                {/* Success Banner */}
                {passSuccessMsg && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                    {passSuccessMsg}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Password Saat Ini <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan kata sandi lama Anda"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Password Baru <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Minimal 8 karakter (huruf + angka)"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Konfirmasi Password Baru <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Ketik ulang password baru Anda"
                      value={confirmNewPass}
                      onChange={(e) => setConfirmNewPass(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '12px', backgroundColor: '#003399', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Simpan Password
                  </button>
                </div>
              </form>
            )}

            {/* Modal 3: Notifications Settings */}
            {activeModal === 'notifications' && (
              <form onSubmit={handleSaveNotifications} style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#003399' }}>
                  Pengaturan Notifikasi
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  Pilih cara NoLimit mengabarkan tren dan lonjakan narasi media sosial kepada Anda.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Email Alerts</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Terima notifikasi email saat ada tren lanskap baru.</div>
                    </div>
                    <input type="checkbox" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#003399' }} />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Push Notifications</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Notifikasi langsung pada browser & perangkat.</div>
                    </div>
                    <input type="checkbox" checked={pushNotif} onChange={(e) => setPushNotif(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#003399' }} />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Laporan Analisis Mingguan</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Kirimkan rangkuman sentimen setiap hari Senin.</div>
                    </div>
                    <input type="checkbox" checked={weeklyReport} onChange={(e) => setWeeklyReport(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#003399' }} />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '12px', backgroundColor: '#003399', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Simpan Notifikasi
                  </button>
                </div>
              </form>
            )}

            {/* Modal 4: Preferences Settings */}
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                      Bahasa Tampilan
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    >
                      <option value="id">Bahasa Indonesia (ID)</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                      Zona Waktu Data
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
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
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '12px', backgroundColor: '#003399', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
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
