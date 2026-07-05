import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import qrcode from 'qrcode-terminal';
import { getDbState, saveDbState } from './db.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', async (socket) => {
  // При первом подключении отдаем клиенту текущее состояние
  try {
    const inventoryData = (await getDbState('inventoryData')) || [];
    const scannedItems = (await getDbState('scannedItems')) || {};
    const scanHistory = (await getDbState('scanHistory')) || [];
    
    socket.emit('initial_state', { inventoryData, scannedItems, scanHistory });
  } catch (error) {
    console.error('Ошибка загрузки состояния:', error);
  }

  // Обработка загрузки новых файлов
  socket.on('set_inventory_data', async (data) => {
    await saveDbState('inventoryData', data);
    await saveDbState('scannedItems', {});
    await saveDbState('scanHistory', []);
    io.emit('state_updated', { type: 'FULL_RESET', inventoryData: data });
  });

  // Обработка сканирования
  socket.on('update_scanned_item', async (payload) => {
    const { id, nextItemState, historyRecord } = payload;
    try {
      const scannedItems = (await getDbState('scannedItems')) || {};
      const scanHistory = (await getDbState('scanHistory')) || [];

      scannedItems[id] = nextItemState;
      
      if (historyRecord) {
        scanHistory.unshift(historyRecord);
        if (scanHistory.length > 500) scanHistory.pop();
      }

      await saveDbState('scannedItems', scannedItems);
      await saveDbState('scanHistory', scanHistory);

      io.emit('item_updated', { id, nextItemState, historyRecord });
    } catch (error) {
      console.error('Ошибка обновления товара:', error);
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер БД и WebSockets запущен на порту ${PORT}`);

  // Получаем локальный IP-адрес хоста в сети Wi-Fi/LAN
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break; // Берем первый подходящий внешний IPv4 адрес
      }
    }
  }

  const clientUrl = `http://${localIp}:5173`;
  
  console.log(`\n======================================================`);
  console.log(`📱 Отсканируйте QR-код, чтобы открыть на телефоне:`);
  console.log(`🔗 Прямая ссылка: ${clientUrl}`);
  console.log(`======================================================\n`);

  // Рисуем QR-код в консоли
  qrcode.generate(clientUrl, { small: true });
});