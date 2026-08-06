'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../components/lib/supabase';
import { useCart } from '../hooks/useCart';

// 1. Definimos la interfaz EXACTA de tu base de datos
interface ProductoReal {
    id: number;
    ref: string;
    nombre: string;
    precio_con_impuesto: number;
    stock?: number;
}

export default function POSPage() {
    // Iniciamos con un array totalmente vacío
    const [productos, setProductos] = useState<ProductoReal[]>([]);
    const [busqueda, setBusqueda] = useState('');
    const [estado, setEstado] = useState<'cargando' | 'error' | 'listo'>('cargando');
    const [mensajeError, setMensajeError] = useState('');

    const { agregarProducto } = useCart();

    const [updatingIds, setUpdatingIds] = useState<number[]>([]);

    const traerDatosDeSupabase = async () => {
        setEstado('cargando');
        try {
            // Intentamos la conexión pura
            const { data, error } = await supabase.from('productos').select('*');

            if (error) throw error;

            if (data && data.length > 0) {
                setProductos(data);
                setEstado('listo');
            } else {
                setMensajeError("La tabla está vacía o el RLS sigue activo en Supabase.");
                setEstado('error');
            }
        } catch (err: any) {
            setMensajeError(err.message);
            setEstado('error');
        }
    };

    const normalize = (s: any) => {
        if (s === null || s === undefined) return '';
        return String(s)
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    };

    const productosFiltrados = (() => {
        const q = normalize(busqueda || '');
        if (!q) return productos;
        const tokens = q.split(/\s+/).filter(Boolean);
        return productos.filter((p) => {
            const hay = normalize(`${p.nombre || ''} ${p.ref || ''} ${p.precio_con_impuesto ?? ''} ${p.stock ?? ''}`);
            return tokens.every(t => hay.includes(t));
        });
    })();

    const changeStock = async (id: number, delta: number) => {
        if (updatingIds.includes(id)) return;
        setUpdatingIds((s) => [...s, id]);
        try {
            const producto = productos.find((p) => p.id === id);
            const current = Number(producto?.stock || 0);
            const nueva = Math.max(0, current + delta);

            const { data, error } = await supabase
                .from('productos')
                .update({ stock: nueva })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, stock: data.stock } : p)));
        } catch (err: any) {
            setMensajeError(err?.message || JSON.stringify(err));
            setEstado('error');
        } finally {
            setUpdatingIds((s) => s.filter((x) => x !== id));
        }
    };

    const handleAgregarAlCarrito = (producto: ProductoReal) => {
        agregarProducto({ ...producto, pVenta: producto.precio_con_impuesto });
    };

    useEffect(() => {
        traerDatosDeSupabase();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between items-start mb-10 border-b pb-6 gap-4">
                    <div className="flex-1">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                            CONEXIÓN DIRECTA: <span className="text-emerald-600 uppercase">Supabase</span>
                        </h1>
                        <div className="mt-4 sm:mt-2 max-w-md">
                            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, ref, precio o stock..." className="w-full border rounded-lg p-2" />
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        <button
                            onClick={traerDatosDeSupabase}
                            className="bg-slate-900 text-white px-6 py-2 rounded-full font-bold hover:bg-emerald-600 transition-all shadow-lg"
                        >
                            🔄 RECARGAR BASE DE DATOS
                        </button>
                    </div>
                </div>

                {/* PANTALLA DE CARGA */}
                {estado === 'cargando' && (
                    <div className="text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600 mb-4"></div>
                        <p className="text-slate-500 font-medium">Buscando productos reales en la nube...</p>
                    </div>
                )}

                {/* PANTALLA DE ERROR */}
                {estado === 'error' && (
                    <div className="bg-red-50 border-2 border-red-200 p-8 rounded-[2rem] text-center">
                        <span className="text-4xl mb-4 block">⚠️</span>
                        <h2 className="text-red-800 font-black text-xl mb-2">NO SE PUDIERON TRAER LOS DATOS</h2>
                        <p className="text-red-600 mb-6">{mensajeError}</p>
                        <p className="text-xs text-red-400 uppercase font-bold">
                            Revisa: 1. Tabla 'productos' en Supabase / 2. RLS desactivado / 3. URL de API correcta
                        </p>
                    </div>
                )}

                {/* TABLA DE DATOS REALES (SIN DISEÑO DE "TARJETAS DE EJEMPLO") */}
                {estado === 'listo' && (
                    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white uppercase text-xs tracking-widest">
                                    <th className="p-5">Ref / EAN</th>
                                    <th className="p-5">Producto</th>
                                    <th className="p-5">Stock</th>
                                    <th className="p-5 text-right">Precio Final</th>
                                    <th className="p-5">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {productosFiltrados.map((p) => (
                                    <tr key={p.id} className="transition-colors bg-emerald-800 text-white hover:bg-emerald-700">
                                        <td className="p-5 font-mono text-white text-sm">{p.ref}</td>
                                        <td className="p-5 font-black text-white">{p.nombre}</td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${Number(p.stock) > 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                                                {p.stock || 0} pzas
                                            </span>
                                        </td>
                                        <td className="p-5 text-right font-black text-xl text-white">
                                            ${Number(p.precio_con_impuesto).toFixed(2)}
                                        </td>
                                        <td className="p-5 flex gap-2">
                                            <button
                                                onClick={() => changeStock(p.id, 1)}
                                                disabled={updatingIds.includes(p.id)}
                                                className="bg-white/10 text-white px-3 py-1 rounded-md text-sm font-bold hover:bg-white/20 disabled:opacity-50"
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={() => changeStock(p.id, -1)}
                                                disabled={updatingIds.includes(p.id) || (p.stock || 0) <= 0}
                                                className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                                            >
                                                -
                                            </button>
                                            <button
                                                onClick={() => handleAgregarAlCarrito(p)}
                                                className="bg-white/10 text-white px-3 py-1 rounded-md text-sm font-bold hover:bg-white/20"
                                            >
                                                Agregar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}