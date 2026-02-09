import React, { ReactElement } from 'react';
import { render, RenderOptions, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { HashRouter } from 'react-router-dom';

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HashRouter>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </HashRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export { customRender as render, screen, fireEvent, waitFor };
