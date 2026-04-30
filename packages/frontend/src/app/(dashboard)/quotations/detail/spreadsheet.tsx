'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const UNITS = ['UND', 'KG', 'M', 'M2', 'M3', 'GLB', 'HH', 'HM', 'L', 'DIA', 'MES', 'ML', 'JGO'];

interface LocalRow {
  localId: string;
  id: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  isNew: boolean;
  isSaving: boolean;
}

interface LocalSection {
  id: string;
  name: string;
  items: LocalRow[];
  editingName: boolean;
  tempName: string;
  collapsed: boolean;
}

interface SpreadsheetEditorProps {
  quotationId: string;
  sections: any[];
  currency: string;
  token: string;
  onRefresh: () => void;
}

let _counter = 0;
const tempId = () => `tmp-${++_counter}-${Date.now()}`;

function toLocalSections(sections: any[]): LocalSection[] {
  return sections.map(s => ({
    id: s.id,
    name: s.name,
    items: (s.items || []).map((item: any) => ({
      localId: item.id,
      id: item.id,
      description: item.description || '',
      unit: item.unit || 'UND',
      quantity: String(item.quantity ?? ''),
      unitPrice: String(item.unitPrice ?? item.unitCost ?? ''),
      isNew: false,
      isSaving: false,
    })),
    editingName: false,
    tempName: s.name,
    collapsed: false,
  }));
}

