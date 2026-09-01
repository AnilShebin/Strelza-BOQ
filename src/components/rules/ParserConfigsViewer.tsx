import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../common/Icon';
import { toast, confirmModal } from '../common/Toast';

export interface ParserConfigItem {
  id: number;
  config_key: string;
  category: 'REGEX' | 'KEYWORDS' | 'TABLE_TITLES' | string;
  name: string;
  pattern_value: string;
  description: string;
  is_active: number;
}

export const ParserConfigsViewer: React.FC = () => {
  const [configs, setConfigs] = useState<ParserConfigItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingConfig, setEditingConfig] = useState<ParserConfigItem | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Regex Tester State
  const [testPattern, setTestPattern] = useState<string>('\\b(A[0-9]{1,2}(?:\\s*\\(OLD\\))?)\\b');
  const [testSampleText, setTestSampleText] = useState<string>('PROPOSED TELSTRA LTE700 (3 OFF A1, A5 & A9) AT E.L. 29.0m');
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/parser-configs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ParserConfigs] Failed to load configs:', err);
      toast.error('Failed to load drawing parser configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    configs.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [configs]);

  const filteredConfigs = useMemo(() => {
    return configs.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.config_key.toLowerCase().includes(q) ||
        c.pattern_value.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [configs, selectedCategory, searchQuery]);

  const handleOpenEdit = (cfg: ParserConfigItem) => {
    setEditingConfig(cfg);
    setEditValue(cfg.pattern_value);
  };

  const handleSaveEdit = async () => {
    if (!editingConfig) return;
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:8000/api/parser-configs/${editingConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_value: editValue,
          is_active: editingConfig.is_active,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Updated ${editingConfig.name} successfully.`);
      setConfigs((prev) =>
        prev.map((c) => (c.id === editingConfig.id ? { ...c, pattern_value: editValue } : c))
      );
      setEditingConfig(null);
    } catch (err) {
      console.error('[ParserConfigs] Save error:', err);
      toast.error('Failed to update parser configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    confirmModal({
      title: 'Reset Parser Regexes to Defaults',
      message: 'Are you sure you want to reset all drawing regexes, keyword exclusion lists, and schedule title filters to the default Telstra standard?',
      confirmText: 'Reset to Defaults',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch('http://localhost:8000/api/parser-configs/reset-defaults', {
            method: 'POST',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success('Restored default drawing parser configurations.');
          await fetchConfigs();
        } catch (err) {
          console.error('[ParserConfigs] Reset error:', err);
          toast.error('Failed to reset parser configs.');
        }
      },
    });
  };

  const runRegexTest = async () => {
    if (!testPattern || !testSampleText) return;
    setIsTesting(true);
    try {
      const res = await fetch('http://localhost:8000/api/parser-configs/test-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: testPattern,
          sample_text: testSampleText,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error('[ParserConfigs] Regex test error:', err);
      setTestResults({ is_valid: false, error: 'Request failed', matches: [] });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-app text-text-primary p-6 overflow-hidden">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="sliders" size={18} className="text-accent-blue" />
            <h1 className="text-base font-bold text-text-primary">Drawing Parser Regex & Keyword Engine</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-semibold font-mono">
              {configs.length} Configs
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Configure drawing text regexes, physical dimension parsers, antenna callout extractors, and schedule title filters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-semibold border border-border-color hover:bg-rose-500/10 text-text-secondary hover:text-rose-500 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset all parser patterns to standard defaults"
          >
            <Icon name="refresh" size={14} />
            <span>Reset Default Patterns</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Configs List (Left) + Interactive Regex Tester (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
        {/* Left Column: Configs Table (8 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-bg-panel border border-border-color rounded-xl overflow-hidden shadow-sm min-h-0">
          {/* Filters */}
          <div className="p-3 border-b border-border-color flex items-center justify-between gap-3 bg-bg-app/50 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-accent-blue text-white shadow-sm'
                      : 'bg-bg-panel text-text-secondary hover:text-text-primary border border-border-color'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-52 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search parser settings..."
                className="w-full h-7 pl-7 pr-3 text-xs bg-bg-panel border border-border-color rounded-lg outline-none focus:border-accent-blue text-text-primary"
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                <Icon name="search" size={12} />
              </div>
            </div>
          </div>

          {/* Configs Table */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-bg-app border-b border-border-color text-text-muted font-bold z-10 select-none">
                <tr>
                  <th className="py-2.5 px-3 min-w-[140px]">Setting / Name</th>
                  <th className="py-2.5 px-3 w-[90px] text-center">Type</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Active Pattern / Value</th>
                  <th className="py-2.5 px-3 w-[70px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color-light">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-3"><div className="h-4 bg-border-color/30 rounded w-32"></div></td>
                      <td className="py-3 px-3"><div className="h-4 bg-border-color/30 rounded w-16 mx-auto"></div></td>
                      <td className="py-3 px-3"><div className="h-4 bg-border-color/30 rounded w-48"></div></td>
                      <td className="py-3 px-3"><div className="h-4 bg-border-color/30 rounded w-10 mx-auto"></div></td>
                    </tr>
                  ))
                ) : filteredConfigs.length > 0 ? (
                  filteredConfigs.map((cfg) => (
                    <tr key={cfg.id} className="hover:bg-bg-app/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-text-primary text-xs">{cfg.name}</div>
                        <div className="font-mono text-[10px] text-text-muted mt-0.5">{cfg.config_key}</div>
                        <div className="text-[10px] text-text-muted/80 line-clamp-1 mt-0.5" title={cfg.description}>
                          {cfg.description}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border uppercase tracking-wider ${
                          cfg.category === 'REGEX'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/25'
                            : cfg.category === 'KEYWORDS'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                        }`}>
                          {cfg.category}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <div
                          className="font-mono text-[11px] text-accent-blue bg-bg-app/90 p-2 rounded-lg border border-border-color shadow-inner break-words cursor-pointer hover:border-accent-blue transition-colors"
                          onClick={() => {
                            if (cfg.category === 'REGEX') {
                              setTestPattern(cfg.pattern_value);
                            }
                            handleOpenEdit(cfg);
                          }}
                          title="Click to edit pattern or send to regex tester"
                        >
                          {cfg.pattern_value}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleOpenEdit(cfg)}
                          className="p-1.5 text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 rounded transition-colors cursor-pointer"
                          title="Edit pattern"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-text-muted">
                      No parser settings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Live Regex Tester & Group Inspector (5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-bg-panel border border-border-color rounded-xl overflow-hidden shadow-sm min-h-0">
          <div className="px-4 py-3 border-b border-border-color bg-bg-app/60 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Icon name="play" size={14} className="text-emerald-400" />
              <span>Interactive Regex Tester & Inspector</span>
            </h2>
            <button
              onClick={runRegexTest}
              disabled={isTesting}
              className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Icon name="play" size={12} />
              <span>{isTesting ? 'Testing...' : 'Test Pattern'}</span>
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                Regex Pattern to Test
              </label>
              <input
                type="text"
                value={testPattern}
                onChange={(e) => setTestPattern(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded-lg outline-none focus:border-accent-blue font-mono font-bold text-accent-blue"
                placeholder="e.g. \\b(A[0-9]{1,2})\\b"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                Sample Drawing Text / Callout
              </label>
              <textarea
                rows={3}
                value={testSampleText}
                onChange={(e) => setTestSampleText(e.target.value)}
                className="w-full p-2.5 text-xs bg-bg-app border border-border-color rounded-lg outline-none focus:border-accent-blue font-mono text-text-primary leading-relaxed resize-none"
                placeholder="Paste drawing text here to test match..."
              />
            </div>

            {/* Test Results Output */}
            <div>
              <div className="text-[11px] font-bold text-text-secondary uppercase mb-1 flex items-center justify-between">
                <span>Matched Results</span>
                {testResults && (
                  <span className={`text-[10px] font-mono font-bold ${
                    testResults.is_valid ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {testResults.is_valid ? `${testResults.match_count} Match(es) Found` : 'Syntax Error'}
                  </span>
                )}
              </div>

              {testResults ? (
                <div className="bg-bg-app border border-border-color rounded-lg p-3 space-y-2.5">
                  {testResults.is_valid ? (
                    testResults.matches.length > 0 ? (
                      testResults.matches.map((m: any, idx: number) => (
                        <div key={idx} className="p-2 rounded bg-bg-panel border border-border-color/80 text-xs font-mono">
                          <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
                            <span>Match #{idx + 1}: "{m.match}"</span>
                            <span className="text-[10px] text-text-muted">Span: [{m.span.join(', ')}]</span>
                          </div>
                          {m.groups && m.groups.length > 0 && (
                            <div className="text-[10.5px] text-text-secondary space-y-0.5 pl-2 border-l border-border-color">
                              {m.groups.map((grp: string, gIdx: number) => (
                                <div key={gIdx}>
                                  <span className="text-accent-blue">Group {gIdx + 1}:</span> <span className="text-text-primary">"{grp}"</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-text-muted italic py-2 text-center">
                        No matches found in the sample text.
                      </div>
                    )
                  ) : (
                    <div className="text-xs text-rose-400 font-mono py-2">
                      Error: {testResults.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-bg-app border border-border-color rounded-lg p-4 text-center text-xs text-text-muted italic">
                  Click "Test Pattern" to evaluate regex against sample text.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Config Modal */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-color rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
            <div className="px-5 py-3.5 border-b border-border-color flex items-center justify-between bg-bg-app">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Icon name="edit" size={16} className="text-accent-blue" />
                <span>Edit Drawing Parser Setting</span>
              </h2>
              <button
                onClick={() => setEditingConfig(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                  Setting Name & Key
                </label>
                <div className="text-xs font-bold text-text-primary">{editingConfig.name}</div>
                <div className="text-[10.5px] font-mono text-text-muted">{editingConfig.config_key}</div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                  Pattern / Values *
                </label>
                <textarea
                  rows={4}
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-2.5 text-xs bg-bg-app border border-border-color rounded-lg outline-none focus:border-accent-blue font-mono font-bold text-accent-blue resize-none"
                  placeholder="Enter regex pattern or comma-separated keywords..."
                />
              </div>

              <div className="text-xs text-text-muted">
                {editingConfig.description}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setEditingConfig(null)}
                  className="px-4 py-1.5 text-xs font-semibold border border-border-color hover:bg-bg-app text-text-secondary rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Setting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
