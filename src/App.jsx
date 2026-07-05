import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, CheckCircle2, AlertCircle, Calculator, ScanBarcode,
  Database, Play, ArrowRight, FilePlus2, Files, Loader2,
  ScanLine, Clock, Filter, LogOut, Package, Smartphone, Bell,
  Menu, Settings2, X, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

import useInventoryLogic from './useInventoryLogic';
import { getExpectedQty } from './utils';

const glassPanel = "bg-[#e7e8ea] border border-white/70 shadow-[10px_10px_22px_rgba(126,132,141,0.26),-10px_-10px_22px_rgba(255,255,255,0.92)]";
const glassButton = "bg-[#e7e8ea] hover:bg-[#f0f1f3] border border-white/70 shadow-[8px_8px_18px_rgba(126,132,141,0.24),-8px_-8px_18px_rgba(255,255,255,0.92)] transition-all active:shadow-[inset_5px_5px_10px_rgba(126,132,141,0.22),inset_-5px_-5px_10px_rgba(255,255,255,0.9)]";
const glassButtonActive = "bg-emerald-600 text-white border-emerald-500 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.16),inset_-3px_-3px_8px_rgba(255,255,255,0.12)]";
const glassInput = "bg-[#e7e8ea] focus:bg-[#e7e8ea] border border-white/70 shadow-[inset_6px_6px_12px_rgba(126,132,141,0.22),inset_-6px_-6px_12px_rgba(255,255,255,0.92)] outline-none transition-all placeholder-slate-400 focus:border-emerald-400";

