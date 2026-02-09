import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
    const { login } = useAuth();
    const { language, t } = useLanguage();

    useEffect(() => {
        const remembered = localStorage.getItem('rememberedCredentials');
        if (remembered) {
            try {
                const { u, p } = JSON.parse(remembered);
                setUsername(u || '');
                setPassword(p || '');
                setRememberMe(true);
            } catch (e) {
                localStorage.removeItem('rememberedCredentials');
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username || !password) {
            setError(t('login.fillFields'));
            setLoading(false);
            return;
        }

        try {
            const { user, token } = await authApi.login({ username, password });
            login(user, token, rememberMe);
            if (rememberMe) {
                localStorage.setItem('rememberedCredentials', JSON.stringify({ u: username, p: password }));
            } else {
                localStorage.removeItem('rememberedCredentials');
            }
        } catch (err: any) {
            setError(err.message || t('login.invalidCredentials'));
        } finally {
            setLoading(false);
        }
    };

    const checkboxInputClass = "w-4 h-4 border-white/20 rounded bg-black/20 text-primary-600 focus:ring-primary-600 ring-offset-transparent cursor-pointer transition-all";
    const checkboxLabelClass = "ml-2 text-sm text-gray-300 cursor-pointer select-none hover:text-white transition-colors";

    return (
        <>
        <div 
            className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center"
            style={{
                backgroundImage: "url('https://d1wo7kaelp5eck.cloudfront.net/sunrise-resorts.com-1611976553/cms/cache/v2/65c24abee658d.jpg/1920x1080/fit/80/fbfe860fe26ef601e58afd7a34816316.jpg')"
            }}
        >
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
            
            {/* Logo */}
            <div className="relative z-10 text-center mb-10 flex flex-col items-center animate-fade-in-up">
                <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                    <path d="M50 10 L85 40 H15 Z" className="fill-primary-500" />
                    <path d="M40 90 L25 40 H75 L60 90 Z" className="fill-amber-400" />
                </svg>
                <h1 className="text-5xl font-bold font-sans text-white tracking-wider mt-4" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                    Sunrise
                </h1>
                <p className="text-lg font-sans text-primary-200 tracking-widest mt-2 uppercase" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>
                    Staff Housing
                </p>
            </div>


            {/* Login Form Container */}
            <div className="relative z-10 w-full max-w-sm bg-black/20 backdrop-blur-lg border border-white/20 rounded-lg shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-white text-center mb-8">{t('login.title')}</h2>
                    
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-300">
                                {t('login.username')}
                            </label>
                            <input
                                type="text"
                                name="username"
                                id="username"
                                className="bg-black/10 border border-white/20 text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 placeholder-gray-400 transition-all"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                aria-label={t('login.username')}
                            />
                        </div>
                        <div className="relative">
                            <label
                                htmlFor="password"
                                className="block mb-2 text-sm font-medium text-gray-300"
                            >
                                {t('login.password')}
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                id="password"
                                className="bg-black/10 border border-white/20 text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 placeholder-gray-400 transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                aria-label={t('login.password')}
                            />
                            
                            <div className="mt-3 flex items-center">
                                <input 
                                    id="show-password" 
                                    type="checkbox" 
                                    className={checkboxInputClass}
                                    checked={showPassword}
                                    onChange={(e) => setShowPassword(e.target.checked)}
                                />
                                <label htmlFor="show-password" className={checkboxLabelClass}>
                                    {language === 'ar' ? 'إظهار كلمة المرور' : 'Show Password'}
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input 
                                    id="remember" 
                                    aria-describedby="remember" 
                                    type="checkbox" 
                                    className={checkboxInputClass}
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <label htmlFor="remember" className={checkboxLabelClass}>
                                    {t('login.rememberMe')}
                                </label>
                            </div>
                            <button type="button" onClick={() => setIsForgotPasswordModalOpen(true)} className="text-sm font-medium text-primary-400 hover:underline">{t('login.forgotPassword')}</button>
                        </div>
                        
                        {error && <p className="text-sm text-red-400 text-center animate-pulse">{error}</p>}

                        <button
                            type="submit"
                            className="w-full text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-800 font-medium rounded-lg text-sm px-5 py-3 text-center disabled:opacity-60 transition-all duration-300 shadow-lg hover:shadow-primary-500/20 active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    {t('loading')}...
                                </>
                            ) : (
                                t('login.loginButton')
                            )}
                        </button>
                    </form>
                </div>
            </div>
            
            <footer className="absolute bottom-4 text-center w-full z-10">
                <p className="text-sm text-white/70">Implemented by: Mohamed Tarek</p>
            </footer>
        </div>
        {isForgotPasswordModalOpen && (
             <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                 <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center transform animate-fade-in-up">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900 mb-4">
                        <i className="fas fa-key text-2xl text-primary-600 dark:text-primary-400"></i>
                    </div>
                    <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-white mb-2">{t('login.forgotPasswordModal.title')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('login.forgotPasswordModal.message')}</p>
                    <button
                        type="button"
                        onClick={() => setIsForgotPasswordModalOpen(false)}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold"
                    >
                        {t('login.forgotPasswordModal.close')}
                    </button>
                 </div>
            </div>
        )}
        </>
    );
};

export default LoginPage;
