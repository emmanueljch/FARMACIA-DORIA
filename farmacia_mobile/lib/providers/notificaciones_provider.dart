import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

class NotificacionesProvider extends ChangeNotifier {
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  Future<void> inicializar() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
    );

    await _localNotifications.initialize(settings: initializationSettings);

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'alertas_farmacia',
      'Alertas de Inventario',
      description: 'Canal para notificar stock crítico de medicamentos',
      importance: Importance.max,
      playSound: true,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static Future<void> mostrarNotificacionDesdeBackground(
      RemoteMessage message) async {
    try {
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      const InitializationSettings initializationSettings =
          InitializationSettings(
        android: initializationSettingsAndroid,
      );

      await _localNotifications.initialize(settings: initializationSettings);

      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'alertas_farmacia',
        'Alertas de Inventario',
        description: 'Canal para notificar stock crítico de medicamentos',
        importance: Importance.max,
        playSound: true,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);

      final notification = message.notification;
      if (notification == null) return;

      const AndroidNotificationDetails androidDetails =
          AndroidNotificationDetails(
        'alertas_farmacia',
        'Alertas de Inventario',
        channelDescription:
            'Canal para notificar stock crítico de medicamentos',
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'ticker',
        icon: '@mipmap/ic_launcher',
      );

      const NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
      );

      await _localNotifications.show(
        id: notification.hashCode,
        title: notification.title ?? 'Alerta de inventario',
        body: notification.body ?? 'Revise el stock de los productos.',
        notificationDetails: platformDetails,
      );
    } catch (e) {
      debugPrint('Error mostrando notificación en segundo plano: $e');
    }
  }

  Future<void> mostrarNotificacionLocal(RemoteNotification notification) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'alertas_farmacia',
      'Alertas de Inventario',
      channelDescription: 'Canal para notificar stock crítico de medicamentos',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
      icon: '@mipmap/ic_launcher',
    );

    const NotificationDetails platformDetails =
        NotificationDetails(android: androidDetails);

    await _localNotifications.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: platformDetails,
    );
  }

  Future<void> mostrarAlertaStockBajo({
    required int idProducto,
    required String nombreProducto,
    required int stockActual,
  }) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'alertas_farmacia',
      'Alertas de Inventario',
      channelDescription: 'Canal para notificar stock crítico de medicamentos',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
      icon: '@mipmap/ic_launcher',
    );

    const NotificationDetails platformDetails =
        NotificationDetails(android: androidDetails);

    await _localNotifications.show(
      id: idProducto,
      title: '⚠️ ¡ALERTA DE STOCK BAJO!',
      body: 'El producto "$nombreProducto" tiene solo $stockActual piezas disponibles.',
      notificationDetails: platformDetails,
    );
  }
}
