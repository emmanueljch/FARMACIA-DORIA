import 'package:supabase_flutter/supabase_flutter.dart';

/// Provee un acceso global al cliente de Supabase y una inicialización.
SupabaseClient get supabase => Supabase.instance.client;

class SupabaseService {
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'https://vpslfqulnmtidopxukcz.supabase.co',
      anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwc2xmcXVsbm10aWRvcHh1a2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTM3MjksImV4cCI6MjA5MzgyOTcyOX0.3X0yF5YbvSroUKkOaxVuUsMDJFDasNNOxuZo0nj3dXo',
    );
  }
}