const HeaderFilter = ({ activeMenu, setActiveMenu, selectedDeltas, setSelectedDeltas, sortedDeltaKeys, deltaStats }) => {
  const isOpen = activeMenu === 'filter';
  
  return (
    <div className="relative shrink-0 z-30">
      <button
        onClick={() => setActiveMenu(isOpen ? null : 'filter')}
        className={`h-11 px-4 flex items-center justify-center rounded-xl ${selectedDeltas.length > 0 ? glassButtonActive : glassButton + ' text-slate-600'}`}
        title="Фільтр різниці"
      >
        <Filter size={18} />
        {selectedDeltas.length > 0 && <span className="ml-2 font-bold text-sm">{selectedDeltas.length}</span>}
        <span className="ml-2 text-xs font-bold uppercase tracking-wider hidden sm:inline">Фільтр</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
          <div className={`absolute top-[48px] right-0 z-50 w-56 rounded-3xl overflow-hidden flex flex-col ${glassPanel} !bg-white/90 animate-spring-pop`}>
            <div className="px-4 py-3 flex justify-between items-center border-b border-slate-200/50">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Фільтр</span>
              {selectedDeltas.length > 0 && <button onClick={() => setSelectedDeltas([])} className="text-xs text-emerald-700 hover:text-emerald-800 font-medium transition-colors">Скинути</button>}
            </div>
            <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
              {sortedDeltaKeys.map((key) => {
                const isSelected = selectedDeltas.includes(key);
                const toggleDeltaFilter = (k) => setSelectedDeltas((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
                return (
                  <button key={key} onClick={() => toggleDeltaFilter(key)} className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-colors w-full text-left ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300'}`}>
                        {isSelected && <CheckCircle2 size={16} className="text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-base">{key}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-white/60 text-slate-500 shadow-sm border border-slate-200">{deltaStats[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const HeaderSearch = ({ onSearch, activeMenu, setActiveMenu }) => {
  const [draft, setDraft] = useState('');
  const isOpen = activeMenu === 'search';

  const handleKeyDown = (e) => { 
    if (e.key === 'Enter') { 
      onSearch(draft.trim()); 
      setActiveMenu(null); 
    } 
  };

  return (
    <div className="relative flex items-center shrink-0 h-11">
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Пошук (Enter)"
            className={`absolute right-[52px] w-[200px] h-11 px-4 text-sm rounded-xl text-slate-700 ${glassInput} z-50 animate-spring-pop`}
          />
        </>
      )}
      <button 
        onClick={() => setActiveMenu(isOpen ? null : 'search')} 
        className={`h-11 w-11 flex items-center justify-center rounded-xl text-slate-600 transition-colors relative z-50 ${isOpen ? glassButtonActive : glassButton}`}
        title="Пошук"
      >
        {isOpen ? <X size={20} /> : <Search size={20} />}
      </button>
    </div>
  );
};

const WelcomeScreen = ({ onContinue, onBuildDb, onExport, hasActiveSession }) => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 w-full px-4 relative z-10">
    <div className={`${glassPanel} p-6 rounded-3xl text-emerald-600 mb-2`}><Calculator size={56} /></div>
    <h1 className="text-3xl font-bold text-slate-700 text-center">Термінал ТЗД</h1>
    <p className="text-slate-500 text-center mb-4">Локальна інвентаризація та звірка залишків з 1С</p>
    <div className="flex flex-col w-full gap-4 max-w-md mx-auto">
      <button onClick={onContinue} disabled={!hasActiveSession} className={`flex items-center justify-between p-5 rounded-2xl font-semibold text-lg ${hasActiveSession ? glassButton + ' text-emerald-700' : 'bg-white/30 border border-white/30 text-slate-400 cursor-not-allowed backdrop-blur-sm'}`}>
        <span className="flex items-center gap-3"><Play size={20} /> Продовжити сесію</span>
        <ArrowRight size={20} className={hasActiveSession ? 'text-emerald-600' : 'text-slate-300'} />
      </button>
      <button onClick={onExport} disabled={!hasActiveSession} className={`flex items-center justify-between p-5 rounded-2xl font-semibold text-lg ${hasActiveSession ? glassButton + ' text-emerald-700' : 'bg-white/30 border border-white/30 text-slate-400 cursor-not-allowed backdrop-blur-sm'}`}>
        <span className="flex items-center gap-3"><Download size={20} /> Експорт в Excel</span>
        <ArrowRight size={20} className={hasActiveSession ? 'text-emerald-600' : 'text-slate-300'} />
      </button>
      <button onClick={onBuildDb} className={`flex items-center justify-between p-5 rounded-2xl font-semibold text-lg text-slate-700 ${glassButton}`}>
        <span className="flex items-center gap-3"><Database size={20} /> Збірка бази</span>
        <ArrowRight size={20} />
      </button>
    </div>
  </div>
);

const BuildDatabaseScreen = ({ onStart, isProcessing, buildError }) => {
  const [files, setFiles] = useState({ main: null, imei: [], barcode: null });
  const handleFileChange = (type, e) => {
    if (type === 'imei') setFiles((prev) => ({ ...prev, imei: Array.from(e.target.files) }));
    else setFiles((prev) => ({ ...prev, [type]: e.target.files[0] }));
  };
  const isReadyToStart = files.barcode !== null && (files.main !== null || files.imei.length > 0);
  return (
    <div className="w-full px-4 py-4 relative z-10">
      {buildError && (
        <div className={`${glassPanel} !bg-red-50/80 !border-red-200 mb-6 p-4 text-red-600 rounded-2xl flex items-center gap-3`}>
          <AlertCircle size={20} className="shrink-0 text-red-600" />
          <p className="font-medium text-sm whitespace-pre-wrap">{buildError}</p>
        </div>
      )}
      <div className={`space-y-6 p-6 rounded-3xl ${glassPanel}`}>
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-600 uppercase tracking-wide">1. Залишки (Основа)</label>
          <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${glassButton}`}>
            <FilePlus2 className={files.main ? "text-green-500" : "text-slate-400"} size={20} />
            <div className="flex-1 min-w-0"><p className="font-medium text-slate-600 truncate">{files.main ? files.main.name : "Обрати файл .txt"}</p></div>
            <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => handleFileChange('main', e)} />
          </label>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-600 uppercase tracking-wide">2. Залишки IMEI (Можна кілька)</label>
          <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${glassButton}`}>
            <Files className={files.imei.length > 0 ? "text-green-500" : "text-slate-400"} size={20} />
            <div className="flex-1 min-w-0"><p className="font-medium text-slate-600 truncate">{files.imei.length > 0 ? `Обрано файлів: ${files.imei.length}` : "Обрати файли .txt"}</p></div>
            <input type="file" accept=".txt,.csv,.tsv" multiple className="hidden" onChange={(e) => handleFileChange('imei', e)} />
          </label>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-600 uppercase tracking-wide">3. Звірка (Штрихкоди)</label>
          <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${glassButton}`}>
            <ScanBarcode className={files.barcode ? "text-green-500" : "text-slate-400"} size={20} />
            <div className="flex-1 min-w-0"><p className="font-medium text-slate-600 truncate">{files.barcode ? files.barcode.name : "Обрати файл .txt"}</p></div>
            <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => handleFileChange('barcode', e)} />
          </label>
        </div>
      </div>
      <button onClick={() => onStart(files)} disabled={!isReadyToStart || isProcessing} className={`w-full mt-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${isReadyToStart && !isProcessing ? glassButtonActive : 'bg-white/30 border border-white/30 text-slate-400 cursor-not-allowed backdrop-blur-sm shadow-sm'}`}>
        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
        {isProcessing ? 'Збірка бази...' : 'Запуск'}
      </button>
    </div>
  );
};

const InventoryItemCard = ({ item, itemState, onUpdateQty }) => {
  const [mainInput, setMainInput] = useState('');
  const [isMainFocused, setIsMainFocused] = useState(false);
  const [imeiInputs, setImeiInputs] = useState({});
  const [focusedImei, setFocusedImei] = useState(null);

  const expectedQty = getExpectedQty(item);
  const actualQty = itemState?.actualQty;
  const currentActual = actualQty !== undefined && actualQty !== '' ? parseFloat(actualQty) : 0;
  const diff = Number((currentActual - expectedQty).toFixed(3));
  const isOk = diff === 0;
  const isShortage = diff < 0;
  const isSurplus = diff > 0;
  const displayValue = isMainFocused ? mainInput : (actualQty !== undefined ? actualQty : '');
  const handleMainApply = (value) => { if (value.trim() !== '') onUpdateQty(item.id, value, null, true, false); setMainInput(''); };
  const handleImeiApply = (imei, value) => { if (value.trim() !== '') onUpdateQty(item.id, value, imei, false, true); setImeiInputs((p) => ({ ...p, [imei]: '' })); };
  const textColor = isOk ? 'text-green-600' : isShortage ? 'text-red-500' : isSurplus ? 'text-yellow-600' : 'text-slate-700';
  const deltaText = diff > 0 ? `+${diff}` : `${diff}`;
  const hasImeis = item.imeis && item.imeis.length > 0;

  return (
    <div className={`${glassPanel} p-3 sm:p-5 rounded-3xl flex flex-col w-full mb-4 relative z-10`}>
      <div className="flex flex-row items-center justify-between w-full gap-2 sm:gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1 py-1">
          <div className="flex items-start gap-2 flex-wrap">
            <div className="shrink-0 mt-0.5">
              {isOk && <CheckCircle2 className="text-green-600" size={20} />}
              {isShortage && <AlertCircle className="text-red-500" size={20} />}
              {isSurplus && <AlertCircle className="text-yellow-600" size={20} />}
              {!isOk && !isShortage && !isSurplus && <div className="w-5 h-5 rounded-full bg-slate-300/50 border border-white" />}
            </div>
            {hasImeis && (
              <span className="shrink-0 mt-0.5 text-[9px] sm:text-[10px] font-bold bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded shadow-sm border border-amber-300 uppercase tracking-wider">
                Коробка
              </span>
            )}
            <h3 className={`font-bold text-sm sm:text-base break-words leading-tight ${textColor}`} title={item.name}>{item.name}</h3>
            <span className="shrink-0 mt-0.5 text-slate-500 text-[10px] sm:text-[11px] font-mono bg-white/50 border border-white/60 shadow-sm px-1.5 py-0.5 rounded-md">{item.id}</span>
            {item.barcodes && item.barcodes.slice(0, 1).map((bc) => (
              <span key={bc} className="shrink-0 mt-0.5 text-slate-500 text-[10px] sm:text-[11px] font-mono bg-white/50 border border-white/60 shadow-sm px-1.5 py-0.5 rounded-md">{bc}</span>
            ))}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 sm:gap-4">
          <div className="flex flex-col items-center min-w-[32px] sm:min-w-[40px]">
            <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-none mb-1 sm:mb-2">Облік</span>
            <span className="text-sm sm:text-base font-bold text-slate-600 leading-none">{expectedQty}</span>
          </div>
          <div className="flex flex-col items-center min-w-[36px] sm:min-w-[48px]">
            <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-none mb-1 sm:mb-2">Різн</span>
            <span className={`text-sm sm:text-base font-bold leading-none ${textColor}`}>{deltaText}</span>
          </div>
          <div className="relative w-16 sm:w-24">
            <input
              type="text"
              className={`w-full text-center font-bold text-base sm:text-lg h-10 sm:h-12 rounded-xl ${glassInput} ${textColor}`}
              placeholder="0"
              value={displayValue}
              onChange={(e) => setMainInput(e.target.value)}
              onFocus={() => { setIsMainFocused(true); setMainInput(''); }}
              onBlur={() => { setIsMainFocused(false); handleMainApply(mainInput); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleMainApply(mainInput); e.target.blur(); } }}
            />
          </div>
        </div>
      </div>
      
      {hasImeis && (
        <div className="w-full mt-3 pt-3 border-t border-white/40 flex flex-col gap-2">
          {item.imeis.map((imei) => {
            const imeiActual = itemState?.imeis?.[imei] !== undefined ? itemState.imeis[imei] : 0;
            const imeiDiff = imeiActual - 1;
            const imeiVal = focusedImei === imei ? (imeiInputs[imei] || '') : (imeiActual !== 0 ? imeiActual : '');
            const isScanned = imeiActual > 0;
            const imeiColor = imeiDiff === 0 ? 'text-green-600' : imeiDiff > 0 ? 'text-yellow-600' : 'text-slate-500';

            return (
              <div key={imei} className={`flex flex-row items-center justify-between w-full gap-2 py-1.5 sm:py-2 pl-1.5 sm:pl-2 rounded-xl transition-all ${isScanned ? 'bg-white/60 shadow-sm border border-white/50' : 'bg-transparent'}`}>
                
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300/70 shrink-0"></div>
                  <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 border shadow-sm ${isScanned ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white/40 text-slate-500 border-white/50'}`}>Пристрій</span>
                  <span className={`text-[10px] sm:text-[12px] font-mono font-bold px-1 py-0.5 rounded-md truncate ${isScanned ? 'text-green-600' : 'text-slate-600'}`}>{imei}</span>
                </div>

                <div className="shrink-0 flex items-center justify-end gap-2 sm:gap-4">
                  <div className="flex flex-col items-center min-w-[32px] sm:min-w-[40px]">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-none mb-1 sm:mb-2">Облік</span>
                    <span className="text-sm sm:text-base font-bold text-slate-600 leading-none">1</span>
                  </div>
                  <div className="flex flex-col items-center min-w-[36px] sm:min-w-[48px]">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-none mb-1 sm:mb-2">Різн</span>
                    <span className={`text-sm sm:text-base font-bold leading-none ${imeiColor}`}>{imeiDiff > 0 ? `+${imeiDiff}` : imeiDiff}</span>
                  </div>
                  <div className="relative w-16 sm:w-24">
                    <input
                      type="text"
                      className={`w-full text-center font-bold text-base sm:text-lg h-10 sm:h-12 rounded-xl ${glassInput} ${imeiColor}`}
                      placeholder="0"
                      value={imeiVal}
                      onChange={(e) => setImeiInputs((p) => ({ ...p, [imei]: e.target.value }))}
                      onFocus={() => setFocusedImei(imei)}
                      onBlur={() => { setFocusedImei(null); handleImeiApply(imei, imeiInputs[imei] || ''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { handleImeiApply(imei, imeiInputs[imei] || ''); e.target.blur(); } }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ScanHistoryCard = ({ record, inventoryData }) => {
  const { itemId, itemName, scannedCode, time, status, scanMode } = record;
  const modeLabel = scanMode === 'WAREHOUSE' ? 'Запакований' : scanMode === 'BOX' ? 'Коробка' : scanMode === 'DEVICE' ? 'Пристрій' : null;
  const notFound = status === 'NOT_FOUND' || !itemId;
  const item = !notFound ? (inventoryData.find((i) => i.id === itemId) || { id: itemId, name: itemName || 'Товар', barcodes: [], imeis: [] }) : null;

  if (notFound) {
    return (
      <div className={`${glassPanel} p-4 rounded-3xl flex items-center gap-4 justify-between w-full mb-3 border-2 border-dashed border-amber-300/80`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <AlertCircle className="text-amber-500 shrink-0" size={20} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-amber-600 text-sm leading-tight">Код не знайдено</p>
            <p className="text-xs font-mono text-slate-500 truncate">{scannedCode}</p>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-400 shrink-0">{time}</span>
      </div>
    );
  }

  return (
    <div className={`${glassPanel} p-3 sm:p-4 rounded-3xl flex flex-row items-center gap-2 sm:gap-4 justify-between w-full mb-3 relative z-10`}>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 sm:gap-2">
        <div className="flex items-start gap-2 w-full min-w-0">
          <div className="shrink-0 flex items-center justify-center mt-0.5"><CheckCircle2 className="text-emerald-600" size={18} /></div>
          {modeLabel && (
            <span className="shrink-0 mt-0.5 text-[9px] sm:text-[10px] font-bold bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded shadow-sm border border-amber-300 uppercase tracking-wider">
              {modeLabel}
            </span>
          )}
          <h3 className="font-bold text-slate-700 text-xs sm:text-sm break-words flex-1 min-w-0 leading-tight" title={item.name}>{item.name}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-6 sm:ml-7">
          <span className={`shrink-0 text-[13px] sm:text-[15px] font-mono px-1.5 py-0.5 rounded-md border shadow-sm ${scannedCode.toLowerCase() === item.id.toLowerCase() ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>{item.id}</span>
          {scannedCode.toLowerCase() !== item.id.toLowerCase() && (
            <span className="shrink-0 text-[13px] sm:text-[15px] font-mono px-1.5 py-0.5 rounded-md border border-indigo-200 shadow-sm bg-indigo-50 text-indigo-700">{scannedCode}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-end gap-3 sm:gap-5">
        <div className="flex flex-col items-end min-w-[40px] sm:min-w-[60px]">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-none mb-1 sm:mb-2">Час</span>
          <span className="text-xs sm:text-sm font-bold text-slate-600 leading-none">{time}</span>
        </div>
        <div className="flex flex-col items-center min-w-[30px] sm:min-w-[40px]">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-none mb-1 sm:mb-2">Статус</span>
          {status === 'MANUAL'
            ? <span className="text-[10px] sm:text-sm font-black text-slate-600 leading-none tracking-wide">Ручний</span>
            : <span className="text-base sm:text-xl font-black text-emerald-600 leading-none tracking-wider">+1</span>}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const v = useInventoryLogic();
  const [renderLimit, setRenderLimit] = useState(15);
  const [activeMenu, setActiveMenu] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleWindowScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const clientHeight = window.innerHeight;
      const scrollHeight = document.documentElement.scrollHeight;
      if (scrollHeight - (scrollTop + clientHeight) <= clientHeight * 1.5) {
        setRenderLimit((prev) => prev + 15);
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  useEffect(() => {
    setRenderLimit(15);
  }, [v.activeListTab, v.searchQuery, v.currentScreen]);

  const handleExportExcel = () => {
    if (v.inventoryData.length === 0) return;

    const exportData = [];

    v.inventoryData.forEach(item => {
      const itemState = v.scannedItems[item.id] || {};
      const expected = getExpectedQty(item);
      const actual = itemState.actualQty !== undefined && itemState.actualQty !== '' ? parseFloat(itemState.actualQty) : 0;
      const diff = Number((actual - expected).toFixed(3));
      
      let itemStatus = 'ОК';
      if (diff < 0) itemStatus = 'Недостача';
      if (diff > 0) itemStatus = 'Надлишок';
      if (actual === 0 && expected > 0) itemStatus = 'Не знайдено';

      exportData.push({
        "Код": item.id,
        "Назва": item.name,
        "Штрихкоди": item.barcodes ? item.barcodes.join(', ') : '',
        "Тип запису": "Загальний підсумок",
        "IMEI": "",
        "Облік (План)": expected,
        "Факт": actual,
        "Різниця": diff,
        "Статус": itemStatus
      });

      const plannedImeis = item.imeis || [];
      const scannedImeisObj = itemState.imeis || {};
      const scannedImeis = Object.keys(scannedImeisObj);
      
      if (plannedImeis.length > 0 || scannedImeis.length > 0) {
        const allImeis = Array.from(new Set([...plannedImeis, ...scannedImeis]));
        
        allImeis.forEach(imei => {
          const planQty = plannedImeis.includes(imei) ? 1 : 0;
          const factQty = scannedImeisObj[imei] || 0;
          const imeiDiff = factQty - planQty;
          
          let imeiStatus = 'ОК';
          if (planQty === 1 && factQty === 0) imeiStatus = 'Відсутній';
          if (planQty === 0 && factQty > 0) imeiStatus = 'Надлишок';
          if (planQty === 1 && factQty > 0) imeiStatus = 'Знайдено';

          exportData.push({
            "Код": item.id,
            "Назва": item.name,
            "Штрихкоди": "",
            "Тип запису": "Пристрій (IMEI)",
            "IMEI": imei,
            "Облік (План)": planQty,
            "Факт": factQty,
            "Різниця": imeiDiff,
            "Статус": imeiStatus
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    worksheet['!cols'] = [
      {wch: 15}, {wch: 40}, {wch: 15}, {wch: 20},
      {wch: 20}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 15}
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Інвентаризація");
    
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `inventory_export_${date}.xlsx`);
  };

  const visibleData = useMemo(() => v.filteredData.slice(0, renderLimit), [v.filteredData, renderLimit]);

  return (
    <div className="min-h-screen w-full bg-[#e2e3e6] font-sans text-slate-700 relative">
      {v.toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-[pulse_0.3s_ease-in-out]">
          <div className={`${glassPanel} !bg-white/80 text-slate-700 px-6 py-4 rounded-3xl font-bold flex items-center gap-3 shadow-xl`}>
            <Bell size={20} className="text-emerald-600" /> {v.toastMessage}
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 border-b shadow-[0_10px_24px_rgba(126,132,141,0.22)] py-4 px-4 transition-colors duration-300 ${
        v.scanModeWarehouse ? 'bg-amber-100 border-amber-300' :
        v.scanModeBox ? 'bg-indigo-100 border-indigo-300' :
        'bg-[#e2e3e6] border-white/70'
      }`}>
        <div className="flex flex-nowrap items-center justify-between gap-3 w-full max-w-7xl mx-auto">

          {/* Левый блок */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => v.setCurrentScreen('START')} className={`h-11 w-11 flex items-center justify-center rounded-xl text-slate-500 ${glassButton}`} title="До головного меню">
              <LogOut size={20} />
            </button>

            <div className="relative shrink-0 z-50">
              <button 
                onClick={() => setActiveMenu(activeMenu === 'nav' ? null : 'nav')} 
                className={`h-11 w-11 flex items-center justify-center rounded-xl text-slate-600 ${activeMenu === 'nav' ? glassButtonActive : glassButton}`}
                title="Меню вкладок"
              >
                <Menu size={20} />
              </button>
              
              {activeMenu === 'nav' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
                  <div className={`absolute top-[52px] left-0 z-50 flex flex-col gap-2 p-3 rounded-3xl ${glassPanel} !bg-white/90 min-w-[200px] animate-spring-pop`}>
                    <button onClick={() => { v.handleTabChange('MAIN'); setActiveMenu(null); }} className={`flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold w-full text-left ${v.activeListTab === 'MAIN' && v.currentScreen === 'WORK' ? glassButtonActive : 'text-slate-600 hover:bg-slate-100'}`}>
                      <Package size={22} className="shrink-0" /> База
                    </button>
                    <button onClick={() => { v.handleTabChange('IMEI'); setActiveMenu(null); }} className={`flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold w-full text-left ${v.activeListTab === 'IMEI' && v.currentScreen === 'WORK' ? glassButtonActive : 'text-slate-600 hover:bg-slate-100'}`}>
                      <Smartphone size={22} className="shrink-0" /> IMEI
                    </button>
                    <div className="h-px w-full bg-slate-200 my-1"></div>
                    <button onClick={() => { fileInputRef.current?.click(); setActiveMenu(null); }} className={`flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold w-full text-left text-slate-600 hover:bg-slate-100`}>
                      <FilePlus2 size={22} className="shrink-0" /> Завантажити переміщення
                    </button>
                    <input type="file" accept=".txt,.csv,.tsv" className="hidden" ref={fileInputRef} onChange={v.handleBulkTransfer} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Центральный блок */}
          <div className="flex items-center justify-center gap-2 shrink-0 flex-1">
            
            <div className="relative shrink-0 z-50">
              <button 
                onClick={() => setActiveMenu(activeMenu === 'mode' ? null : 'mode')} 
                className={`h-11 px-3 flex items-center justify-center gap-2 rounded-xl text-xs font-bold ${(v.scanModeWarehouse || v.scanModeBox) ? glassButtonActive : glassButton + ' text-slate-600'}`}
              >
                <Settings2 size={18} />
                <span className="hidden sm:inline">
                  Режим {v.scanModeWarehouse ? '(Склад)' : v.scanModeBox ? '(Коробка)' : ''}
                </span>
              </button>

              {activeMenu === 'mode' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
                  <div className={`absolute top-[52px] left-0 sm:left-1/2 sm:-translate-x-1/2 z-50 flex flex-col gap-2 p-3 rounded-3xl ${glassPanel} !bg-white/90 min-w-[180px] animate-spring-pop`}>
                    <button onClick={() => { v.toggleWarehouse(); setActiveMenu(null); }} className={`px-5 py-4 rounded-xl text-sm font-bold w-full text-left ${v.scanModeWarehouse ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                      📦 Склад
                    </button>
                    <button onClick={() => { v.toggleBox(); setActiveMenu(null); }} className={`px-5 py-4 rounded-xl text-sm font-bold w-full text-left ${v.scanModeBox ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                      📥 Коробка
                    </button>
                  </div>
                </>
              )}
            </div>

            <input
              ref={v.scannerInputRef}
              type="text"
              autoFocus
              className={`h-11 w-full max-w-[260px] box-border flex items-center justify-center text-center text-sm font-bold tracking-wide rounded-xl text-slate-700 ${glassInput} ${v.scanModeWarehouse ? '!border-amber-400' : v.scanModeBox ? '!border-indigo-400' : ''}`}
              placeholder="Скан штрихкоду"
              value={v.scannerInputValue}
              onChange={(e) => v.setScannerInputValue(e.target.value)}
              onKeyDown={v.handleScannerKeyDown}
            />

            <button 
              onClick={() => v.setCurrentScreen('SCAN')} 
              className={`h-11 px-3 sm:px-4 flex items-center justify-center gap-2 rounded-xl text-sm font-bold shrink-0 ${v.currentScreen === 'SCAN' ? glassButtonActive : glassButton + ' text-slate-600'}`} 
              title="Історія"
            >
              <ScanLine size={20} />
              <span className="hidden lg:inline">Історія</span>
            </button>
          </div>

          {/* Правый блок */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <div className="flex h-11 w-[90px] sm:w-[120px] flex-col items-center justify-center text-center px-2 rounded-xl bg-white/70 border border-slate-200/90 shrink-0">
              <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Прогрес</span>
              <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm leading-none tracking-tight">{v.progressScanned} / {v.progressTotal}</span>
            </div>
            
            <HeaderSearch onSearch={v.setSearchQuery} activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          </div>

        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 pb-12 pt-4 space-y-6 relative z-10">
        {v.currentScreen === 'START' && (
          <WelcomeScreen onContinue={() => v.setCurrentScreen('WORK')} onBuildDb={() => v.setCurrentScreen('BUILD')} onExport={handleExportExcel} hasActiveSession={v.inventoryData.length > 0} />
        )}

        {v.currentScreen === 'BUILD' && (
          <BuildDatabaseScreen onStart={v.handleStartProcessing} isProcessing={v.isProcessing} buildError={v.buildError} />
        )}

        {v.currentScreen === 'WORK' && (
          <section className="flex flex-col gap-2">
            
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-2">Список товарів</h2>
              <HeaderFilter
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                selectedDeltas={v.selectedDeltas}
                setSelectedDeltas={v.setSelectedDeltas}
                sortedDeltaKeys={v.sortedDeltaKeys}
                deltaStats={v.deltaStats}
              />
            </div>

            {visibleData.length === 0 ? (
              <div className={`text-center py-16 rounded-3xl mt-4 ${glassPanel}`}>
                <Search size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-bold text-slate-500">Нічого не знайдено</p>
              </div>
            ) : (
              visibleData.map((item) => <InventoryItemCard key={item.id} item={item} itemState={v.scannedItems[item.id]} onUpdateQty={v.handleUpdateQty} />)
            )}
          </section>
        )}

        {v.currentScreen === 'SCAN' && (
          <div className="flex flex-col gap-6 w-full pt-4">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center gap-3 ml-2 px-4 py-2 rounded-xl w-max bg-white/75 border border-slate-200/90 shadow-sm"><Clock size={18} /> Історія сканування ({v.scanHistory.length})</h3>
              {v.scanHistory.length === 0 ? (
                <div className={`text-center py-16 rounded-3xl ${glassPanel}`}><ScanLine size={56} className="mx-auto mb-4 text-slate-400" /><p className="font-bold text-lg text-slate-500">Чекаю на перший штрихкод</p></div>
              ) : (
                v.scanHistory.map((record) => <ScanHistoryCard key={record.scanId} record={record} inventoryData={v.inventoryData} />)
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}