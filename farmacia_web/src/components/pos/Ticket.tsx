import React from 'react';

interface TicketProps {
  folio: string;
  fecha: string;
  productos: any[];
  total: number;
  pago?: number;
  cambio?: number;
  ganancia?: number;
  costo?: number;
  porcentaje?: number;
}

export const TicketDoria = React.forwardRef<HTMLDivElement, TicketProps>((props, ref) => {
  const fechaTexto = props.fecha ? new Date(props.fecha).toLocaleString() : '---';
  const ganancia = Number(props.ganancia || 0);
  const costo = Number(props.costo || 0);
  const porcentaje = Number(props.porcentaje || 0);
  const pago = Number(props.pago ?? props.total ?? 0);
  const cambio = Number(props.cambio ?? Math.max(0, pago - props.total) ?? 0);

  return (
    <div ref={ref} style={{ width: '80mm', padding: '10px', fontFamily: 'monospace', background: '#fff', color: '#000' }}>
      <div style={{ textAlign: 'center', fontSize: '12px' }}>
        <h2 style={{ margin: 0 }}>FARMACIA DORIA</h2>
        <p style={{ fontSize: '12px' }}>Tu salud es nuestra prioridad</p>
        <p style={{ fontSize: '10px' }}>AV. PRINCIPAL #123, COL. CENTRO</p>
        <p>================================</p>
        <p style={{ fontWeight: 'bold' }}>COMPROBANTE DE VENTA</p>
        <p>================================</p>
      </div>
      
      <div style={{ fontSize: '12px' }}>
        <p>FOLIO: {props.folio}</p>
        <p>FECHA: {fechaTexto}</p>
        <p>--------------------------------</p>
        
        {props.productos.map((prod, i) => {
          const precio = Number(prod.pVenta ?? prod.precio_con_impuesto ?? prod.precio ?? 0);
          const cantidad = Number(prod.cantidad ?? 0);
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ flex: 1 }}>{prod.nombre} x{cantidad}</span>
              <span>${(precio * cantidad).toFixed(2)}</span>
            </div>
          );
        })}
        
        <p>--------------------------------</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>TOTAL:</span>
          <span>${Number(props.total || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>
          <span>PAGO:</span>
          <span>${pago.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>
          <span>CAMBIO:</span>
          <span>${cambio.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px' }}>
        <p>¡GRACIAS POR SU COMPRA!</p>
        <p>FARMACIA DORIA</p>
      </div>
    </div>
  );
});