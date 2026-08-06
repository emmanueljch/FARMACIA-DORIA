export default function Cart({ items, total }: { items: any[], total: number }) {
    return (
        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {items.map((item, i) => (
                <div key={i} className="flex justify-between items-center group">
                    <div className="flex gap-3 text-sm">
                        <span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-md text-xs">
                            {item.cantidad}
                        </span>
                        <div>
                            <p className="font-bold text-slate-700">{item.nombre}</p>
                            <p className="text-xs text-slate-400">${Number(item.pVenta ?? item.precio_con_impuesto ?? item.precio ?? 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <p className="font-black text-slate-800">${(item.cantidad * Number(item.pVenta ?? item.precio_con_impuesto ?? item.precio ?? 0)).toFixed(2)}</p>
                </div>
            ))}
        </div>
    );
}