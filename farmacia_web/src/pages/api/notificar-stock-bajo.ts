import type { NextApiRequest, NextApiResponse } from 'next';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

function initFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
      let serviceAccount: any = null;

      if (fs.existsSync(serviceAccountPath)) {
        const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(fileContent);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      }

      if (serviceAccount) {
        initializeApp({
          credential: cert(serviceAccount),
        });
      }
    } catch (error) {
      console.error('Error inicializando Firebase Admin SDK:', error);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    initFirebaseAdmin();

    if (getApps().length === 0) {
      return res.status(500).json({ error: 'Firebase Admin SDK no se pudo inicializar.' });
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se enviaron productos para notificar.' });
    }

    const messaging = getMessaging();
    const envios = items.map(async (item: any) => {
      const stock = Number(item.stock ?? 0);
      const nombre = String(item.nombre || 'Producto');

      return messaging.send({
        topic: 'alertas',
        notification: {
          title: '⚠️ ¡ALERTA DE STOCK BAJO!',
          body: `El producto "${nombre}" tiene solo ${stock} piezas disponibles.`,
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'alertas_farmacia',
          },
        },
      });
    });

    await Promise.all(envios);
    return res.status(200).json({ success: true, count: items.length });
  } catch (error: any) {
    console.error('Error al enviar notificaciones Push FCM:', error);
    return res.status(500).json({ error: error?.message || 'Error interno enviando notificación' });
  }
}
