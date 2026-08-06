import { useState } from 'react';

export const useCart = () => {
    const [carrito, setCarrito] = useState<any[]>([]);

    const agregarProducto = (producto: any) => {
        setCarrito((prev) => {
            // ¿El producto ya está en el carrito?
            const existe = prev.find((item) => item.id === producto.id);

            if (existe) {
                // Si existe, le sumamos 1 a la cantidad
                return prev.map((item) =>
                    item.id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                );
            }
            // Si es nuevo, normalizamos el precio de venta y lo agregamos con cantidad 1
            const pVenta = producto.pVenta ?? producto.precio_con_impuesto ?? producto.precio ?? 0;
            return [...prev, { ...producto, cantidad: 1, pVenta }];
        });
    };

    const eliminarProducto = (id: number) => {
        setCarrito((prev) => prev.filter((item) => item.id !== id));
    };

    const limpiarCarrito = () => setCarrito([]);

    const total = carrito.reduce((acc, item) => {
        const precio = Number(item.pVenta ?? item.precio_con_impuesto ?? item.precio ?? 0);
        const cantidad = Number(item.cantidad ?? 0);
        return acc + precio * cantidad;
    }, 0);

    return { carrito, agregarProducto, eliminarProducto, limpiarCarrito, total };
};