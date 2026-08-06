import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vpslfqulnmtidopxukcz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwc2xmcXVsbm10aWRvcHh1a2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTM3MjksImV4cCI6MjA5MzgyOTcyOX0.3X0yF5YbvSroUKkOaxVuUsMDJFDasNNOxuZo0nj3dXo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testError() {
    console.log("--- TEST 1: Update productos stock ---");
    const { error: errStock } = await supabase
        .from('productos')
        .update({ stock: 10 })
        .eq('id', 2);
    console.log("Stock update error:", errStock);

    console.log("--- TEST 2: Insert into ventas ---");
    const { data: vData, error: errVenta } = await supabase
        .from('ventas')
        .insert([{ folio: `TEST-${Date.now()}`, total: 10, metodo_pago: 'Efectivo' }])
        .select()
        .single();
    console.log("Venta insert error:", errVenta);
    console.log("Venta inserted:", vData);

    if (vData) {
        console.log("--- TEST 3: Insert into detalle_ventas ---");
        const { error: errDetalle } = await supabase
            .from('detalle_ventas')
            .insert([{ venta_id: vData.id, producto_id: 2, cantidad: 1, precio_unitario: 10, subtotal: 10 }]);
        console.log("Detalle insert error:", errDetalle);
    }
}

testError();
