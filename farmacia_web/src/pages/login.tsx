import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../components/lib/supabase';
import { ADMIN_EMAILS, clearSession, DEMO_CREDENTIALS, saveSession } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const emailLower = email.trim().toLowerCase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password,
      });

      if (authError) {
        throw authError;
      }

      let nombre = data.user?.user_metadata?.nombre ?? data.user?.email?.split('@')[0] ?? 'Usuario';
      let role: 'admin' | 'staff' = ADMIN_EMAILS.includes(emailLower) || emailLower === DEMO_CREDENTIALS.email ? 'admin' : 'staff';

      try {
        const perfilQuery = supabase.from('perfiles').select('nombre_completo, rol').eq('id', data.user?.id ?? '').maybeSingle();
        const { data: perfilData, error: perfilError } = await perfilQuery;

        if (!perfilError && perfilData) {
          nombre = perfilData.nombre_completo || nombre;
          role = (perfilData.rol === 'Administrador' || perfilData.rol === 'admin' || perfilData.rol === 'Admin') ? 'admin' : 'staff';
        }
      } catch {
        try {
          const fallbackQuery = supabase.from('profiles').select('nombre, role').eq('id', data.user?.id ?? '').maybeSingle();
          const { data: fallbackData, error: fallbackError } = await fallbackQuery;

          if (!fallbackError && fallbackData) {
            nombre = fallbackData.nombre || nombre;
            role = (fallbackData.role === 'Administrador' || fallbackData.role === 'admin' || fallbackData.role === 'Admin') ? 'admin' : 'staff';
          }
        } catch {
          // La tabla de perfiles puede no existir todavía; dejamos el rol local.
        }
      }

      if (data.user?.email && ADMIN_EMAILS.includes(data.user.email.toLowerCase())) {
        role = 'admin';
      }

      clearSession();
      saveSession({
        email: data.user?.email ?? emailLower,
        nombre,
        loggedInAt: new Date().toISOString(),
        role,
        userId: data.user?.id ?? null,
      });

      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar sesión con Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#14532d,_#020617_55%)] text-white flex items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-emerald-400/20 bg-slate-900/70 shadow-[0_25px_100px_-30px_rgba(16,185,129,0.7)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-500 to-lime-400 p-8 text-slate-950 sm:p-10">
          <div>
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/75 text-3xl shadow-lg">💊</div>
            <div className="mb-4 inline-flex rounded-full bg-slate-950/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em]">Sistema interno</div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">FARMACIA DORIA</h1>
            <p className="mt-4 max-w-md text-base font-medium text-slate-900/80">
              Gestiona ventas, stock y operaciones del negocio desde un acceso seguro y moderno.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/70 p-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Ventas</div>
              <div className="mt-2 text-2xl font-black">POS</div>
            </div>
            <div className="rounded-2xl bg-white/70 p-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Inventario</div>
              <div className="mt-2 text-2xl font-black">Stock</div>
            </div>
            <div className="rounded-2xl bg-white/70 p-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Control</div>
              <div className="mt-2 text-2xl font-black">Real-time</div>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">Acceso</p>
            <h2 className="mt-2 text-2xl font-black text-white">Iniciar sesión</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Correo</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                placeholder="correo@tuempresa.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Contraseña</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 pr-12 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-sm font-bold text-emerald-300 hover:text-emerald-200"
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            <p className="font-semibold">Acceso seguro</p>
            <p className="mt-1 text-emerald-100/90">Ingresa tu correo y contraseña para continuar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
