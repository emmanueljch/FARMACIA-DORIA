import 'dart:async';

import 'package:flutter/material.dart';
import '../models/producto_model.dart';
import '../core/supabase_client.dart';

import 'notificaciones_provider.dart';

class InventarioProvider extends ChangeNotifier {
  List<Producto> productos = [];
  // Lista completa sin filtrar
  List<Producto> _allProductos = [];
  bool cargando = false;
  Producto? productoEscaneado;
  String _currentQuery = '';
  StreamSubscription<List<Map<String, dynamic>>>? _productosSubscription;

  NotificacionesProvider? notificacionesProvider;
  final Map<int, int> _previousStock = {};

  Future<void> iniciarSincronizacion() async {
    await fetchProductos();
    await escucharCambiosProductos();
  }

  Future<void> fetchProductos() async {
    cargando = true;
    notifyListeners();

    try {
      final data = await supabase.from('productos').select().order('id', ascending: true);
      _allProductos =
          (data as List).map((json) => Producto.fromMap(json)).toList();
      _syncEstadoLocal();
    } catch (e) {
      debugPrint("Error al obtener productos: $e");
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  Future<void> escucharCambiosProductos() async {
    await _productosSubscription?.cancel();

    try {
      _productosSubscription = supabase
          .from('productos')
          .stream(primaryKey: ['id'])
          .order('id', ascending: true)
          .listen((List<Map<String, dynamic>> data) {
        _allProductos =
            data.map((json) => Producto.fromMap(json)).toList();
        _syncEstadoLocal();
        notifyListeners();
      }, onError: (error) {
        debugPrint("Error en stream de Supabase Realtime: $error");
      });
    } catch (e) {
      debugPrint("No se pudo iniciar el listener de cambios: $e");
    }
  }

  void _verificarAlertasStock() {
    for (final p in _allProductos) {
      if (_previousStock.containsKey(p.id)) {
        final oldStock = _previousStock[p.id]!;
        // Notificar si el producto cruza el umbral de 5 piezas o si el stock siguió disminuyendo
        if (p.existencia <= 5 && (oldStock > 5 || p.existencia < oldStock)) {
          notificacionesProvider?.mostrarAlertaStockBajo(
            idProducto: p.id,
            nombreProducto: p.nombre,
            stockActual: p.existencia,
          );
        }
      } else {
        // Al iniciar la app por primera vez, si un producto ya está en stock bajo (<= 5)
        if (p.existencia <= 5) {
          notificacionesProvider?.mostrarAlertaStockBajo(
            idProducto: p.id,
            nombreProducto: p.nombre,
            stockActual: p.existencia,
          );
        }
      }
      _previousStock[p.id] = p.existencia;
    }
  }

  void _syncEstadoLocal() {
    _verificarAlertasStock();

    // 1. Actualizar el producto escaneado si existe para reflejar el stock nuevo
    if (productoEscaneado != null) {
      final index =
          _allProductos.indexWhere((p) => p.id == productoEscaneado!.id);
      if (index >= 0) {
        productoEscaneado = _allProductos[index];
      }
    }

    // 2. Refrescar la lista de productos filtrada o completa
    if (_currentQuery.isEmpty) {
      productos = List<Producto>.from(_allProductos);
    } else {
      _aplicarFiltroSinNotificar(_currentQuery);
    }
  }

  void _aplicarFiltroSinNotificar(String query) {
    _currentQuery = query.trim().toLowerCase();
    if (_currentQuery.isEmpty) {
      productos = List<Producto>.from(_allProductos);
    } else {
      productos = _allProductos.where((p) {
        final nombre = p.nombre.toLowerCase();
        final ref = p.ref.toLowerCase();
        return nombre.contains(_currentQuery) || ref.contains(_currentQuery);
      }).toList();
    }
  }

  /// Filtra los productos localmente por nombre o referencia.
  void filterProductos(String query) {
    _aplicarFiltroSinNotificar(query);
    notifyListeners();
  }

  Producto? buscarProductoPorCodigo(String codigo) {
    final q = codigo.trim().toLowerCase();
    if (q.isEmpty) return null;

    for (final producto in _allProductos) {
      final nombre = producto.nombre.toLowerCase();
      final ref = producto.ref.toLowerCase();
      if (nombre == q || ref == q || nombre.contains(q) || ref.contains(q)) {
        return producto;
      }
    }
    return null;
  }

  void setProductoEscaneado(Producto? producto) {
    productoEscaneado = producto;
    notifyListeners();
  }

  @override
  void dispose() {
    _productosSubscription?.cancel();
    super.dispose();
  }
}
