import { useState, useMemo, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getExpectedQty } from './utils';
import useScanner, { findItemByCode } from './useScanner';

const socket = io();

export default function useInventoryLogic() {
  const [currentScreen, setCurrentScreen] = useState('START');
  const [activeListTab, setActiveListTab] = useState('MAIN');
  const [inventoryData, setInventoryData] = useState([]);
  const [scannedItems, setScannedItems] = useState({});
  const [scanHistory, setScanHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanModeWarehouse, setScanModeWarehouse] = useState(false);
  const [scanModeBox, setScanModeBox] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [selectedDeltas, setSelectedDeltas] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('initial_state', (data) => {
      setInventoryData(data.inventoryData);
      setScannedItems(data.scannedItems);
      setScanHistory(data.scanHistory);
      if (data.inventoryData.length > 0) {
        setActiveListTab(data.inventoryData.some((item) => item.type === 'MAIN') ? 'MAIN' : 'IMEI');
        setCurrentScreen('WORK');
      }
    });

    socket.on('state_updated', (data) => {
      if (data.type === 'FULL_RESET') {
        setInventoryData(data.inventoryData);
        setScannedItems({});
        setScanHistory([]);
        setActiveListTab(data.inventoryData.some((item) => item.type === 'MAIN') ? 'MAIN' : 'IMEI');
        setCurrentScreen('WORK');
      }
    });

    socket.on('item_updated', ({ id, nextItemState, historyRecord }) => {
      setScannedItems((prev) => ({ ...prev, [id]: nextItemState }));
      if (historyRecord) {
        setScanHistory((prev) => [historyRecord, ...prev].slice(0, 500));
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('initial_state');
      socket.off('state_updated');
      socket.off('item_updated');
    };
  }, []);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const normalizeItemState = useCallback((state = {}) => {
    const imeis = state.imeis || {};
    return {
      actualQty: Number(state.actualQty) || 0,
      imeis,
    };
  }, []);

  const createHistoryRecord = useCallback((record) => ({
    scanId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ...record,
  }), []);

  // --- ПОДКЛЮЧЕНИЕ ИЗОЛИРОВАННОГО СКАНЕРА ---
  const {
    scannerInputRef,
    scannerInputValue,
    setScannerInputValue,
    handleScannerKeyDown
  } = useScanner({
    inventoryData,
    scannedItems,
    scanModeWarehouse,
    scanModeBox,
    socket,
    showToast,
    createHistoryRecord,
    normalizeItemState
  });

  const readTextWithEncoding = (file, encoding) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, encoding);
  });

  const readFileText = async (file) => {
    let text = await readTextWithEncoding(file, 'utf-8');
    const probe = text.toLowerCase();
    if (!probe.includes('код тдб') && !probe.includes('товар')) {
      text = await readTextWithEncoding(file, 'windows-1251');
    }
    let cleanedText = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '"') inQuotes = !inQuotes;
      cleanedText += inQuotes && (text[i] === '\n' || text[i] === '\r') ? ' ' : text[i];
    }
    return cleanedText.split('\n').map((line) => line.replace(/\r$/, ''));
  };

  const findHeaders = (lines) => {
    for (let i = 0; i < Math.min(lines.length, 30); i += 1) {
      const delimiter = lines[i].includes('\t') ? '\t' : ';';
      const cols = lines[i].split(delimiter).map((col) => col.trim().toLowerCase());
      const idIndex = cols.findIndex((col) => col.includes('код тдб'));
      if (idIndex !== -1) {
        let qtyIndex = cols.findIndex((col) => col.includes('залишок') || col.includes('остаток') || col.includes('магазин'));
        if (qtyIndex === -1 && i + 1 < lines.length) {
          const nextCols = lines[i + 1].split(delimiter).map((col) => col.trim().toLowerCase());
          qtyIndex = nextCols.findIndex((col) => col.includes('залишок') || col.includes('остаток'));
        }
        return {
          headerLineIndex: i, delimiter, idIndex,
          nameIndex: cols.findIndex((col) => col === 'товар' || col.includes('номенклатура')),
          qtyIndex,
          barcodeIndex: cols.findIndex((col) => col.includes('штрихкод') || col.includes('штрих-код') || col.includes('barcode')),
        };
      }
    }
    return null;
  };

  const parseQty = (value) => parseFloat(String(value || '0').replace(/\s/g, '').replace(/'/g, '').replace(',', '.')) || 0;

  const handleStartProcessing = async (files) => {
    setIsProcessing(true);
    setBuildError(null);
    try {
      const inventoryMap = new Map();
      const blacklist = ['apple', 'iphone', 'ipad', 'macbook', 'airpods', 'watch', 'samsung', 'xiaomi', 'redmi', 'смартфон', 'телефон', 'наушники', 'навушники', 'чохол', 'чехол', 'скло', 'стекло', 'кабель', 'адаптер', 'б/в', 'б/у', 'колір', 'цвет', 'gb', 'tb', 'гб', 'тб'];

      for (const imeiFile of files.imei) {
        const imeiLines = await readFileText(imeiFile);
        const imeiHeaders = findHeaders(imeiLines);
        if (!imeiHeaders) continue;
        let lastProductId = null;
        for (let i = imeiHeaders.headerLineIndex + 1; i < imeiLines.length; i += 1) {
          const cols = imeiLines[i].split(imeiHeaders.delimiter).map((col) => col.trim());
          if (cols.length > imeiHeaders.idIndex && cols[imeiHeaders.idIndex]) {
            lastProductId = cols[imeiHeaders.idIndex];
            if (!inventoryMap.has(lastProductId)) {
              inventoryMap.set(lastProductId, {
                id: lastProductId, name: cols[imeiHeaders.nameIndex] || 'Неизвестный товар',
                expectedQty: parseQty(cols[imeiHeaders.qtyIndex]), imeis: [], barcodes: [], type: 'IMEI',
              });
            }
          } else if (lastProductId && cols[0]) {
            const potentialImei = cols[0].trim();
            const hasCyrillic = /[а-яёіїєґА-ЯЁІЇЄҐ]/.test(potentialImei);
            const isFormatValid = /^[A-Za-z0-9\-/]{6,30}$/.test(potentialImei);
            const hasDigit = /\d/.test(potentialImei);
            const hasNoBlacklist = !blacklist.some((word) => potentialImei.toLowerCase().includes(word));
            const isPureDigits = /^\d+$/.test(potentialImei);
            const isValidLength = isPureDigits ? potentialImei.length >= 8 : potentialImei.length >= 6 && potentialImei.length <= 20;

            let isOtherColsEmpty = true;
            for (let j = 1; j < cols.length; j += 1) {
              if (cols[j] && cols[j].length > 4 && cols[j].toLowerCase().includes('грн')) { isOtherColsEmpty = false; break; }
            }

            if (isFormatValid && hasDigit && hasNoBlacklist && !hasCyrillic && isValidLength && isOtherColsEmpty) {
              const product = inventoryMap.get(lastProductId);
              if (product && !product.imeis.includes(potentialImei)) product.imeis.push(potentialImei);
            }
          }
        }
      }

      if (files.main) {
        const mainLines = await readFileText(files.main);
        const mainHeaders = findHeaders(mainLines);
        if (mainHeaders) {
          for (let i = mainHeaders.headerLineIndex + 1; i < mainLines.length; i += 1) {
            const cols = mainLines[i].split(mainHeaders.delimiter).map((col) => col.trim());
            if (cols.length > mainHeaders.idIndex && cols[mainHeaders.idIndex]) {
              const id = cols[mainHeaders.idIndex];
              if (inventoryMap.has(id)) continue;
              inventoryMap.set(id, {
                id, name: cols[mainHeaders.nameIndex] || 'Неизвестный товар',
                expectedQty: parseQty(cols[mainHeaders.qtyIndex]), imeis: [], barcodes: [], type: 'MAIN',
              });
            }
          }
        }
      }

      if (files.barcode) {
        const bcLines = await readFileText(files.barcode);
        const bcHeaders = findHeaders(bcLines);
        if (bcHeaders && bcHeaders.barcodeIndex !== -1) {
          for (let i = bcHeaders.headerLineIndex + 1; i < bcLines.length; i += 1) {
            const cols = bcLines[i].split(bcHeaders.delimiter).map((col) => col.trim());
            const id = cols[bcHeaders.idIndex];
            const barcode = cols[bcHeaders.barcodeIndex];
            if (id && barcode && barcode.length > 3) {
              let product = inventoryMap.get(id);
              if (!product) {
                product = {
                  id, name: cols[bcHeaders.nameIndex] || 'Неизвестный товар',
                  expectedQty: parseQty(cols[bcHeaders.qtyIndex]), imeis: [], barcodes: [], type: 'MAIN',
                };
                inventoryMap.set(id, product);
              }
              const cleanBarcode = barcode.replace(/['"=\s]/g, '');
              if (!product.barcodes.includes(cleanBarcode) && cleanBarcode.length > 3) product.barcodes.push(cleanBarcode);
            }
          }
        }
      }

      const finalArray = Array.from(inventoryMap.values());
      if (finalArray.length === 0) throw new Error('Не удалось извлечь товары из файлов.');

      socket.emit('set_inventory_data', finalArray);
    } catch (err) {
      setBuildError(`Ошибка сборки: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveQtyInput = useCallback((itemId, value) => {
    const text = String(value ?? '').trim();
    const current = scannedItems[itemId]?.actualQty || 0;
    if (text.startsWith('+')) return current + (parseFloat(text.slice(1)) || 0);
    if (text.startsWith('-')) return Math.max(0, current - (parseFloat(text.slice(1)) || 0));
    return parseFloat(text) || 0;
  }, [scannedItems]);

  const handleUpdateQty = (id, inputString, imei = null, applyToBase = true, applyToImei = true) => {
    const cleanInput = inputString.trim();
    if (cleanInput !== '') {
      const probe = cleanInput.startsWith('+') || cleanInput.startsWith('-') ? cleanInput.substring(1) : cleanInput;
      if (probe === '' || Number.isNaN(parseFloat(probe))) {
        showToast(`Некорректный ввод: "${inputString}"`);
        return;
      }
    }

    const current = scannedItems[id] || { actualQty: 0, imeis: {} };
    const next = { actualQty: current.actualQty || 0, imeis: { ...(current.imeis || {}) } };
    
    if (!imei && applyToBase) {
      next.actualQty = resolveQtyInput(id, cleanInput);
    } else if (imei && applyToImei) {
      const qty = parseFloat(cleanInput) || 0;
      if (qty <= 0) delete next.imeis[imei];
      else next.imeis[imei] = 1;
    }

    const nextItemState = normalizeItemState(next);
    const historyRecord = createHistoryRecord({
      itemId: id,
      itemName: inventoryData.find((item) => item.id === id)?.name || null,
      scannedCode: imei || cleanInput,
      status: 'MANUAL',
    });

    socket.emit('update_scanned_item', { id, nextItemState, historyRecord });
  };

  // Загрузка накладной построчно повторяет РОВНО ту же операцию, что и
  // одиночный скан (см. useScanner.handleScannerSubmit): тот же поиск
  // совпадения (findItemByCode), та же логика режимов "Склад"/"Коробка",
  // тот же формат historyRecord и тот же способ применения — через
  // socket.emit('update_scanned_item', ...). Локально scannedItems/scanHistory
  // не трогаем напрямую: их обновляет уже существующий обработчик
  // socket.on('item_updated', ...) — именно так это происходит и при обычном скане.
  const handleBulkTransfer = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');

        let processedQty = 0;
        let imeisAdded = 0;
        let notFoundCount = 0;

        // Рабочая копия текущего состояния — нужна, чтобы несколько строк
        // накладной, ссылающихся на один и тот же товар, накапливались
        // последовательно (ровно так, как если бы товар сканировали
        // несколько раз подряд), а не перезатирали друг друга.
        const workingState = {};
        Object.keys(scannedItems).forEach((id) => {
          const s = scannedItems[id] || {};
          workingState[id] = { actualQty: Number(s.actualQty) || 0, imeis: { ...(s.imeis || {}) } };
        });

        lines.forEach((line, lineIndex) => {
          try {
            const cols = line.split('\t');
            if (cols.length < 8) return;

            const barcode = cols[3]?.trim();
            const imei = cols[5]?.trim();
            const qtyStr = cols[7]?.trim().replace(',', '.');
            const qty = parseFloat(qtyStr);

            if ((!barcode && !imei) || Number.isNaN(qty) || qty <= 0) return;

            // Как и при ручном сканировании: сперва пробуем найти по IMEI
            // (это самый точный идентификатор), если его нет — по штрихкоду.
            const scannedCode = imei || barcode;
            const found = findItemByCode(inventoryData, scannedCode);

            if (!found) {
              notFoundCount += 1;
              const historyRecord = createHistoryRecord({
                itemId: null,
                itemName: 'Невідомо',
                scannedCode,
                status: 'NOT_FOUND',
              });
              socket.emit('update_scanned_item', { id: null, nextItemState: null, historyRecord });
              return;
            }

            const { item, matchedImei } = found;
            const current = workingState[item.id] || { actualQty: 0, imeis: {} };
            const next = { actualQty: current.actualQty || 0, imeis: { ...(current.imeis || {}) } };

            let scanMode;

            if (matchedImei) {
              const updateBaseQty = Boolean(scanModeWarehouse || scanModeBox);
              const updateImeiState = Boolean(scanModeWarehouse || !scanModeBox);
              const isNewImei = !next.imeis[matchedImei];

              if (updateImeiState) {
                next.imeis[matchedImei] = (next.imeis[matchedImei] || 0) + 1;
                if (isNewImei) imeisAdded += 1;
              }
              if (updateBaseQty) {
                next.actualQty += qty;
              }

              if (updateBaseQty && updateImeiState) {
                scanMode = 'WAREHOUSE';
              } else if (updateBaseQty) {
                scanMode = 'BOX';
              } else {
                scanMode = 'DEVICE';
              }
            } else {
              next.actualQty += qty;
              scanMode = 'BOX';
            }

            processedQty += qty;

            const nextItemState = normalizeItemState(next);
            workingState[item.id] = nextItemState;

            const historyRecord = createHistoryRecord({
              itemId: item.id, itemName: item.name, scannedCode, status: 'OK', scanMode,
            });

            socket.emit('update_scanned_item', { id: item.id, nextItemState, historyRecord });
          } catch (rowError) {
            // eslint-disable-next-line no-console
            console.error(`Накладна: помилка в рядку ${lineIndex + 1}`, rowError, line);
          }
        });

        showToast(`Накладна оброблена: додано ${processedQty} шт. IMEI: ${imeisAdded}. Не знайдено: ${notFoundCount}`);
      } catch (fileError) {
        // eslint-disable-next-line no-console
        console.error('Накладна: критична помилка обробки файлу', fileError);
        showToast(`Помилка обробки накладної: ${fileError.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleWarehouse = () => { 
    setScanModeWarehouse((e) => {
      const next = !e;
      if (next) setScanModeBox(false); 
      showToast(`Режим "Склад" ${next ? 'включений' : 'вимкнений'}`);
      return next;
    }); 
  };
  
  const toggleBox = () => { 
    setScanModeBox((e) => {
      const next = !e;
      if (next) setScanModeWarehouse(false); 
      showToast(`Режим "Коробка" ${next ? 'включений' : 'вимкнений'}`);
      return next;
    }); 
  };

  const handleTabChange = (tab) => {
    if (activeListTab !== tab) { setSelectedDeltas([]); setSearchQuery(''); setActiveListTab(tab); }
    setCurrentScreen('WORK');
  };

  const currentTabData = useMemo(() => inventoryData.filter((item) => item.type === activeListTab), [inventoryData, activeListTab]);
  const getDeltaKey = (expected, actual) => {
    const currentActual = actual !== undefined && actual !== '' ? parseFloat(actual) : 0;
    const diff = Number((currentActual - expected).toFixed(3));
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const deltaStats = useMemo(() => {
    const stats = {};
    currentTabData.forEach((item) => {
      const expectedQty = getExpectedQty(item);
      const actualQty = scannedItems[item.id]?.actualQty;
      const deltaKey = getDeltaKey(expectedQty, actualQty);
      stats[deltaKey] = (stats[deltaKey] || 0) + 1;
    });
    return stats;
  }, [currentTabData, scannedItems]);

  const sortedDeltaKeys = useMemo(() => Object.keys(deltaStats).sort((a, b) => parseFloat(a) - parseFloat(b)), [deltaStats]);

  const filteredData = useMemo(() => {
    let result = currentTabData;
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      result = result.filter((item) => (
        item.id.toLowerCase().includes(lowerQuery) || item.name.toLowerCase().includes(lowerQuery)
        || (item.imeis && item.imeis.some((imei) => imei.toLowerCase().includes(lowerQuery)))
        || (item.barcodes && item.barcodes.some((bc) => bc.toLowerCase().includes(lowerQuery)))
      ));
    }
    if (selectedDeltas.length > 0) {
      result = result.filter((item) => {
        const expectedQty = getExpectedQty(item);
        const actualQty = scannedItems[item.id]?.actualQty;
        return selectedDeltas.includes(getDeltaKey(expectedQty, actualQty));
      });
    }
    return result;
  }, [currentTabData, searchQuery, scannedItems, selectedDeltas]);

  const activeDataForProgress = currentScreen === 'SCAN' ? inventoryData : currentTabData;
  const progressScanned = activeDataForProgress.filter((item) => scannedItems[item.id]?.actualQty !== undefined).length;
  const progressTotal = activeDataForProgress.length;

  return {
    currentScreen, setCurrentScreen, activeListTab,
    inventoryData, scannedItems, scanHistory,
    searchQuery, setSearchQuery,
    scanModeWarehouse, scanModeBox, toggleWarehouse, toggleBox,
    toastMessage, isConnected,
    isProcessing, buildError, handleStartProcessing,
    selectedDeltas, setSelectedDeltas, isFilterOpen, setIsFilterOpen,
    scannerInputRef, scannerInputValue, setScannerInputValue, handleScannerKeyDown,
    handleUpdateQty, handleBulkTransfer, handleTabChange,
    currentTabData, deltaStats, sortedDeltaKeys, filteredData,
    progressScanned, progressTotal,
  };
}
