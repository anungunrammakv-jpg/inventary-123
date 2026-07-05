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

// Единый источник правды живёт в памяти процесса. Это ключевое: JS
// однопоточный, поэтому пока обработчик события не встретит await,
// никакое другое событие не может вклиниться и прочитать/перезаписать
// состояние "посередине". Раньше scannedItems/scanHistory каждый раз
// заново читались из SQLite и писались обратно — при пачке событий
// подряд (загрузка накладной) это read-modify-write гонка: событие Б
// читало ещё старые данные, пока событие А ждало ответа от диска, и
// одно из них при записи затирало результат другого. Отсюда и терялась
// почти вся история при массовой загрузке.
let state = null;

async function loadState() {
  const inventoryData = (await getDbState('inventoryData')) || [];
  const scannedItems = (await getDbState('scannedItems')) || {};
  const scanHistory = (await getDbState('scanHistory')) || [];
  state = { inventoryData, scannedItems, scanHistory };
}

function persistScanState() {
  // Пишем на диск в фоне, не блокируя обработку следующих событий.
  // Порядок завершения этих асинхронных записей не важен для
  // корректности приложения — авторитетное состояние всегда в state,
  // на диск просто периодически "сбрасывается" снимок для персистентности.
  saveDbState('scannedItems', state.scannedItems).catch((error) => {
    console.error('Ошибка сохранения scannedItems:', error);
  });
  saveDbState('scanHistory', state.scanHistory).catch((error) => {
    console.error('Ошибка сохранения scanHistory:', error);
  });
}

io.on('connection', (socket) => {
  // Состояние уже загружено при старте сервера (см. низ файла) —
  // просто отдаём текущий снимок из памяти, без обращения к БД.
  socket.emit('initial_state', state);

  // Обработка загрузки новых файлов
  socket.on('set_inventory_data', async (data) => {
    state = { inventoryData: data, scannedItems: {}, scanHistory: [] };
    io.emit('state_updated', { type: 'FULL_RESET', inventoryData: data });
    await saveDbState('inventoryData', data);
    await saveDbState('scannedItems', {});
    await saveDbState('scanHistory', []);
  });

  // Обработка сканирования (в т.ч. построчно — при загрузке накладной)
  socket.on('update_scanned_item', (payload) => {
    const { id, nextItemState, historyRecord } = payload;
    try {
      // Всё до этой строки и после — синхронный код без await,
      // поэтому весь блок выполняется как одна атомарная операция.
      state.scannedItems[id] = nextItemState;

      if (historyRecord) {
        state.scanHistory.unshift(historyRecord);
        if (state.scanHistory.length > 500) state.scanHistory.pop();
      }

      io.emit('item_updated', { id, nextItemState, historyRecord });
      persistScanState();
    } catch (error) {
      console.error('Ошибка обновления товара:', error);
    }
  });
});

const PORT = 3001;

loadState().then(() => {
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
}).catch((error) => {
  console.error('Не вдалося завантажити стан з бази даних:', error);
  process.exit(1);
});
