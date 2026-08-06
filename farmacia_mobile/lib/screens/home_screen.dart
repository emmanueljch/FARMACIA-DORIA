import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/inventario_provider.dart';
import 'scan_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Cargamos los datos al iniciar la pantalla si la lista está vacía
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try {
        final provider = context.read<InventarioProvider>();
        if (provider.productos.isEmpty) {
          provider.iniciarSincronizacion();
        }
      } catch (e) {
        // Si Supabase no está inicializado (por ejemplo en tests), ignorar.
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      try {
        final provider = context.read<InventarioProvider>();
        provider.iniciarSincronizacion();
      } catch (e) {
        debugPrint("Error al reanudar app: $e");
      }
    }
  }

  Future<void> _onScanPressed() async {
    final barcode = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const ScanScreen()),
    );

    if (!mounted || barcode == null || barcode.isEmpty) return;

    final provider = context.read<InventarioProvider>();
    final producto = provider.buscarProductoPorCodigo(barcode);
    provider.setProductoEscaneado(producto);

    if (!mounted) return;

    if (producto != null) {
      provider.filterProductos(barcode);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Producto encontrado: ${producto.nombre}')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Producto no encontrado en el inventario')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9), // Fondo gris azulado suave
      appBar: AppBar(
        title: const Text(
          'INVENTARIO REAL',
          style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white),
        ),
        backgroundColor: const Color(0xFF0F172A), // Azul oscuro profesional
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () =>
                context.read<InventarioProvider>().fetchProductos(),
          ),
          IconButton(
            icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
            onPressed: _onScanPressed,
            tooltip: 'Escanear código',
          ),
        ],
      ),
      body: Column(
        children: [
          // Buscador superior
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Buscar por nombre o código...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (value) {
                context.read<InventarioProvider>().filterProductos(value);
              },
            ),
          ),

          Consumer<InventarioProvider>(
            builder: (context, provider, child) {
              final producto = provider.productoEscaneado;
              if (producto == null) return const SizedBox.shrink();

              final bool alerta = producto.existencia <= 5;
              return Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(
                      color: alerta ? Colors.red.shade100 : Colors.white,
                      width: 2,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: alerta
                              ? Colors.red.shade50
                              : const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: const Text('📦', style: TextStyle(fontSize: 24)),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Último escaneo',
                                style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(
                              producto.nombre.toUpperCase(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 14),
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text('REF: ${producto.ref}',
                                style: TextStyle(
                                    color: Colors.grey.shade400, fontSize: 10)),
                          ],
                        ),
                      ),
                      Text(
                        producto.existencia.toString(),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: alerta ? Colors.red : const Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          Expanded(
            child: RefreshIndicator(
              color: const Color(0xFF059669),
              onRefresh: () async {
                await context.read<InventarioProvider>().fetchProductos();
              },
              child: Consumer<InventarioProvider>(
                builder: (context, provider, child) {
                  if (provider.cargando && provider.productos.isEmpty) {
                    return const Center(
                        child:
                            CircularProgressIndicator(color: Color(0xFF059669)));
                  }

                  if (provider.productos.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 100),
                        Center(child: Text("No hay productos o revisa el RLS")),
                      ],
                    );
                  }

                  return ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: provider.productos.length,
                    itemBuilder: (context, index) {
                    final p = provider.productos[index];
                    // Alerta si el stock es menor o igual a 5
                    final bool alerta = p.existencia <= 5;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(
                          color: alerta ? Colors.red.shade100 : Colors.white,
                          width: 2,
                        ),
                      ),
                      child: Row(
                        children: [
                          // Icono / Emoji
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: alerta
                                  ? Colors.red.shade50
                                  : const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(15),
                            ),
                            child: const Text("💊",
                                style: TextStyle(fontSize: 24)),
                          ),
                          const SizedBox(width: 15),

                          // Info del producto
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  p.nombre.toUpperCase(),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text("REF: ${p.ref}",
                                    style: TextStyle(
                                        color: Colors.grey.shade400,
                                        fontSize: 10)),
                                Text(
                                  "\$${p.precioConImpuesto.toStringAsFixed(2)}",
                                  style: const TextStyle(
                                      color: Color(0xFF059669),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 18),
                                ),
                              ],
                            ),
                          ),

                          // Badge de Stock
                          Column(
                            children: [
                              const Text("STOCK",
                                  style: TextStyle(
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.grey)),
                              Text(
                                p.existencia.toString(),
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  color: alerta
                                      ? Colors.red
                                      : const Color(0xFF1E293B),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    ),
  );
  }
}
