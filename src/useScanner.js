import { useState, useRef, useCallback } from 'react';
import { playSuccessBeep, playErrorBeep } from './utils';

// Вынесено из хука, чтобы этой же логикой поиска совпадения мог
// пользоваться и одиночный скан (useScanner), и массовая загрузка
// накладной (useInventoryLogic) — это должна быть ровно одна и та же операция.
export function findItemByCode(inventoryData, code) {
  const lowerCode = String(code).trim().toLowerCase();
  for (const item of inventoryData) {
    if (item.id.toLowerCase() === lowerCode) return { item, matchedImei: null };
    if ((item.barcodes || []).some((barcode) => String(barcode).toLowerCase() === lowerCode)) return { item, matchedImei: null };
    const matchedImei = (item.imeis || []).find((imei) => String(imei).toLowerCase() === lowerCode);
    if (matchedImei) return { item, matchedImei };
  }
  return null;
}

export default function useScanner({
  inventoryData,
  scannedItems,
  scanModeWarehouse,
  scanModeBox,
  socket,
  showToast,
  createHistoryRecord,
  normalizeItemState,
}) {
  const scannerInputRef = useRef(null);
  const [scannerInputValue, setScannerInputValue] = useState('');

  const findItemByCodeInScope = useCallback(
    (code) => findItemByCode(inventoryData, code),
    [inventoryData]
  );

  const handleScannerSubmit = useCallback((scannedValue) => {
    const found = findItemByCodeInScope(scannedValue);
    
    if (!found) {
      showToast(`Код не найден: ${scannedValue}`);
      playErrorBeep();
      
      const historyRecord = createHistoryRecord({
        itemId: null, 
        itemName: 'Невідомо', 
        scannedCode: scannedValue, 
        status: 'NOT_FOUND',
      });
      
      socket.emit('update_scanned_item', { id: null, nextItemState: null, historyRecord });
      return;
    }

    const { item, matchedImei } = found;
    const current = scannedItems[item.id] || { actualQty: 0, imeis: {} };
    const next = { actualQty: current.actualQty || 0, imeis: { ...(current.imeis || {}) } };

   let scanMode;

    if (matchedImei) {
      const updateBaseQty = Boolean(scanModeWarehouse || scanModeBox);
      const updateImeiState = Boolean(scanModeWarehouse || !scanModeBox);

      if (updateImeiState) {
        next.imeis[matchedImei] = (next.imeis[matchedImei] || 0) + 1;
      }
      if (updateBaseQty) {
        next.actualQty += 1;
      }

      if (updateBaseQty && updateImeiState) {
        scanMode = 'WAREHOUSE'; // наименование + пристрій -> Запакований
      } else if (updateBaseQty) {
        scanMode = 'BOX'; // тільки наименование -> Коробка
      } else {
        scanMode = 'DEVICE'; // тільки пристрій -> Пристрій
      }
    } else {
      next.actualQty += 1;
      scanMode = 'BOX';
    }

    const nextItemState = normalizeItemState(next);
    const historyRecord = createHistoryRecord({
      itemId: item.id, itemName: item.name, scannedCode: scannedValue, status: 'OK', scanMode,
    });

    socket.emit('update_scanned_item', { id: item.id, nextItemState, historyRecord });
    playSuccessBeep();
  }, [
    findItemByCodeInScope, scannedItems, scanModeWarehouse, scanModeBox, 
    showToast, createHistoryRecord, socket, normalizeItemState
  ]);

  const handleScannerKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && scannerInputValue.trim() !== '') {
      const value = scannerInputValue.trim();
      setScannerInputValue('');
      handleScannerSubmit(value);
      setTimeout(() => scannerInputRef.current?.focus(), 10);
    }
  }, [scannerInputValue, handleScannerSubmit]);

  return {
    scannerInputRef,
    scannerInputValue,
    setScannerInputValue,
    handleScannerKeyDown,
  };
}