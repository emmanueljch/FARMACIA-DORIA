import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../components/lib/supabase';
import { useCart } from '../hooks/useCart';
import { TicketDoria } from '../components/pos/Ticket';
import { clearSession, getSession, isAdminSession } from '../lib/auth';

export default function FarmaciaPro() {
    const router = useRouter();
    const [autenticado, setAutenticado] = useState(false);

    // --- ESTADOS GLOBALES ---
    const [vistaActual, setVistaActual] = useState("Ventas");
    const [busqueda, setBusqueda] = useState("");
    const [pagoCon, setPagoCon] = useState<number>(0);
    const [pagoConInput, setPagoConInput] = useState<string>('');

    // Ref para el input de pago para preservar foco y selección
    const pagoInputRef = useRef<HTMLInputElement | null>(null);
    // --- ESTADOS DE BASE DE DATOS ---
    const [productos, setProductos] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [errorBD, setErrorBD] = useState<string | null>(null);

    const { carrito, agregarProducto, total, limpiarCarrito } = useCart();

    // Modal / Form para crear/editar productos
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formRefVal, setFormRefVal] = useState('');
    const [formNombre, setFormNombre] = useState('');
    const [formPrecio, setFormPrecio] = useState<string>('0');
    const [formStock, setFormStock] = useState<string>('0');
    // Carga masiva CSV
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [cargaMasivaCargando, setCargaMasivaCargando] = useState(false);
    const [cargaMasivaMsg, setCargaMasivaMsg] = useState<string | null>(null);

    const [ventas, setVentas] = useState<any[]>([]);
    const [lastSale, setLastSale] = useState<any | null>(null);
    const [mostrarTicketPreview, setMostrarTicketPreview] = useState(false);
    const ticketRef = useRef<HTMLDivElement | null>(null);
    const sesionActual = getSession();
    const esAdmin = isAdminSession(sesionActual);

    const cargarVentas = async () => {
        try {
            const { data, error } = await supabase
                .from('ventas')
                .select('*, detalle_ventas(*, productos(*))')
                .order('fecha', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const ventasFormateadas = data.map((v: any) => {
                    const detalles = Array.isArray(v.detalle_ventas) ? v.detalle_ventas : [];
                    const productosFormateados = detalles.map((d: any) => {
                        const prod = d.productos || {};
                        const cantidad = Number(d.cantidad || 0);
                        const precioUnitario = Number(d.precio_unitario || prod.precio_con_impuesto || 0);
                        const costo = Number(prod.costo || prod.precio || 0);

                        return {
                            id: d.producto_id || prod.id,
                            nombre: prod.nombre || 'Producto',
                            ref: prod.ref || '',
                            cantidad,
                            precio: costo,
                            precio_con_impuesto: precioUnitario,
                            pVenta: precioUnitario,
                            costo,
                            subtotal: Number(d.subtotal || precioUnitario * cantidad),
                        };
                    });

                    const totalVenta = Number(v.total || 0);
                    const gananciaTotal = productosFormateados.reduce((sum: number, item: any) => {
                        const costoItem = Number(item.costo || 0);
                        const ventaItem = Number(item.precio_con_impuesto || 0);
                        return sum + (ventaItem - costoItem) * Number(item.cantidad || 0);
                    }, 0);

                    const costoTotal = totalVenta - gananciaTotal;
                    const porcentaje = costoTotal > 0 ? (gananciaTotal / costoTotal) * 100 : 0;

                    return {
                        id: String(v.id),
                        folio: v.folio || `VENT-${v.id}`,
                        fecha: v.fecha || new Date().toISOString(),
                        productos: productosFormateados,
                        total: totalVenta,
                        ganancia: gananciaTotal,
                        porcentaje,
                        costo: costoTotal,
                        metodo_pago: v.metodo_pago || 'Efectivo',
                    };
                });

                setVentas(ventasFormateadas);
                window.localStorage.setItem('farmacia_ventas', JSON.stringify(ventasFormateadas));
                return;
            }
        } catch (err) {
            console.error('Error cargando ventas de Supabase, usando localStorage:', err);
        }

        const raw = window.localStorage.getItem('farmacia_ventas');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setVentas(parsed);
            } catch (err) {
                console.error('Error parseando ventas de localStorage', err);
            }
        }
    };

    const registrarVentaEnSupabase = async (venta: any, detalleVenta: any[]) => {
        const sessionActual = getSession();
        const folio = String(venta.folio ?? `VENT-${Date.now()}`);

        const ventaRow = {
            folio,
            vendedor_id: sessionActual?.userId ?? null,
            total: Number(venta.total || 0),
            metodo_pago: venta.metodo_pago ?? 'Efectivo',
            fecha: venta.fecha,
        };

        const { data: ventaGuardada, error: ventaError } = await supabase
            .from('ventas')
            .insert([ventaRow])
            .select()
            .single();

        if (ventaError) throw ventaError;

        const ventaId = ventaGuardada?.id ?? venta.id;

        if (detalleVenta.length > 0) {
            const rowDetalle = detalleVenta.map((item) => {
                const unitPrice = Number(item.precio_con_impuesto ?? item.pVenta ?? item.precio ?? 0);
                const cantidad = Number(item.cantidad || 0);

                return {
                    venta_id: ventaId,
                    producto_id: item.id ?? null,
                    cantidad,
                    precio_unitario: unitPrice,
                    subtotal: unitPrice * cantidad,
                };
            });

            const { error: detalleError } = await supabase.from('detalle_ventas').insert(rowDetalle);
            if (detalleError) throw detalleError;
        }

        return {
            ...venta,
            id: String(ventaId),
            folio,
            productos: detalleVenta.map((item) => ({
                ...item,
                cantidad: Number(item.cantidad || 0),
                nombre: item.nombre ?? 'Producto',
                precio_con_impuesto: Number(item.precio_con_impuesto ?? item.pVenta ?? item.precio ?? 0),
                pVenta: Number(item.pVenta ?? item.precio_con_impuesto ?? item.precio ?? 0),
            })),
        };
    };

    const actualizarStockTrasVenta = async (items: any[]) => {
        const productosPorId: Record<string, number> = {};

        items.forEach((item) => {
            const cantidad = Number(item.cantidad || 0);
            if (!cantidad || item?.id == null) return;

            const key = String(item.id);
            productosPorId[key] = (productosPorId[key] ?? 0) + cantidad;
        });

        const entradas = Object.entries(productosPorId);

        for (const [idProducto, cantidadTotal] of entradas) {
            const productoActual = productos.find((producto) => String(producto.id) === String(idProducto));

            if (!productoActual) {
                throw new Error(`No existe el producto con id ${idProducto} en la base de datos.`);
            }

            const stockActual = Number(productoActual.stock ?? 0);
            if (stockActual < cantidadTotal) {
                throw new Error(`No hay stock suficiente para ${productoActual.nombre || 'este producto'}. Disponible: ${stockActual}.`);
            }

            const nuevoStock = stockActual - cantidadTotal;

            const { data, error } = await supabase
                .from('productos')
                .update({ stock: nuevoStock })
                .eq('id', Number(idProducto))
                .select('id, stock')
                .single();

            if (error) {
                console.error('Error actualizando stock en Supabase:', error);
                throw new Error(error.message || 'No se pudo actualizar el stock en la base de datos.');
            }

            setProductos((prev) => prev.map((producto) =>
                String(producto.id) === String(idProducto) ? { ...producto, stock: data?.stock ?? nuevoStock } : producto
            ));
        }
    };

    const guardarVentas = (nuevasVentas: any[]) => {
        setVentas(nuevasVentas);
        window.localStorage.setItem('farmacia_ventas', JSON.stringify(nuevasVentas));
    };

    const normalizarVentaPreview = (venta: any, idx = 0) => {
        const productos = Array.isArray(venta?.productos) && venta.productos.length > 0
            ? venta.productos
            : Array.isArray(venta?.detalle_ventas)
                ? venta.detalle_ventas.map((detalle: any) => ({
                    id: detalle.producto_id ?? detalle.id,
                    nombre: detalle.nombre ?? detalle.producto_nombre ?? 'Producto',
                    cantidad: Number(detalle.cantidad ?? 1),
                    precio_con_impuesto: Number(detalle.precio_unitario ?? detalle.precio ?? detalle.pVenta ?? 0),
                    precio: Number(detalle.precio_unitario ?? detalle.precio ?? detalle.pVenta ?? 0),
                    pVenta: Number(detalle.precio_unitario ?? detalle.precio ?? detalle.pVenta ?? 0),
                    stock: Number(detalle.stock ?? 0),
                }))
                : [];

        return {
            ...venta,
            folio: venta?.folio ?? String(venta?.id ?? `VENT-${idx}`),
            productos,
            total: Number(venta?.total || 0),
            costo: Number(venta?.costo || 0),
            ganancia: Number(venta?.ganancia || 0),
            porcentaje: Number(venta?.porcentaje || 0),
            pago: Number(venta?.pago || 0),
            cambio: Number(venta?.cambio || 0),
            fecha: venta?.fecha ?? new Date().toISOString(),
        };
    };

    const ventasHoy = useMemo(() => {
        const hoy = new Date().toDateString();
        return ventas.filter((venta) => new Date(venta.fecha).toDateString() === hoy);
    }, [ventas]);

    const totalFacturadoHoy = useMemo(() => ventasHoy.reduce((sum, venta) => sum + Number(venta.total || 0), 0), [ventasHoy]);
    const gananciaHoy = useMemo(() => ventasHoy.reduce((sum, venta) => sum + Number(venta.ganancia || 0), 0), [ventasHoy]);
    const ventasSemanales = useMemo(() => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const datos: { dia: string; total: number; label: string }[] = [];

        for (let i = 6; i >= 0; i -= 1) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            const key = fecha.toISOString().slice(0, 10);
            const totalDia = ventas.reduce((sum, venta) => {
                const ventaFecha = new Date(venta.fecha);
                return ventaFecha.toISOString().slice(0, 10) === key ? sum + Number(venta.total || 0) : sum;
            }, 0);

            datos.push({
                dia: fecha.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''),
                total: totalDia,
                label: fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            });
        }

        const max = Math.max(...datos.map((item) => item.total), 1);
        return datos.map((item) => ({ ...item, altura: (item.total / max) * 100 }));
    }, [ventas]);

    // Calcular porcentaje de ganancia de hoy
    const porcentajeGananciaHoy = useMemo(() => {
        if (totalFacturadoHoy === 0) return 0;
        // Porcentaje = (Ganancia / Total Facturado) * 100
        return (gananciaHoy / totalFacturadoHoy) * 100;
    }, [gananciaHoy, totalFacturadoHoy]);

    // Calcular costo total de hoy
    const costoTotalHoy = useMemo(() => totalFacturadoHoy - gananciaHoy, [totalFacturadoHoy, gananciaHoy]);

    const getItemCosto = (item: any) => {
        return Number(item.precio ?? 0);
    };
    const getItemVenta = (item: any) => {
        return Number(item.pVenta ?? item.precio_con_impuesto ?? item.precio ?? 0);
    };

    // Calcular porcentaje de ganancia por item
    const getItemMarginPercentage = (item: any) => {
        const costo = getItemCosto(item);
        const venta = getItemVenta(item);
        if (costo === 0) return 0;
        return ((venta - costo) / costo) * 100;
    };

    const cargarProductos = async () => {
        setCargando(true);
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;
            if (data) setProductos(data);
        } catch (err: any) {
            console.error("Error cargando productos:", err.message);
            setErrorBD(err.message);
        } finally {
            setCargando(false);
        }
    };

    const printTicket = (sale = lastSale) => {
        if (!sale) return;
        setMostrarTicketPreview(false);
        setTimeout(() => window.print(), 50);
    };

    const renderTicketPreview = (sale: any) => (
        <TicketDoria
            fecha={sale?.fecha ?? ''}
            folio={sale?.folio ?? sale?.id ?? '---'}
            productos={sale?.productos ?? []}
            total={sale?.total ?? 0}
            pago={sale?.pago ?? 0}
            cambio={sale?.cambio ?? 0}
            ganancia={sale?.ganancia ?? 0}
            costo={sale?.costo ?? 0}
            porcentaje={sale?.porcentaje ?? 0}
        />
    );

    const openNewProductForm = () => {
        setEditingId(null);
        setFormRefVal('');
        setFormNombre('');
        setFormPrecio('0');
        setFormStock('0');
        setShowForm(true);
    };

    const openEditProductForm = (p: any) => {
        setEditingId(p.id ?? null);
        setFormRefVal(p.ref ?? '');
        setFormNombre(p.nombre ?? '');
        setFormPrecio(String(p.precio_con_impuesto ?? p.precio ?? 0));
        setFormStock(String(p.stock ?? 0));
        setShowForm(true);
    };

    const saveProduct = async () => {
        const precio = parseFloat((formPrecio || '0').toString().replace(/[^0-9.\-]/g, '')) || 0;
        const stock = parseInt((formStock || '0').toString().replace(/[^0-9\-]/g, '')) || 0;

        try {
            if (editingId == null) {
                const { data, error } = await (supabase as any)
                    .from('productos')
                    .insert({ ref: formRefVal, nombre: formNombre, precio_con_impuesto: precio, stock })
                    .select()
                    .single();
                if (error) throw error;
                setProductos((s) => [...s, data].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
            } else {
                const { data, error } = await (supabase as any)
                    .from('productos')
                    .update({ ref: formRefVal, nombre: formNombre, precio_con_impuesto: precio, stock })
                    .eq('id', editingId)
                    .select()
                    .single();
                if (error) throw error;
                setProductos((prev) => prev.map((x) => (x.id === data.id ? data : x)));
            }
            setShowForm(false);
        } catch (err: any) {
            console.error('Error guardando producto:', err.message || err);
            alert('Error guardando producto: ' + (err.message || JSON.stringify(err)));
        }
    };

    const handleFileSelected = async (file: File) => {
        setCargaMasivaMsg(null);
        setCargaMasivaCargando(true);
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) {
                setCargaMasivaMsg('Archivo vacío o sin líneas válidas.');
                return;
            }

            const firstCols = lines[0].split(',').map(h => h.trim().toLowerCase());
            const hasHeader = firstCols.some(h => ['ref', 'nombre', 'precio', 'stock'].some(k => h.includes(k)));
            const header = hasHeader ? firstCols : [];
            const rows = hasHeader ? lines.slice(1) : lines;

            const records: any[] = rows.map(r => {
                const cols = r.split(',').map(c => c.trim());
                const getVal = (key: string) => {
                    if (hasHeader) {
                        const idx = header.findIndex(h => h.includes(key));
                        return idx >= 0 ? (cols[idx] ?? '') : '';
                    }
                    const mapIdx: any = { ref: 0, nombre: 1, precio: 2, stock: 3 };
                    return cols[mapIdx[key]] ?? '';
                };

                const ref = getVal('ref');
                const nombre = getVal('nombre');
                const precio = parseFloat((getVal('precio') || '0').replace(/[^0-9.\-]/g, '')) || 0;
                const stock = parseInt((getVal('stock') || '0').replace(/[^0-9\-]/g, '')) || 0;

                return { ref, nombre, precio_con_impuesto: precio, stock };
            }).filter(r => (r.nombre || r.ref));

            if (records.length === 0) {
                setCargaMasivaMsg('No se encontraron registros válidos en el CSV.');
                return;
            }

            const { data, error } = await (supabase as any)
                .from('productos')
                .upsert(records, { onConflict: 'ref' })
                .select();

            if (error) throw error;

            // Actualizar estado local de productos
            const inserted = data ?? [];
            setProductos(prev => {
                // Remover aquellos con misma ref y añadir los insertados
                const filtered = prev.filter(p => !inserted.some((ins: any) => ins.ref === p.ref));
                return [...filtered, ...inserted].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            });

            setCargaMasivaMsg(`Importados ${inserted.length} registros correctamente.`);
        } catch (err: any) {
            console.error('Error en carga masiva:', err.message || err);
            setCargaMasivaMsg('Error subiendo CSV: ' + (err.message || JSON.stringify(err)));
        } finally {
            setCargaMasivaCargando(false);
        }
    };

    useEffect(() => {
        const session = getSession();

        if (!session) {
            router.replace('/login');
            return;
        }

        setAutenticado(true);
        cargarProductos();
        cargarVentas();
    }, [router]);

    const handleLogout = () => {
        clearSession();
        router.replace('/login');
    };

    if (!autenticado) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-500 mb-4"></div>
                    <p className="text-slate-300">Validando sesión...</p>
                </div>
            </div>
        );
    }

    // --- LÓGICA DE CÁLCULOS ---
    const normalize = (s: any) => {
        if (s === null || s === undefined) return '';
        return String(s)
            .toLowerCase()
            .normalize('NFD')
            // Reemplaza marcas diacríticas usando el rango Unicode de combinantes
            .replace(/[\u0300-\u036f]/g, '')
            // Tras normalizar y quitar diacríticos, limitar a letras ascii y números
            .replace(/[^a-z0-9]+/g, ' ')
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

    const formatMoneyInput = (value: string) => {
        const cleaned = value.replace(/[^0-9.]/g, '');
        if (!cleaned) return '';

        const [whole, ...rest] = cleaned.split('.');
        const normalized = rest.length > 0 ? `${whole || '0'}.${rest.join('')}` : whole || '0';
        return normalized;
    };

    const parsedPago = (() => {
        const cleaned = formatMoneyInput(pagoConInput || '');
        const n = parseFloat(cleaned);
        return !isNaN(n) ? n : (pagoCon || 0);
    })();
    const cambio = parsedPago > 0 ? Math.max(0, parsedPago - total) : 0;

    // ==========================================
    // VISTA: VENTAS (POS)
    // ==========================================
    const VentasView = () => (
        <div className="flex flex-1 gap-6 overflow-hidden">
            {/* IZQUIERDA: TARJETAS */}
            <div className="flex-[2] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2 content-start">
                {cargando && <p className="col-span-full text-center py-10">Cargando base de datos...</p>}
                {errorBD && <p className="col-span-full text-center py-10 text-red-500">Error: {errorBD}</p>}
                {!cargando && productosFiltrados.length === 0 && <p className="col-span-full text-center py-10 text-slate-400">No hay productos disponibles.</p>}
                
                {productosFiltrados.map((p) => {
                    const costo = getItemCosto(p);
                    const stockActual = Number(p.stock || 0);
                    return (
                        <div key={p.id} onClick={() => agregarProducto(p)} className="bg-emerald-800 text-white p-5 rounded-[2.5rem] shadow-md border border-emerald-700 hover:border-emerald-500 transition-all cursor-pointer group overflow-hidden relative">
                            <div className="absolute top-4 right-6 text-[10px] font-mono text-white/70">{p.ref}</div>
                            <div className="w-full h-24 bg-white/10 rounded-3xl mb-4 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                                💊
                            </div>
                            <h3 className="font-bold text-white uppercase text-sm leading-tight min-h-[2.5rem] mb-2">{p.nombre}</h3>
                            <p className="text-[10px] text-white/80 mb-2">Genérico</p>
                            <div className="space-y-1 mb-2 text-[10px]">
                                <div className="flex justify-between">
                                    <span className="text-white/70">Costo:</span>
                                    <span className="text-white">${costo.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/70">Venta:</span>
                                    <span className="font-bold text-white">${Number(p.precio_con_impuesto).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${stockActual < 10 ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'}`}>
                                        Stock: {stockActual}
                                    </span>
                                </div>
                                <button className="bg-white/10 text-white p-3 rounded-xl hover:bg-white/20 transition-colors">＋</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* DERECHA: TICKET Y CAMBIO */}
            <aside className="flex-1 flex flex-col gap-4 h-full">
                <div className="bg-white rounded-[2.5rem] shadow-xl p-8 flex flex-col border border-slate-100 flex-[1_1_60%] min-h-0">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-slate-800">Ticket</h2>
                        <button onClick={limpiarCarrito} className="text-xs text-red-400 font-bold hover:underline">Vaciar</button>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 min-h-0">
                        {carrito.length === 0 && <p className="text-slate-400 text-center text-sm py-10">Carrito vacío</p>}
                        {carrito.map((item, i) => (
                            <div key={i} className="flex justify-between items-center">
                                <div className="text-sm">
                                    <p className="font-bold text-slate-700">{item.nombre}</p>
                                    <p className="text-xs text-slate-400">{item.cantidad} x ${Number(item.precio_con_impuesto).toFixed(2)}</p>
                                </div>
                                <p className="font-black text-slate-800">${(item.cantidad * Number(item.precio_con_impuesto)).toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 pt-6 border-t border-dashed border-slate-200 space-y-3">
                        {carrito.length > 0 && (() => {
                            const costoCarrito = carrito.reduce((sum, item) => {
                                const costo = getItemCosto(item);
                                return sum + costo * Number(item.cantidad || 0);
                            }, 0);
                            const gananciaCarrito = total - costoCarrito;
                            const porcentajeCarrito = costoCarrito > 0 ? (gananciaCarrito / costoCarrito) * 100 : 0;
                            
                            return (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Costo Total:</span>
                                        <span className="font-bold text-slate-800">${costoCarrito.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Ganancia Est.:</span>
                                        <span className="font-bold text-emerald-600">${gananciaCarrito.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">% Ganancia:</span>
                                        <span className={`font-bold ${porcentajeCarrito > 50 ? 'text-emerald-600' : porcentajeCarrito > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {porcentajeCarrito.toFixed(2)}%
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                        <div className="border-t border-slate-200 pt-3 flex justify-between text-3xl font-black text-slate-900">
                            <span>Total</span>
                            <span className="text-emerald-600">${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl text-white space-y-4 mt-auto">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dinero Recibido</label>
                        <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-2xl border border-slate-700 focus-within:border-emerald-500 transition-all">
                            <span className="text-2xl font-bold text-emerald-500">$</span>
                            <input
                                ref={(el) => { pagoInputRef.current = el }}
                                type="text"
                                inputMode="decimal"
                                value={pagoConInput}
                                onChange={(e) => {
                                    const value = formatMoneyInput(e.target.value);
                                    setPagoConInput(value);
                                    setPagoCon(Number(value || 0));
                                }}
                                placeholder="0.00"
                                className="bg-transparent w-full text-2xl font-black outline-none text-white placeholder:text-slate-600"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                        <span className="text-slate-400 font-bold text-sm">Su Cambio:</span>
                        <span className={`text-3xl font-black ${cambio >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${cambio.toFixed(2)}
                        </span>
                    </div>
                    <button 
                        onClick={async () => {
                            if (carrito.length === 0) return alert("El carrito está vacío");

                            const stockInsuficiente = carrito.some((item) => {
                                const productoActual = productos.find((producto) => String(producto.id) === String(item.id));
                                const stockDisponible = Number(productoActual?.stock ?? item.stock ?? 0);
                                return stockDisponible < Number(item.cantidad || 0);
                            });

                            if (stockInsuficiente) {
                                alert('No hay stock suficiente para completar esta venta.');
                                return;
                            }

                            const fecha = new Date();
                            const pagoIngresado = parsedPago;
                            const cambioVenta = Math.max(0, pagoIngresado - total);
                            const gananciaVenta = carrito.reduce((sum, item) => {
                                const costo = getItemCosto(item);
                                const ventaItem = getItemVenta(item);
                                return sum + (ventaItem - costo) * Number(item.cantidad || 0);
                            }, 0);

                            const costoTotalVenta = total - gananciaVenta;
                            const porcentajeVenta = costoTotalVenta > 0 ? (gananciaVenta / costoTotalVenta) * 100 : 0;
                            const folioVenta = `VENT-${fecha.getTime()}`;

                            const ventaBase = {
                                id: `${fecha.getTime()}`,
                                folio: folioVenta,
                                fecha: fecha.toISOString(),
                                productos: carrito,
                                total,
                                ganancia: gananciaVenta,
                                porcentaje: porcentajeVenta,
                                costo: costoTotalVenta,
                                pago: pagoIngresado,
                                cambio: cambioVenta,
                                metodo_pago: 'Efectivo',
                            };

                            try {
                                await actualizarStockTrasVenta(carrito);
                                const ventaGuardada = await registrarVentaEnSupabase(ventaBase, carrito);
                                const ventaPersistida = {
                                    ...ventaGuardada,
                                    ...ventaBase,
                                    productos: carrito.map((item) => ({
                                        ...item,
                                        cantidad: Number(item.cantidad || 0),
                                        nombre: item.nombre ?? 'Producto',
                                        precio_con_impuesto: Number(item.precio_con_impuesto ?? item.pVenta ?? item.precio ?? 0),
                                        pVenta: Number(item.pVenta ?? item.precio_con_impuesto ?? item.precio ?? 0),
                                    })),
                                };
                                const nuevasVentas = [ventaPersistida, ...ventas];
                                guardarVentas(nuevasVentas);
                                setLastSale({ ...ventaPersistida, pago: pagoIngresado, cambio: cambioVenta });
                                setMostrarTicketPreview(true);
                                alert("✅ Venta realizada con éxito");
                            } catch (error: any) {
                                console.error('Error al guardar la venta:', error);
                                alert('❌ No se pudo completar la venta: ' + (error?.message || 'Error desconocido'));
                                return;
                            }

                            limpiarCarrito();
                            setPagoCon(0);
                            setPagoConInput('');
                        }}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-lg uppercase"
                    >
                        Finalizar Venta
                    </button>
                    {lastSale ? (
                        <>
                            <button
                                onClick={() => setMostrarTicketPreview(true)}
                                className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-lg uppercase"
                            >
                                Ver Ticket
                            </button>
                            <button
                                onClick={printTicket}
                                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-lg uppercase"
                            >
                                Imprimir Ticket
                            </button>
                        </>
                    ) : null}

                </div>
            </aside>
        </div>
    );

    // ==========================================
    // VISTA: INVENTARIO
    // ==========================================
    const InventarioView = () => (
        <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black">Control de Stock</h2>
                <button onClick={openNewProductForm} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all">+ Nuevo Producto</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
                {cargando && <p className="text-center py-10">Cargando inventario...</p>}
                {!cargando && (
                    <table className="w-full text-left border-collapse">
                        <thead>
                                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b">
                                <th className="p-4">Ref / Código</th>
                                <th className="p-4">Medicamento</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4">Precio Final</th>
                                <th className="p-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {productos.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-mono text-xs text-slate-500">{p.ref}</td>
                                    <td className="p-4 font-bold text-slate-700">{p.nombre}</td>
                                    <td className={`p-4 font-bold ${Number(p.stock || 0) < 10 ? 'text-red-500' : 'text-emerald-600'}`}>{p.stock || 0} pzas</td>
                                    <td className="p-4 font-black">${Number(p.precio_con_impuesto).toFixed(2)}</td>
                                    <td className="p-4 text-slate-400 cursor-pointer hover:text-blue-500" onClick={() => openEditProductForm(p)}>✏️ Editar</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );

    // ==========================================
    // RENDER PRINCIPAL (Layout)
    // ==========================================
    return (
        <div className="flex h-screen bg-[#f8fafc] font-sans antialiased text-slate-900">
            {/* SIDEBAR */}
            <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col transition-all">
                <div className="p-6">
                    <div className="bg-emerald-600 text-white p-3 rounded-2xl font-black text-center text-xl shadow-lg shadow-emerald-200">
                        F<span className="hidden lg:inline">armaciaPro</span>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    {[
                        'Ventas',
                        'Inventario',
                        'Carga Masiva',
                        ...(esAdmin ? ['Reportes'] : []),
                    ].map((item, i) => (
                        <div
                            key={item}
                            onClick={() => setVistaActual(item)}
                            className={`p-4 rounded-xl cursor-pointer font-bold flex items-center gap-3 transition-all ${vistaActual === item ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <span className="text-xl">{['🛒', '📦', '📤', '📊'][i]}</span>
                            <span className="hidden lg:inline">{item}</span>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* ÁREA DE TRABAJO */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-24 bg-white border-b border-slate-200 flex items-center px-8 gap-6">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{vistaActual}</h2>
                    <div className="flex-1 relative max-w-xl ml-auto">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="F1 - Buscar producto o escanear código..."
                            className="w-full bg-slate-100 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl py-3 pl-12 pr-6 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold transition-all"
                    >
                        Cerrar sesión
                    </button>
                </header>

                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                    {vistaActual === "Ventas" && <VentasView />}
                    {vistaActual === "Inventario" && <InventarioView />}
                    {vistaActual === "Carga Masiva" && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-full max-w-2xl p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100">
                                <h3 className="text-xl font-black mb-4">Carga Masiva CSV</h3>
                                <p className="text-sm text-slate-500 mb-4">Sube un archivo CSV con columnas: <span className="font-mono">ref,nombre,precio,stock</span>. Si el CSV tiene cabecera, se detectará automáticamente.</p>

                                <input
                                    ref={(el) => { fileInputRef.current = el }}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const f = e.target.files && e.target.files[0];
                                        if (f) {
                                            await handleFileSelected(f);
                                        }
                                        // limpiar para permitir subir el mismo archivo otra vez
                                        (e.target as HTMLInputElement).value = '';
                                    }}
                                />

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                                    >
                                        Subir CSV
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCargaMasivaMsg(null);
                                        }}
                                        className="px-4 py-3 rounded-xl border text-sm"
                                    >
                                        Limpiar mensajes
                                    </button>
                                </div>

                                <div className="mt-4">
                                    {cargaMasivaCargando && <p className="text-sm text-slate-500">Procesando archivo...</p>}
                                    {cargaMasivaMsg && <p className="text-sm text-slate-600 mt-2">{cargaMasivaMsg}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                    {vistaActual === "Reportes" && (
                        !esAdmin ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="max-w-lg bg-white rounded-[2rem] border border-slate-200 p-8 text-center shadow-sm">
                                    <p className="text-4xl mb-4">🔒</p>
                                    <h3 className="text-xl font-black text-slate-800">Acceso restringido</h3>
                                    <p className="mt-2 text-slate-500">Solo el administrador puede ver los reportes y la gráfica semanal.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto min-h-0">
                                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 pb-8">
                                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Ventas Hoy</p>
                                        <h3 className="text-4xl font-black text-emerald-600">${totalFacturadoHoy.toFixed(2)}</h3>
                                        <p className="mt-3 text-slate-500 text-sm">Ventas registradas: {ventasHoy.length}</p>
                                    </div>
                                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Costo Total Hoy</p>
                                        <h3 className="text-4xl font-black text-slate-700">${costoTotalHoy.toFixed(2)}</h3>
                                        <p className="mt-3 text-slate-500 text-sm">Costo de productos vendidos</p>
                                    </div>
                                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Ganancia Hoy</p>
                                        <h3 className="text-4xl font-black text-emerald-600">${gananciaHoy.toFixed(2)}</h3>
                                        <p className="mt-3 text-slate-500 text-sm">Ganancia neta del día</p>
                                    </div>
                                    <div className={`bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 ${porcentajeGananciaHoy > 50 ? 'border-emerald-300 bg-emerald-50' : porcentajeGananciaHoy > 30 ? 'border-yellow-300 bg-yellow-50' : 'border-red-300 bg-red-50'}`}>
                                        <p className="text-xs font-bold text-slate-400 uppercase">% Ganancia Hoy</p>
                                        <h3 className={`text-4xl font-black ${porcentajeGananciaHoy > 50 ? 'text-emerald-600' : porcentajeGananciaHoy > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {porcentajeGananciaHoy.toFixed(2)}%
                                        </h3>
                                        <p className="mt-3 text-slate-500 text-sm">Rentabilidad del día</p>
                                    </div>

                                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 xl:col-span-4">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-black text-slate-800">Ventas semanales</h3>
                                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Últimos 7 días</span>
                                        </div>
                                        <div className="h-52">
                                            <svg viewBox="0 0 560 180" className="w-full h-full">
                                                {[0, 1, 2, 3, 4].map((linea) => (
                                                    <line key={linea} x1="0" y1={30 + linea * 30} x2="560" y2={30 + linea * 30} stroke="#e2e8f0" strokeDasharray="4 8" />
                                                ))}
                                                {ventasSemanales.map((item, idx) => (
                                                    <g key={`${item.label}-${idx}`}>
                                                        <rect
                                                            x={20 + idx * 75}
                                                            y={150 - item.altura * 1.2}
                                                            width="40"
                                                            height={item.altura * 1.2}
                                                            rx="10"
                                                            fill={idx === ventasSemanales.length - 1 ? '#10b981' : '#34d399'}
                                                        />
                                                        <text x={40 + idx * 75} y="170" textAnchor="middle" fontSize="10" fill="#64748b">{item.dia}</text>
                                                        <text x={40 + idx * 75} y={140 - item.altura * 1.2} textAnchor="middle" fontSize="9" fill="#0f172a">${item.total.toFixed(0)}</text>
                                                    </g>
                                                ))}
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 xl:col-span-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-4">Última venta</p>
                                        {lastSale ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Folio</p>
                                                    <p className="text-lg font-black text-slate-800">#{lastSale.id.slice(-6)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Total</p>
                                                    <p className="text-lg font-black text-slate-800">${Number(lastSale.total).toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Costo</p>
                                                    <p className="text-lg font-black text-slate-800">${Number(lastSale.costo || 0).toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Ganancia</p>
                                                    <p className="text-lg font-black text-emerald-600">${Number(lastSale.ganancia).toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">% Ganancia</p>
                                                    <p className={`text-lg font-black ${Number(lastSale.porcentaje || 0) > 50 ? 'text-emerald-600' : Number(lastSale.porcentaje || 0) > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                        {Number(lastSale.porcentaje || 0).toFixed(2)}%
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Hora</p>
                                                    <p className="text-lg font-black text-slate-800">{new Date(lastSale.fecha).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-slate-500 text-sm">Aún no hay ventas registradas.</p>
                                        )}
                                    </div>

                                    {/* TABLA DETALLADA DE TODAS LAS VENTAS DEL DÍA */}
                                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 xl:col-span-4 p-10">
                                        <h3 className="text-lg font-black text-slate-800 mb-6">Detalles de Todas las Ventas del Día</h3>
                                        {ventasHoy.length === 0 ? (
                                            <p className="text-slate-500 text-sm text-center py-8">No hay ventas registradas para hoy</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="border-b-2 border-slate-200">
                                                        <tr>
                                                            <th className="text-left py-3 px-4 font-black text-slate-600">Folio</th>
                                                            <th className="text-left py-3 px-4 font-black text-slate-600">Hora</th>
                                                            <th className="text-right py-3 px-4 font-black text-slate-600">Costo</th>
                                                            <th className="text-right py-3 px-4 font-black text-slate-600">Total</th>
                                                            <th className="text-right py-3 px-4 font-black text-slate-600">Ganancia</th>
                                                            <th className="text-right py-3 px-4 font-black text-slate-600">%</th>
                                                            <th className="text-center py-3 px-4 font-black text-slate-600">Items</th>
                                                            <th className="text-center py-3 px-4 font-black text-slate-600">Ticket</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ventasHoy.map((venta, idx) => {
                                                            const productosVenta = Array.isArray(venta.productos) ? venta.productos : [];
                                                            const ventaPreview = normalizarVentaPreview(venta, idx);

                                                            return (
                                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                                    <td className="py-3 px-4 font-mono text-slate-700">#{String(venta.folio ?? venta.id).slice(-6)}</td>
                                                                    <td className="py-3 px-4 text-slate-600">{new Date(venta.fecha).toLocaleTimeString()}</td>
                                                                    <td className="py-3 px-4 text-right text-slate-700 font-bold">${Number(venta.costo || 0).toFixed(2)}</td>
                                                                    <td className="py-3 px-4 text-right text-slate-800 font-black">${Number(venta.total).toFixed(2)}</td>
                                                                    <td className="py-3 px-4 text-right font-black text-emerald-600">${Number(venta.ganancia).toFixed(2)}</td>
                                                                    <td className={`py-3 px-4 text-right font-black ${Number(venta.porcentaje || 0) > 50 ? 'text-emerald-600' : Number(venta.porcentaje || 0) > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                        {Number(venta.porcentaje || 0).toFixed(1)}%
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center text-slate-600 font-bold">{productosVenta.length}</td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setLastSale(ventaPreview);
                                                                                setMostrarTicketPreview(true);
                                                                            }}
                                                                            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                                                                        >
                                                                            Ver Ticket
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                                                        <tr className="text-slate-800 font-black">
                                                            <td className="py-4 px-4" colSpan={2}>TOTAL</td>
                                                            <td className="py-4 px-4 text-right">${costoTotalHoy.toFixed(2)}</td>
                                                            <td className="py-4 px-4 text-right">${totalFacturadoHoy.toFixed(2)}</td>
                                                            <td className="py-4 px-4 text-right text-emerald-600">${gananciaHoy.toFixed(2)}</td>
                                                            <td className={`py-4 px-4 text-right ${porcentajeGananciaHoy > 50 ? 'text-emerald-600' : porcentajeGananciaHoy > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                {porcentajeGananciaHoy.toFixed(1)}%
                                                            </td>
                                                            <td className="py-4 px-4 text-center">{ventasHoy.length}</td>
                                                            <td className="py-4 px-4 text-center">-</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </main>

            {mostrarTicketPreview && lastSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                    <div className="w-full max-w-4xl rounded-[2rem] bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-slate-800">Ticket y datos de la venta</h3>
                            <button
                                onClick={() => setMostrarTicketPreview(false)}
                                className="text-sm font-bold text-slate-500 hover:text-slate-800"
                            >
                                Cerrar
                            </button>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                            <div ref={ticketRef} className="border border-slate-200 rounded-2xl p-4 bg-white">
                                {renderTicketPreview(lastSale)}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <h4 className="text-sm font-black uppercase text-slate-500 mb-4">Datos de la venta</h4>
                                <div className="space-y-3 text-sm text-slate-700">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Folio</span>
                                        <span className="font-black text-slate-800">{lastSale?.folio ?? lastSale?.id ?? '---'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Fecha</span>
                                        <span className="font-bold">{new Date(lastSale?.fecha ?? Date.now()).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Total</span>
                                        <span className="font-black text-slate-800">${Number(lastSale?.total || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Pago</span>
                                        <span className="font-black text-emerald-600">${Number(lastSale?.pago ?? 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Cambio</span>
                                        <span className="font-black text-blue-600">${Number(lastSale?.cambio ?? 0).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-3 border-t border-slate-200">
                                        <p className="text-xs font-black uppercase text-slate-500 mb-2">Productos</p>
                                        <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                            {(lastSale?.productos ?? []).map((producto: any, index: number) => {
                                                const cantidad = Number(producto?.cantidad ?? 0);
                                                const precio = Number(producto?.precio_con_impuesto ?? producto?.pVenta ?? producto?.precio ?? 0);
                                                return (
                                                    <li key={`${producto?.id ?? index}-${index}`} className="flex justify-between gap-3 text-xs">
                                                        <span className="text-slate-700">
                                                            {producto?.nombre ?? 'Producto'} x{cantidad}
                                                        </span>
                                                        <span className="font-bold text-slate-800">
                                                            ${(precio * cantidad).toFixed(2)}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => printTicket(lastSale)}
                            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black py-3 rounded-xl uppercase"
                        >
                            Imprimir ticket
                        </button>
                    </div>
                </div>
            )}

            <div className="hidden print:block">
                <div ref={ticketRef} className="print-only">
                    {lastSale && renderTicketPreview(lastSale)}
                </div>
            </div>

            {/* Modal / Form Crear-Editar Producto */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-black mb-4">{editingId == null ? 'Nuevo Producto' : 'Editar Producto'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500">Ref / EAN</label>
                                <input value={formRefVal} onChange={(e) => setFormRefVal(e.target.value)} className="w-full border rounded p-2 mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Nombre</label>
                                <input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="w-full border rounded p-2 mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500">Precio Final</label>
                                    <input value={formPrecio} onChange={(e) => setFormPrecio(e.target.value)} className="w-full border rounded p-2 mt-1" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Stock</label>
                                    <input value={formStock} onChange={(e) => setFormStock(e.target.value)} className="w-full border rounded p-2 mt-1" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border">Cancelar</button>
                            <button onClick={saveProduct} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}