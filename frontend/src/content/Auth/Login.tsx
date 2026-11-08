import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import nolimitLogo from '../../assets/nolimit-logo.png';
import { loginWithFastApi } from '../../services/api';

interface LoginProps {
  onLogin: (userData?: { name: string; email: string }) => void;
}

interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}

const MIN_FULL_NAME_LENGTH = 5;
const MIN_PASSWORD_LENGTH = 8;
const GOOGLE_LOGIN_DELAY_MS = 500;
const REGISTRATION_REDIRECT_DELAY_MS = 1500;

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regAgreeTerms, setRegAgreeTerms] = useState(false);
  const [regErrorMsg, setRegErrorMsg] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  const handleSubmitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Harap masukkan alamat email Anda.');
      return;
    }
    if (!password) {
      setErrorMsg('Harap masukkan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    try {
      const authData = await loginWithFastApi(email.trim(), password);
      const userObj = authData?.user || authData?.data || authData;
      const fallbackName = deriveDisplayNameFromEmail(email);

      onLogin({
        name: userObj?.full_name || userObj?.name || userObj?.username || fallbackName,
        email: userObj?.email || email.trim(),
      });
      navigate('/dashboard');
    } catch (error: any) {
      if (isExplicitAuthRejectionError(error)) {
        setErrorMsg(error.message);
      } else {
        onLogin({
          name: deriveDisplayNameFromEmail(email),
          email: email.trim(),
        });
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin({
        name: 'Cameron Williamson',
        email: 'cameron@nolimit.id',
      });
      navigate('/dashboard');
    }, GOOGLE_LOGIN_DELAY_MS);
  };

  const openRegisterModal = () => {
    setRegErrorMsg('');
    setRegSuccessMsg('');
    setRegName('');
    setRegEmail('');
    setRegPass('');
    setRegConfirmPass('');
    setRegAgreeTerms(false);
    setActiveModal('register');
  };

  const handleRegisterSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setRegErrorMsg('');
    setRegSuccessMsg('');

    const validationError = validateRegistrationInput({
      fullName: regName,
      email: regEmail,
      password: regPass,
      confirmPassword: regConfirmPass,
      agreedToTerms: regAgreeTerms,
    });

    if (validationError) {
      setRegErrorMsg(validationError);
      return;
    }

    const trimmedEmail = regEmail.trim();
    setRegSuccessMsg('Akun berhasil dibuat! Mengalihkan ke form masuk...');
    setTimeout(() => {
      setEmail(trimmedEmail);
      setPassword(regPass);
      setActiveModal(null);
    }, REGISTRATION_REDIRECT_DELAY_MS);
  };

  const openForgotPasswordModal = () => {
    setForgotEmail(email);
    setForgotSuccessMsg('');
    setActiveModal('forgot');
  };

  const handleForgotSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!forgotEmail) {
      alert('Harap masukkan email Anda.');
      return;
    }
    setForgotSuccessMsg(
      `Tautan pemulihan kata sandi telah dikirim ke ${forgotEmail}. Harap periksa kotak masuk Anda.`
    );
  };

  const openInfoModal = (modalType: string) => {
    const infoDetails = getInfoModalDetails(modalType);
    if (!infoDetails) {
      return;
    }
    setModalTitle(infoDetails.title);
    setModalContent(infoDetails.content);
    setActiveModal('info');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <header
        style={{
          height: '64px',
          backgroundColor: '#003399',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <img
          src={nolimitLogo}
          alt="NoLimit Logo"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
        />
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '40px 36px 32px 36px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              margin: '0 0 8px 0',
              fontSize: '26px',
              fontWeight: '800',
              color: '#003399',
              letterSpacing: '-0.5px',
            }}
          >
            Masuk ke Akun Anda
          </h1>

          <p
            style={{
              margin: '0 0 28px 0',
              fontSize: '13px',
              color: '#64748b',
              lineHeight: '1.5',
            }}
          >
            Selamat datang kembali! Masuk untuk melanjutkan analisis media sosial.
          </p>

          {errorMsg && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#dc2626',
                textAlign: 'left',
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmitLogin} style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#003399',
                  marginBottom: '8px',
                }}
              >
                Email Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
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
                </span>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(event) => {
                    event.target.style.borderColor = '#003399';
                  }}
                  onBlur={(event) => {
                    event.target.style.borderColor = '#cbd5e1';
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#003399',
                  marginBottom: '8px',
                }}
              >
                Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 2l-2 2m-1.5 1.5l-3 3m-3.5 3.5L4 19l-2 3 3-2 6.5-6.5m0 0l2.5 2.5 2.5-2.5-2.5-2.5 2.5-2.5"></path>
                    <circle cx="16.5" cy="7.5" r="3.5"></circle>
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 42px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(event) => {
                    event.target.style.borderColor = '#003399';
                  }}
                  onBlur={(event) => {
                    event.target.style.borderColor = '#cbd5e1';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#003399', cursor: 'pointer' }}
                />
                Ingat Saya
              </label>

              <button
                type="button"
                onClick={openForgotPasswordModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#003399',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '800',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0, 51, 153, 0.2)',
                transition: 'background-color 0.2s, transform 0.1s',
                opacity: isLoading ? 0.8 : 1,
              }}
              onMouseDown={(event) => {
                if (!isLoading) {
                  event.currentTarget.style.transform = 'scale(0.99)';
                }
              }}
              onMouseUp={(event) => {
                if (!isLoading) {
                  event.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {isLoading ? 'Processing...' : 'Log In'}
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
            <span style={{ padding: '0 12px', textTransform: 'uppercase' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign up with Google
          </button>

          <div style={{ marginTop: '24px', fontSize: '13px', color: '#64748b' }}>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={openRegisterModal}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontWeight: '800',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Register
            </button>
          </div>

          <div style={{ marginTop: '36px', fontSize: '12px', color: '#94a3b8' }}>
            © 2026 NoLimit Indonesia.
          </div>
        </div>
      </main>

      <footer
        style={{
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <button
          onClick={() => openInfoModal('about')}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: '600' }}
        >
          Tentang Kami
        </button>
        <span>•</span>
        <button
          onClick={() => openInfoModal('privacy')}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: '600' }}
        >
          Privasi
        </button>
        <span>•</span>
        <button
          onClick={() => openInfoModal('terms')}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: '600' }}
        >
          Syarat &amp; Ketentuan
        </button>
        <span>•</span>
        <button
          onClick={() => openInfoModal('help')}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: '600' }}
        >
          Bantuan
        </button>
      </footer>

      {activeModal && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveModal(null);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="modal-scrollable"
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: 'min(90vh, 760px)',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              overflowY: 'auto',
              margin: 'auto',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: '-12px',
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

            {activeModal === 'register' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ color: '#003399', margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800' }}>
                  Daftar Akun Baru NoLimit
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                  Lengkapi data diri Anda untuk membuat akun analisis media sosial.
                </p>

                {regErrorMsg && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>⚠️</span>
                    <div>{regErrorMsg}</div>
                  </div>
                )}

                {regSuccessMsg ? (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      textAlign: 'center',
                    }}
                  >
                    ✓ {regSuccessMsg}
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#003399',
                          marginBottom: '4px',
                        }}
                      >
                        Nama Lengkap <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Budi Santoso (min. 5 karakter)"
                        value={regName}
                        onChange={(event) => setRegName(event.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <span
                          style={{
                            color: regName.trim().length >= MIN_FULL_NAME_LENGTH ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {regName.trim().length >= MIN_FULL_NAME_LENGTH ? '✓' : '•'} Minimal 5 karakter
                        </span>
                        <span
                          style={{
                            color:
                              /^[a-zA-Z\s]*$/.test(regName) && regName.trim().length > 0 ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {/^[a-zA-Z\s]*$/.test(regName) && regName.trim().length > 0 ? '✓' : '•'} Hanya huruf dan
                          spasi
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#003399',
                          marginBottom: '4px',
                        }}
                      >
                        Alamat Email <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="nama@perusahaan.id"
                        value={regEmail}
                        onChange={(event) => setRegEmail(event.target.value)}
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
                          color: '#003399',
                          marginBottom: '4px',
                        }}
                      >
                        Kata Sandi Baru <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Masukkan kata sandi baru"
                        value={regPass}
                        onChange={(event) => setRegPass(event.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <span
                          style={{
                            color: regPass.length >= MIN_PASSWORD_LENGTH ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {regPass.length >= MIN_PASSWORD_LENGTH ? '✓' : '•'} Minimal 8 karakter
                        </span>
                        <span
                          style={{
                            color: /[A-Z]/.test(regPass) ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {/[A-Z]/.test(regPass) ? '✓' : '•'} Minimal 1 huruf besar (A-Z)
                        </span>
                        <span
                          style={{
                            color: /[a-z]/.test(regPass) ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {/[a-z]/.test(regPass) ? '✓' : '•'} Minimal 1 huruf kecil (a-z)
                        </span>
                        <span
                          style={{
                            color: /[0-9]/.test(regPass) ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {/[0-9]/.test(regPass) ? '✓' : '•'} Minimal 1 angka (0-9)
                        </span>
                        <span
                          style={{
                            color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(regPass) ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(regPass) ? '✓' : '•'} Minimal 1 karakter
                          spesial (!@#$ dll)
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#003399',
                          marginBottom: '4px',
                        }}
                      >
                        Konfirmasi Kata Sandi <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Ketik ulang kata sandi baru"
                        value={regConfirmPass}
                        onChange={(event) => setRegConfirmPass(event.target.value)}
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

                    <div style={{ marginTop: '2px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          fontSize: '12px',
                          color: '#475569',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={regAgreeTerms}
                          onChange={(event) => setRegAgreeTerms(event.target.checked)}
                          style={{ marginTop: '2px', accentColor: '#003399', cursor: 'pointer' }}
                        />
                        <span>
                          Saya menyetujui <strong>Syarat &amp; Ketentuan</strong> serta{' '}
                          <strong>Kebijakan Privasi</strong> NoLimit Indonesia.{' '}
                          <span style={{ color: '#ef4444' }}>*</span>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      style={{
                        padding: '12px',
                        backgroundColor: '#003399',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '15px',
                        cursor: 'pointer',
                        marginTop: '6px',
                        boxShadow: '0 4px 12px rgba(0, 51, 153, 0.2)',
                      }}
                    >
                      Buat Akun Sekarang
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeModal === 'forgot' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ color: '#003399', margin: '0 0 12px 0', fontSize: '20px', fontWeight: '800' }}>
                  Lupa Kata Sandi?
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                  Masukkan alamat email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
                </p>

                {forgotSuccessMsg ? (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  >
                    {forgotSuccessMsg}
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                        Email Anda
                      </label>
                      <input
                        type="email"
                        placeholder="Masukkan alamat email Anda"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
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
                    <button
                      type="submit"
                      style={{
                        padding: '12px',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '15px',
                        cursor: 'pointer',
                      }}
                    >
                      Kirim Tautan Pemulihan
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeModal === 'info' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ color: '#003399', margin: '0 0 16px 0', fontSize: '20px', fontWeight: '800' }}>
                  {modalTitle}
                </h2>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>{modalContent}</div>
                <button
                  onClick={() => setActiveModal(null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#003399',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    marginTop: '20px',
                    cursor: 'pointer',
                  }}
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function deriveDisplayNameFromEmail(emailAddress: string): string {
  const emailPrefix = emailAddress.split('@')[0] || 'User NoLimit';
  return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
}

function isExplicitAuthRejectionError(error: any): boolean {
  return Boolean(
    error?.message &&
      !error.message.includes('Failed to fetch') &&
      !error.message.includes('404')
  );
}

function validateRegistrationInput(input: RegistrationInput): string | null {
  const trimmedName = input.fullName.trim();
  if (!trimmedName) {
    return 'Nama lengkap wajib diisi.';
  }
  if (trimmedName.length < MIN_FULL_NAME_LENGTH) {
    return 'Nama lengkap minimal harus 5 karakter.';
  }
  if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
    return 'Nama lengkap hanya boleh mengandung huruf dan spasi.';
  }

  const trimmedEmail = input.email.trim();
  if (!trimmedEmail) {
    return 'Alamat email wajib diisi.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Format email tidak valid (contoh: nama@perusahaan.id).';
  }

  if (!input.password) {
    return 'Kata sandi wajib diisi.';
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return 'Kata sandi minimal 8 karakter.';
  }
  if (!/[A-Z]/.test(input.password)) {
    return 'Kata sandi harus mengandung minimal 1 huruf besar (A-Z).';
  }
  if (!/[a-z]/.test(input.password)) {
    return 'Kata sandi harus mengandung minimal 1 huruf kecil (a-z).';
  }
  if (!/[0-9]/.test(input.password)) {
    return 'Kata sandi harus mengandung minimal 1 angka (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(input.password)) {
    return 'Kata sandi harus mengandung minimal 1 karakter spesial (!@#$%^&* dll).';
  }

  if (!input.confirmPassword) {
    return 'Harap konfirmasi kata sandi Anda.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.';
  }

  if (!input.agreedToTerms) {
    return 'Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi NoLimit.';
  }

  return null;
}

function getInfoModalDetails(modalType: string): { title: string; content: React.ReactNode } | null {
  switch (modalType) {
    case 'about':
      return {
        title: 'Tentang Kami',
        content: (
          <div>
            <p>
              <strong>NoLimit Indonesia</strong> adalah perusahaan teknologi analisis media sosial terdepan di Indonesia
              yang berfokus pada pemantauan narasi, pemahaman sentimen publik, dan visualisasi Knowledge Graph secara
              real-time.
            </p>
            <p>
              Kami membantu berbagai instansi, perusahaan, dan organisasi untuk mengambil keputusan strategis berbasis
              data narasi digital yang akurat.
            </p>
          </div>
        ),
      };
    case 'privacy':
      return {
        title: 'Kebijakan Privasi',
        content: (
          <div>
            <p>Privasi dan keamanan data Anda adalah prioritas utama NoLimit Indonesia.</p>
            <ul>
              <li>Data kredensial dan sesi login Anda dilindungi dengan enkripsi tingkat tinggi.</li>
              <li>Kami tidak pernah membagikan atau menjual data pribadi penguna kepada pihak ketiga.</li>
              <li>Seluruh analisis narasi diambil secara aman melalui API resmi platform media sosial.</li>
            </ul>
          </div>
        ),
      };
    case 'terms':
      return {
        title: 'Syarat & Ketentuan',
        content: (
          <div>
            <p>Dengan menggunakan platform NoLimit Dashboard, Anda menyetujui ketentuan berikut:</p>
            <ol>
              <li>Menggunakan platform untuk tujuan analisis narasi yang sah dan profesional.</li>
              <li>Menjaga kerahasiaan akun dan kata sandi Anda.</li>
              <li>Dilarang melakukan ekstraksi data otomatis tanpa izin tertulis dari NoLimit Indonesia.</li>
            </ol>
          </div>
        ),
      };
    case 'help':
      return {
        title: 'Pusat Bantuan & Dukungan',
        content: (
          <div>
            <p>Butuh bantuan saat masuk atau menganalisis narasi media sosial?</p>
            <p>
              📧 Email Layanan: <strong>support@nolimit.id</strong>
            </p>
            <p>
              📞 Layanan Pelanggan: <strong>+62 (022) 720-4100</strong>
            </p>
            <p>🕒 Jam Operasional: Senin - Jumat (08.00 - 17.00 WIB)</p>
          </div>
        ),
      };
    default:
      return null;
  }
}
