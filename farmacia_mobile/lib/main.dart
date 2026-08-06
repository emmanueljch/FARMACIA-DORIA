import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Tus imports de carpetas (ajusta si los nombres cambian un poco)
import 'package:farmacia_mobile/core/supabase_client.dart';
import 'package:farmacia_mobile/providers/inventario_provider.dart';
import 'package:farmacia_mobile/providers/notificaciones_provider.dart';
import 'package:farmacia_mobile/screens/home_screen.dart';

// 1. FUNCIÓN CRÍTICA: Escucha los mensajes cuando la app está CERRADA
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await NotificacionesProvider.mostrarNotificacionDesdeBackground(message);
  debugPrint(
      "Notificación recibida en segundo plano: ${message.notification?.title}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 2. Inicializar Firebase y Supabase
  await Firebase.initializeApp();
  await SupabaseService.initialize();

  // 4. Inicializar nuestro proveedor de notificaciones locales
  final notificacionesProvider = NotificacionesProvider();
  await notificacionesProvider.inicializar();

  // 3. Configurar el manejador de segundo plano
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  final inventarioProvider = InventarioProvider();
  inventarioProvider.notificacionesProvider = notificacionesProvider;
  await inventarioProvider.iniciarSincronizacion();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: inventarioProvider),
        ChangeNotifierProvider.value(value: notificacionesProvider),
      ],
      child: const MyApp(),
    ),
  );

  // 5. Pedir permisos al usuario en el celular (iOS y Android 13+)
  FirebaseMessaging messaging = FirebaseMessaging.instance;
  await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  // 6. Suscribir el celular al canal "alertas" que configuramos en Supabase SQL
  try {
    await messaging.subscribeToTopic("alertas");
    debugPrint("Celular suscrito exitosamente al canal de alertas.");
  } catch (e) {
    debugPrint("No se pudo suscribir al canal de alertas: $e");
  }

  // 7. Escuchar mensajes cuando la app está ABIERTA (Foreground)
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    if (message.notification != null) {
      // Si llega un mensaje con la app abierta, lo pintamos usando la alerta local
      notificacionesProvider.mostrarNotificacionLocal(message.notification!);
    }
  });
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Farmacia Inventario',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F172A)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
