class Producto {
  final int id;
  final String nombre;
  final String ref;
  final int existencia;
  final double precio; // Costo del producto
  final double precioConImpuesto; // Precio de venta final
  final int stock;

  Producto(
      {required this.id,
      required this.nombre,
      required this.ref,
      required this.existencia,
      required this.precio,
      required this.precioConImpuesto,
      required this.stock});

  factory Producto.fromMap(Map<String, dynamic> map) {
    // Priorizar la columna 'stock' si existe en la respuesta de Supabase,
    // y si no, caer back a 'existencia' para compatibilidad.
    final dynamic rawStock = map['stock'] ?? map['existencia'] ?? 0;
    final int stockVal = rawStock is num
        ? rawStock.toInt()
        : int.tryParse(rawStock.toString()) ?? 0;

    return Producto(
      id: map['id'],
      nombre: map['nombre'] ?? 'Sin nombre',
      ref: map['ref'] ?? '',
      existencia: stockVal,
      precio: (map['precio'] ?? 0).toDouble(), // Costo
      precioConImpuesto:
          (map['precio_con_impuesto'] ?? 0).toDouble(), // Precio de venta
      stock: stockVal,
    );
  }

  // Calcular porcentaje de ganancia
  double get porcentajeGanancia {
    if (precio == 0) return 0;
    return ((precioConImpuesto - precio) / precio) * 100;
  }

  // Calcular ganancia por unidad
  double get gananciaUnitaria {
    return precioConImpuesto - precio;
  }
}
