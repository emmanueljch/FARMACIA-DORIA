export const AUTH_STORAGE_KEY = 'farmacia_web_session';

export const ADMIN_EMAILS = ['admin@farmacia.com', 'admin@gmail.com'];

export const DEMO_CREDENTIALS = {
  email: 'admin@farmacia.com',
  password: 'farmacia123',
  nombre: 'Administrador',
};

export type AuthRole = 'admin' | 'staff';

export type AuthSession = {
  email: string;
  nombre: string;
  loggedInAt: string;
  role: AuthRole;
  userId?: string | null;
};

export const normalizeRole = (value?: string | null): AuthRole => {
  const role = String(value ?? '').trim().toLowerCase();

  if (role === 'admin' || role === 'administrador' || role === 'superadmin') return 'admin';
  if (role === 'cajero' || role === 'cashier') return 'staff';
  return 'staff';
};

export const isAdminSession = (session?: AuthSession | null) => {
  const email = session?.email?.toLowerCase() ?? '';
  const role = String(session?.role ?? '').toLowerCase();
  return Boolean(
    role === 'admin' ||
    session?.role === 'admin' ||
    ADMIN_EMAILS.some((allowed) => allowed === email) ||
    email === DEMO_CREDENTIALS.email
  );
};

export const saveSession = (session: AuthSession) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const getSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const role = normalizeRole(parsed.role);
    return {
      email: parsed.email ?? '',
      nombre: parsed.nombre ?? 'Usuario',
      loggedInAt: parsed.loggedInAt ?? new Date().toISOString(),
      role,
      userId: parsed.userId ?? null,
    };
  } catch {
    return null;
  }
};

export const clearSession = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const validateCredentials = (email: string, password: string) => {
  return (
    email.trim().toLowerCase() === DEMO_CREDENTIALS.email &&
    password === DEMO_CREDENTIALS.password
  );
};
