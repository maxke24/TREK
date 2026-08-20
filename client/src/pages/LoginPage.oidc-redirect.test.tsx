import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '../../tests/helpers/render';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores } from '../../tests/helpers/store';
import LoginPage from './LoginPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('LoginPage — OIDC redirect preservation', () => {
  let savedLocation: Location;

  beforeEach(() => {
    resetAllStores();
    mockNavigate.mockClear();
    sessionStorage.clear();
    savedLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: savedLocation,
    });
  });

  function setSearch(search: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, search },
    });
  }

  describe('FE-PAGE-LOGIN-022: redirect param stashed in sessionStorage on mount', () => {
    it('saves decoded redirect to sessionStorage when ?redirect= is present', async () => {
      setSearch('?redirect=%2Foauth%2Fconsent%3Fclient_id%3Dfoo');
      render(<LoginPage />);

      await waitFor(() => {
        expect(sessionStorage.getItem('oidc_redirect')).toBe('/oauth/consent?client_id=foo');
      });
    });

    it('does not write to sessionStorage when no redirect param is present', async () => {
      render(<LoginPage />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
      });

      expect(sessionStorage.getItem('oidc_redirect')).toBeNull();
    });
  });

  describe('FE-PAGE-LOGIN-023: OIDC code exchange navigates to sessionStorage redirect', () => {
    beforeEach(() => {
      server.use(
          http.get('/api/auth/oidc/exchange', () =>
              HttpResponse.json({ token: 'mock-oidc-token' })
          ),
      );
    });

    it('navigates to the saved sessionStorage redirect after successful OIDC exchange', async () => {
      sessionStorage.setItem('oidc_redirect', '/oauth/consent?client_id=foo&state=xyz');
      setSearch('?oidc_code=testcode123');
      render(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
            '/oauth/consent?client_id=foo&state=xyz',
            { replace: true },
        );
      });

      expect(sessionStorage.getItem('oidc_redirect')).toBeNull();
    });

    it('falls back to /dashboard when no sessionStorage redirect is set', async () => {
      setSearch('?oidc_code=testcode123');
      render(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });

  describe('FE-PAGE-LOGIN-024: OIDC error clears sessionStorage redirect', () => {
    it('removes oidc_redirect from sessionStorage on OIDC error', async () => {
      sessionStorage.setItem('oidc_redirect', '/oauth/consent?client_id=foo');
      setSearch('?oidc_error=token_failed');
      render(<LoginPage />);

      await waitFor(() => {
        expect(sessionStorage.getItem('oidc_redirect')).toBeNull();
      });
    });
  });

  describe('FE-PAGE-LOGIN-026: OIDC auto-redirect suppressed in the Android shell', () => {
    afterEach(() => vi.unstubAllEnvs());

    // Spies on `window.location.href =` without letting jsdom attempt a real
    // navigation (which errors). Reads pass through to the real location so
    // anything else that happens to read it during the test keeps working.
    function mockLocationHref() {
      const hrefSetter = vi.fn();
      const original = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
          ...original,
          set href(value: string) {
            hrefSetter(value);
          },
          get href() {
            return original.href;
          },
        },
      });
      return hrefSetter;
    }

    const oidcOnlyConfig = {
      has_users: true,
      allow_registration: false,
      demo_mode: false,
      oidc_configured: true,
      oidc_only_mode: true,
      password_login: false,
      oidc_login: true,
      setup_complete: true,
    };

    it('does not navigate the webview to the OIDC endpoint when apiOrigin() is set', async () => {
      vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test');
      const hrefSetter = mockLocationHref();
      server.use(http.get('/api/auth/app-config', () => HttpResponse.json(oidcOnlyConfig)));

      render(<LoginPage />);

      // Give the app-config fetch + effect a tick to run.
      await waitFor(() => {
        expect(screen.getByText(/password authentication is disabled/i)).toBeInTheDocument();
      });

      expect(hrefSetter).not.toHaveBeenCalled();
    });

    it('still auto-redirects on the web build (apiOrigin() unset) — unchanged behavior', async () => {
      vi.stubEnv('VITE_TREK_ORIGIN', '');
      const hrefSetter = mockLocationHref();
      server.use(http.get('/api/auth/app-config', () => HttpResponse.json(oidcOnlyConfig)));

      render(<LoginPage />);

      await waitFor(() => {
        expect(hrefSetter).toHaveBeenCalledWith('/api/auth/oidc/login');
      });
    });
  });
});