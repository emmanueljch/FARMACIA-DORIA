# 📊 Sistema de Cálculo de Ganancia - Farmacia Doria

## Descripción General
Se ha implementado un sistema completo para calcular y visualizar el porcentaje de ganancia en ventas, tanto en la aplicación web como en la móvil.

## Estructura de Datos

### Campos de Producto
```
- id: Identificador único
- ref: Referencia del producto
- nombre: Nombre del medicamento
- precio: COSTO del producto (precio de compra)
- precio_con_impuesto: PRECIO DE VENTA (precio final con impuesto)
- stock: Cantidad disponible
```

### Fórmulas de Cálculo

#### Por Producto
```
Ganancia Unitaria = precio_con_impuesto - precio
Porcentaje Ganancia = (Ganancia Unitaria / precio) × 100
```

#### Por Venta Completa
```
Costo Total = Σ(costo × cantidad) de todos los items
Total Venta = Σ(precio_venta × cantidad) de todos los items
Ganancia Total = Total Venta - Costo Total
Porcentaje Ganancia = (Ganancia Total / Costo Total) × 100
```

#### Por Día
```
Total Facturado Hoy = Σ(total de cada venta) del día
Ganancia Hoy = Σ(ganancia de cada venta) del día
Costo Total Hoy = Total Facturado - Ganancia
Porcentaje Ganancia Hoy = (Ganancia Hoy / Costo Total Hoy) × 100
```

## Visualización en la App Web (farmacia_web)

### 1. **Panel de Productos** (Vista Ventas)
Cada tarjeta de producto muestra:
- 🏷️ Referencia (arriba derecha)
- 📈 Porcentaje de ganancia (esquina superior izquierda con color)
- 💊 Nombre del medicamento
- 💰 Costo: `$XXX.XX`
- 💲 Precio de Venta: `$XXX.XX`
- 📦 Stock disponible

**Colores por porcentaje:**
- 🟢 **Verde** (Emerald): > 50% ganancia
- 🟡 **Amarillo**: 30% - 50% ganancia
- 🟠 **Naranja**: < 30% ganancia

### 2. **Carrito en Tiempo Real** (Vista Ventas - Panel Derecho)
Mientras se agregan productos muestra:
- **Costo Total**: Suma de costos
- **Ganancia Est.**: Ganancia estimada
- **% Ganancia**: Porcentaje en tiempo real con color dinámico
- **Total**: Total a pagar

### 3. **Reportes** (Vista Principal)
Grid de 4 tarjetas:
1. **Ventas Hoy**: Total facturado del día
2. **Costo Total Hoy**: Costo de productos vendidos
3. **Ganancia Hoy**: Ganancia neta
4. **% Ganancia Hoy**: Rentabilidad del día (con indicador de color)

### 4. **Última Venta** (En Reportes)
Muestra detalles completos:
- Folio (últimos 6 dígitos)
- Total de venta
- Costo total
- Ganancia
- % Ganancia
- Hora de la venta

### 5. **Ticket de Impresión** (80mm)
El ticket incluye:
```
FARMACIA DORIA
Tu salud es nuestra prioridad
================================
COMPROBANTE DE VENTA
================================
FOLIO: XXXXX
FECHA: DD/MM/YYYY HH:MM

Producto A x2          $XX.XX
Producto B x1          $XX.XX

--------------------------------
COSTO:                 $XX.XX
GANANCIA:              $XX.XX
% GANANCIA:            XX.XX%
--------------------------------
TOTAL:                 $XX.XX

¡GRACIAS POR SU COMPRA!
FARMACIA DORIA
```

## Estructura de Venta Guardada

Cuando se finaliza una venta, se guardan los siguientes datos:
```javascript
{
  id: "timestamp",
  fecha: "2024-07-24T15:30:00Z",
  productos: [...],  // Array de items con cantidad
  total: 150.50,    // Total facturado
  costo: 75.25,     // Costo total
  ganancia: 75.25,  // Ganancia total
  porcentaje: 100.00 // % ganancia
}
```

## Actualización del Modelo Dart (App Móvil)

Se actualizó `Producto` con:
```dart
class Producto {
  final double precio;              // Costo
  final double precioConImpuesto;   // Precio de venta
  
  double get porcentajeGanancia {
    if (precio == 0) return 0;
    return ((precioConImpuesto - precio) / precio) * 100;
  }
  
  double get gananciaUnitaria {
    return precioConImpuesto - precio;
  }
}
```

## Archivos Modificados

### Web (Next.js)
- ✅ `src/pages/index.tsx` - Cálculos, vista Reportes, panel carrito
- ✅ `src/components/pos/Ticket.tsx` - Ticket con ganancia

### Móvil (Flutter)
- ✅ `lib/models/producto_model.dart` - Modelo actualizado
- ✅ `lib/screens/home_screen.dart` - Muestra precioConImpuesto

## Almacenamiento

- **Web**: Las ventas se guardan en `localStorage` con clave `farmacia_ventas`
- **Base de Datos (Supabase)**: 
  - Tabla `productos` con campos: id, ref, nombre, precio, precio_con_impuesto, stock

## Consideraciones Importantes

1. **Costo Cero**: Si un producto tiene costo = 0, el porcentaje se muestra como 0% (sin división por cero)
2. **Filtrado Diario**: Las ventas se filtran por fecha del día actual
3. **Persistencia**: Las ventas se guardan en localStorage, persisten entre sesiones
4. **Colores Dinámicos**: Los indicadores de rentabilidad cambian de color según el %.

## Flujo de Datos

```
Producto (Supabase)
  ↓
  precio (costo)
  precio_con_impuesto (venta)
  ↓
  Se agrega al carrito
  ↓
  Se calcula ganancia en tiempo real
  ↓
  Se finaliza la venta
  ↓
  Se guarda con total, costo, ganancia, porcentaje
  ↓
  Se visualiza en reportes y ticket
```

## Próximas Mejoras Sugeridas

1. Exportar reportes de ganancia a PDF/Excel
2. Gráficos de ganancia por horario
3. Análisis de productos más rentables
4. Historial de cambios de precio
5. Proyecciones de ganancia mensual
6. Sincronización con base de datos (guardar ventas en Supabase)

---

**Última actualización**: 24 de julio de 2024
**Versión**: 1.0