export function SpreadsheetEditor({
  quotationId,
  sections,
  currency,
  token,
  onRefresh,
}: SpreadsheetEditorProps) {
  const { addToast } = useToast();
  const [ls, setLs] = useState<LocalSection[]>(() => toLocalSections(sections));
  const [focused, setFocused] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSec, setAddingSec] = useState(false);

  const lsRef = useRef(ls);
  useEffect(() => { lsRef.current = ls; }, [ls]);

  // Sync from parent only when the spreadsheet is not actively being edited
  useEffect(() => {
    if (!focused) {
      setLs(prev => {
        const next = toLocalSections(sections);
        // Preserve collapsed state across reloads
        return next.map(ns => {
          const old = prev.find(os => os.id === ns.id);
          return old ? { ...ns, collapsed: old.collapsed } : ns;
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const updateCell = (sid: string, lid: string, field: keyof LocalRow, value: string) =>
    setLs(prev => prev.map(s => s.id !== sid ? s : {
      ...s,
      items: s.items.map(r => r.localId !== lid ? r : { ...r, [field]: value }),
    }));

  const saveRow = useCallback(async (sid: string, lid: string) => {
    const section = lsRef.current.find(s => s.id === sid);
    const row = section?.items.find(r => r.localId === lid);
    if (!row || !row.description.trim()) return;
    const qty = parseFloat(row.quantity);
    const price = parseFloat(row.unitPrice);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) return;

    setLs(prev => prev.map(s => s.id !== sid ? s : {
      ...s, items: s.items.map(r => r.localId !== lid ? r : { ...r, isSaving: true }),
    }));

    try {
      if (row.isNew) {
        const created = await api.post<any>(
          `/quotations/${quotationId}/sections/${sid}/items`,
          { description: row.description.trim(), unit: row.unit, quantity: qty, unitPrice: price },
          token,
        );
        setLs(prev => prev.map(s => s.id !== sid ? s : {
          ...s,
          items: s.items.map(r => r.localId !== lid ? r : {
            ...r, localId: created.id, id: created.id, isNew: false, isSaving: false,
          }),
        }));
      } else {
        await api.patch(
          `/quotations/${quotationId}/sections/${sid}/items/${row.id}`,
          { description: row.description.trim(), unit: row.unit, quantity: qty, unitPrice: price },
          token,
        );
        setLs(prev => prev.map(s => s.id !== sid ? s : {
          ...s, items: s.items.map(r => r.localId !== lid ? r : { ...r, isSaving: false }),
        }));
      }
      onRefresh();
    } catch (e: any) {
      addToast(e.message, 'error');
      setLs(prev => prev.map(s => s.id !== sid ? s : {
        ...s, items: s.items.map(r => r.localId !== lid ? r : { ...r, isSaving: false }),
      }));
    }
  }, [quotationId, token, onRefresh, addToast]);

  const handleBlur = (sid: string, lid: string) => {
    setTimeout(() => {
      const rowEl = document.getElementById(`row-${lid}`);
      if (!rowEl?.contains(document.activeElement)) {
        saveRow(sid, lid);
      }
    }, 120);
  };

  const deleteRow = async (sid: string, lid: string) => {
    const row = lsRef.current.find(s => s.id === sid)?.items.find(r => r.localId === lid);
    if (!row) return;
    if (row.isNew) {
      setLs(prev => prev.map(s => s.id !== sid ? s : {
        ...s, items: s.items.filter(r => r.localId !== lid),
      }));
      return;
    }
    if (!confirm('¿Eliminar este ítem?')) return;
    try {
      await api.delete(`/quotations/${quotationId}/sections/${sid}/items/${row.id}`, token);
      setLs(prev => prev.map(s => s.id !== sid ? s : {
        ...s, items: s.items.filter(r => r.localId !== lid),
      }));
      onRefresh();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addRow = (sid: string) => {
    const lid = tempId();
    setLs(prev => prev.map(s => s.id !== sid ? s : {
      ...s,
      items: [...s.items, {
        localId: lid, id: null, description: '', unit: 'UND',
        quantity: '1', unitPrice: '', isNew: true, isSaving: false,
      }],
    }));
    setTimeout(() => document.getElementById(`cell-${lid}-desc`)?.focus(), 60);
  };

  const saveSectionName = async (sid: string) => {
    const section = lsRef.current.find(s => s.id === sid);
    if (!section) return;
    const name = section.tempName.trim();
    if (!name || name === section.name) {
      setLs(prev => prev.map(s => s.id !== sid ? s : { ...s, editingName: false }));
      return;
    }
    try {
      await api.put(`/quotations/${quotationId}/sections/${sid}`, { name }, token);
      setLs(prev => prev.map(s => s.id !== sid ? s : { ...s, name, tempName: name, editingName: false }));
      onRefresh();
    } catch (e: any) {
      addToast(e.message, 'error');
      setLs(prev => prev.map(s => s.id !== sid ? s : { ...s, editingName: false, tempName: s.name }));
    }
  };

  const deleteSection = async (sid: string) => {
    if (!confirm('¿Eliminar esta sección y todos sus ítems?')) return;
    try {
      await api.delete(`/quotations/${quotationId}/sections/${sid}`, token);
      setLs(prev => prev.filter(s => s.id !== sid));
      onRefresh();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addSection = async () => {
    const name = newSectionName.trim();
    if (!name) return;
    setAddingSec(true);
    try {
      const created = await api.post<any>(`/quotations/${quotationId}/sections`, { name }, token);
      setLs(prev => [...prev, {
        id: created.id, name: created.name, items: [],
        editingName: false, tempName: created.name, collapsed: false,
      }]);
      setNewSectionName('');
      onRefresh();
      // Auto-focus the first row of the new section after render
      setTimeout(() => document.getElementById(`add-row-btn-${created.id}`)?.click(), 100);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setAddingSec(false); }
  };

  const fmt = (n: number) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Grand total (live from local state)
  const grandTotal = ls.reduce((acc, s) =>
    acc + s.items.reduce((a, r) => {
      const price = parseFloat(r.unitPrice || '0');
      const v = parseFloat(r.quantity || '0') * price;
      return a + (isNaN(v) ? 0 : v);
    }, 0), 0);

  return (
    <div
      className="font-jakarta"
      onFocus={() => setFocused(true)}
      onBlur={() => setTimeout(() => setFocused(false), 200)}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-950">

        {/* ── Column headers (Excel-like) ── */}
        <div className="grid grid-cols-[28px_1fr_72px_96px_112px_112px_36px] bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.12em] px-3 py-2.5 select-none border-b border-white/10">
          <div />
          <div className="pl-1">Descripción del Concepto</div>
          <div className="text-center">Und.</div>
          <div className="text-right">Cantidad</div>
          <div className="text-right">P. Unitario</div>
          <div className="text-right">Subtotal</div>
          <div />
        </div>

        {ls.length === 0 && (
          <div className="py-14 text-center text-sm text-muted-foreground italic">
            Sin secciones. Escribe el nombre de la primera sección abajo.
          </div>
        )}

        {ls.map((section, secIdx) => {
          const secSubtotal = section.items.reduce((a, r) => {
            const price = parseFloat(r.unitPrice || '0');
            const v = parseFloat(r.quantity || '0') * price;
            return a + (isNaN(v) ? 0 : v);
          }, 0);

          return (
            <div key={section.id} className="border-b border-slate-100 dark:border-white/5 last:border-0">

              {/* ── Section header row ── */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/8 to-transparent dark:from-orange-500/5 dark:to-transparent px-3 py-2 border-b border-orange-100 dark:border-orange-500/10">
                {/* Collapse toggle */}
                <button
                  onClick={() => setLs(prev => prev.map(s => s.id !== section.id ? s : { ...s, collapsed: !s.collapsed }))}
                  className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-orange-500 transition-colors shrink-0 rounded"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d={section.collapsed ? 'M9 5l7 7-7 7' : 'M19 9l-7 7-7-7'} />
                  </svg>
                </button>

                {/* Section row letter (A, B, C…) */}
                <span className="text-[10px] font-black text-orange-500/60 w-4 shrink-0 select-none">
                  {String.fromCharCode(65 + secIdx)}
                </span>

                {/* Name (editable on double-click) */}
                {section.editingName ? (
                  <input
                    autoFocus
                    className="flex-1 bg-white dark:bg-slate-800 border border-orange-400 rounded-lg px-2 py-1 text-sm font-black focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    value={section.tempName}
                    onChange={e => setLs(prev => prev.map(s => s.id !== section.id ? s : { ...s, tempName: e.target.value }))}
                    onBlur={() => saveSectionName(section.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveSectionName(section.id);
                      if (e.key === 'Escape') setLs(prev => prev.map(s => s.id !== section.id ? s : { ...s, editingName: false, tempName: s.name }));
                    }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-black text-slate-700 dark:text-slate-200 cursor-pointer select-none hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                    title="Doble clic para renombrar"
                    onDoubleClick={() => setLs(prev => prev.map(s => s.id !== section.id ? s : { ...s, editingName: true }))}
                  >
                    {section.name}
                  </span>
                )}

                {/* Item count + subtotal */}
                <span className="text-[10px] text-slate-400 font-mono ml-auto mr-1 shrink-0 hidden sm:block">
                  {section.items.length} ítem{section.items.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {currency} {fmt(secSubtotal)}
                </span>

                {/* Rename button */}
                <button
                  onClick={() => setLs(prev => prev.map(s => s.id !== section.id ? s : { ...s, editingName: true, tempName: s.name }))}
                  className="p-1 text-slate-300 hover:text-orange-500 hover:bg-orange-500/10 rounded-md transition-all"
                  title="Renombrar sección"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>

                {/* Delete section */}
                <button
                  onClick={() => deleteSection(section.id)}
                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                  title="Eliminar sección"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* ── Item rows ── */}
              {!section.collapsed && (
                <>
                  {section.items.map((row, rowIdx) => {
                    const sub = parseFloat(row.quantity || '0') * parseFloat(row.unitPrice || '0');
                    return (
                      <div
                        key={row.localId}
                        id={`row-${row.localId}`}
                        className={`grid grid-cols-[28px_1fr_72px_96px_112px_112px_36px] items-center px-3 py-0.5 border-b border-slate-50 dark:border-white/3 transition-colors group
                          ${row.isNew ? 'bg-amber-50/60 dark:bg-amber-950/10' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'}`}
                      >
                        {/* Row number */}
                        <div className="text-[10px] text-slate-300 dark:text-slate-600 font-mono text-center select-none">
                          {rowIdx + 1}
                        </div>

                        {/* Description */}
                        <div className="flex items-center min-w-0 pr-1">
                          <input
                            id={`cell-${row.localId}-desc`}
                            className="w-full min-w-0 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 rounded-md px-2 py-1.5 text-sm focus:outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                            placeholder="Descripción del concepto..."
                            value={row.description}
                            onChange={e => updateCell(section.id, row.localId, 'description', e.target.value)}
                            onBlur={() => handleBlur(section.id, row.localId)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') document.getElementById(`cell-${row.localId}-qty`)?.focus();
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                document.getElementById(`cell-${row.localId}-unit`)?.focus();
                              }
                            }}
                          />
                        </div>

                        {/* Unit */}
                        <div>
                          <select
                            id={`cell-${row.localId}-unit`}
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 rounded-md px-1 py-1.5 text-xs text-center font-mono focus:outline-none transition-all cursor-pointer"
                            value={row.unit}
                            onChange={e => updateCell(section.id, row.localId, 'unit', e.target.value)}
                            onBlur={() => handleBlur(section.id, row.localId)}
                            onKeyDown={e => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                document.getElementById(`cell-${row.localId}-qty`)?.focus();
                              }
                            }}
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div>
                          <input
                            id={`cell-${row.localId}-qty`}
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:outline-none transition-all"
                            value={row.quantity}
                            onChange={e => updateCell(section.id, row.localId, 'quantity', e.target.value)}
                            onBlur={() => handleBlur(section.id, row.localId)}
                            onKeyDown={e => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                document.getElementById(`cell-${row.localId}-price`)?.focus();
                              }
                              if (e.key === 'Enter') document.getElementById(`cell-${row.localId}-price`)?.focus();
                            }}
                          />
                        </div>

                        {/* Unit Price */}
                        <div>
                          <input
                            id={`cell-${row.localId}-price`}
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:outline-none transition-all"
                            value={row.unitPrice}
                            onChange={e => updateCell(section.id, row.localId, 'unitPrice', e.target.value)}
                            onBlur={() => handleBlur(section.id, row.localId)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                                e.preventDefault();
                                // Jump to first cell of next row OR add a new row
                                const nextRowIdx = rowIdx + 1;
                                const nextRow = section.items[nextRowIdx];
                                if (nextRow) {
                                  document.getElementById(`cell-${nextRow.localId}-desc`)?.focus();
                                } else {
                                  addRow(section.id);
                                }
                              }
                            }}
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="text-right pr-1">
                          {row.isSaving ? (
                            <span className="text-[10px] text-blue-400 font-mono animate-pulse">···</span>
                          ) : (
                            <span className={`text-sm font-mono font-bold ${!isNaN(sub) && sub > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                              {!isNaN(sub) && sub > 0 ? fmt(sub) : '—'}
                            </span>
                          )}
                        </div>

                        {/* Delete */}
                        <div className="flex justify-center">
                          <button
                            onClick={() => deleteRow(section.id, row.localId)}
                            className="p-1 text-slate-200 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                            title="Eliminar fila"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Add row button ── */}
                  <div
                    id={`add-row-btn-${section.id}`}
                    className="grid grid-cols-[28px_1fr_72px_96px_112px_112px_36px] items-center px-3 py-1.5 hover:bg-green-50/40 dark:hover:bg-green-950/10 cursor-pointer transition-colors group"
                    onClick={() => addRow(section.id)}
                  >
                    <div className="col-span-7 flex items-center gap-1.5 pl-9 text-[11px] text-slate-300 dark:text-slate-600 group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors font-semibold">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar fila
                    </div>
                  </div>

                  {/* ── Section subtotal footer ── */}
                  <div className="grid grid-cols-[28px_1fr_72px_96px_112px_112px_36px] bg-orange-50/40 dark:bg-orange-950/5 px-3 py-2 border-t border-orange-100 dark:border-orange-500/10">
                    <div className="col-span-5 text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-10">
                      Subtotal — {section.name}
                    </div>
                    <div className="text-right text-sm font-mono font-black text-orange-700 dark:text-orange-400 pr-1">
                      {currency} {fmt(secSubtotal)}
                    </div>
                    <div />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* ── Grand total row ── */}
        {ls.length > 0 && (
          <div className="grid grid-cols-[28px_1fr_72px_96px_112px_112px_36px] bg-slate-800 text-white px-3 py-3">
            <div className="col-span-5 text-[10px] font-black uppercase tracking-[0.2em] pl-10 text-slate-400">
              Total antes de impuestos
            </div>
            <div className="text-right text-base font-mono font-black pr-1">
              {currency} {fmt(grandTotal)}
            </div>
            <div />
          </div>
        )}

        {/* ── Add section ── */}
        <div className="px-3 py-3 bg-slate-50/30 dark:bg-slate-900/20 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 flex items-center justify-center text-slate-400 shrink-0">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <input
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all"
              placeholder="Nueva sección (Ej: Materiales, Mano de Obra, Equipos…)  —  Enter para agregar"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !addingSec) addSection(); }}
              disabled={addingSec}
            />
            <button
              onClick={addSection}
              disabled={!newSectionName.trim() || addingSec}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {addingSec ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              )}
              Añadir Sección
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 pl-9">
            Doble clic en el nombre de una sección para renombrarla · Tab / Enter navega entre celdas · Los cambios se guardan automáticamente al salir de la fila
          </p>
        </div>
      </div>
    </div>
  );
}
