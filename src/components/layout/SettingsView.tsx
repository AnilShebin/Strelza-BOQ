import React, { useState, useEffect } from 'react';
import { Icon } from '../common/Icon';
import { toast } from '../common/Toast';
import { MappingRulesViewer } from '../rules/MappingRulesViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  geminiRateLimit: number;
  handleUpdateDefaultTheme: (theme: 'light' | 'dark') => void;
  handleUpdateRateLimit: (limit: number) => void;
  handleClearCache: () => void;
  clearingCache: boolean;
  cacheClearStatus: { type: 'success' | 'error'; text: string } | null;
  onCancel: () => void;
}

interface AIPrompt {
  id?: number;
  name: string;
  title: string;
  prompt: string;
  enabled: number;
  project_type: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  geminiRateLimit,
  handleUpdateDefaultTheme,
  handleUpdateRateLimit,
  handleClearCache,
  clearingCache,
  cacheClearStatus,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [draftTheme, setDraftTheme] = useState<'light' | 'dark'>(theme);
  const [draftRateLimit, setDraftRateLimit] = useState<number>(geminiRateLimit);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // AI Prompts Tab States
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number>(0);
  const [editingPromptText, setEditingPromptText] = useState<string>('');
  const [editingPromptEnabled, setEditingPromptEnabled] = useState<number>(1);
  const [editingPromptTitle, setEditingPromptTitle] = useState<string>('');

  useEffect(() => {
    setDraftTheme(theme);
  }, [theme]);

  // Load Prompts
  const fetchPrompts = () => {
    fetch('http://localhost:8000/api/prompts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load prompts.');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPrompts(data);
          setSelectedPromptIdx(0);
          setEditingPromptText(data[0].prompt);
          setEditingPromptEnabled(data[0].enabled);
          setEditingPromptTitle(data[0].title);
        }
      })
      .catch(() => {
        // Mock fallback prompts
        const defaultPrompts: AIPrompt[] = [
          {
            id: 1,
            name: 'drawing_schedule_extractor',
            title: 'Drawing Schedule Extractor',
            prompt: 'Extract all tabular takeoff items from the technical drawings and return structured JSON.',
            enabled: 1,
            project_type: 'wireless',
          },
          {
            id: 2,
            name: 'antenna_layout_analyzer',
            title: 'Antenna Layout & Elevation Inspector',
            prompt: 'Analyze sector layout elevations, antenna mounts, RRU allocations, and decommissioning tags.',
            enabled: 1,
            project_type: 'wireless',
          },
        ];
        setPrompts(defaultPrompts);
        setSelectedPromptIdx(0);
        setEditingPromptText(defaultPrompts[0].prompt);
        setEditingPromptEnabled(defaultPrompts[0].enabled);
        setEditingPromptTitle(defaultPrompts[0].title);
      });
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handlePromptChange = (idx: number) => {
    setSelectedPromptIdx(idx);
    setEditingPromptText(prompts[idx]?.prompt || '');
    setEditingPromptEnabled(prompts[idx]?.enabled || 1);
    setEditingPromptTitle(prompts[idx]?.title || '');
  };

  const handleSavePrompt = () => {
    const updated = [...prompts];
    if (updated[selectedPromptIdx]) {
      updated[selectedPromptIdx] = {
        ...updated[selectedPromptIdx],
        title: editingPromptTitle,
        prompt: editingPromptText,
        enabled: editingPromptEnabled,
      };
      setPrompts(updated);
      toast.success('Prompt configuration saved successfully!');
    }
  };

  const handleSaveSettingsPayload = () => {
    handleUpdateDefaultTheme(draftTheme);
    handleUpdateRateLimit(draftRateLimit);
    setSaveSuccess(true);
    toast.success('Workspace settings updated!');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto bg-background text-foreground h-full gap-6 font-sans select-none">
      {/* Header section */}
      <div className="flex flex-col gap-1 shrink-0 pb-2 border-b border-border/60">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
          Workspace Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure application theme, AI extraction rules, rate limits, and cache.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col gap-6 min-h-0">
        <TabsList className="w-fit bg-muted p-1">
          <TabsTrigger value="general" className="text-xs font-semibold cursor-pointer">
            General Preferences
          </TabsTrigger>
          <TabsTrigger value="prompts" className="text-xs font-semibold cursor-pointer">
            AI Prompts & Guidelines
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs font-semibold cursor-pointer">
            Mapping Rules
          </TabsTrigger>
          <TabsTrigger value="database" className="text-xs font-semibold cursor-pointer">
            Database & Cache
          </TabsTrigger>
        </TabsList>

        {/* General Preferences Tab */}
        <TabsContent value="general" className="m-0 flex-1">
          <Card className="bg-card shadow-xs border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">General Preferences</CardTitle>
              <CardDescription className="text-xs">
                Configure theme appearance and Gemini API rate limitations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
                <div>
                  <div className="text-sm font-semibold text-foreground">Theme Appearance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Select your preferred visual mode for the dashboard and tools.
                  </div>
                </div>
                <div className="w-48">
                  <Select
                    value={draftTheme}
                    onValueChange={(val: 'light' | 'dark') => setDraftTheme(val)}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light" className="text-xs">
                        ☀️ Light Theme
                      </SelectItem>
                      <SelectItem value="dark" className="text-xs">
                        🌙 Dark Theme
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rate Limit Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">API Rate Limiting</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Controls the throughput of requests dispatched to Gemini Vision models.
                  </div>
                </div>
                <div className="w-48">
                  <Select
                    value={String(draftRateLimit)}
                    onValueChange={(val) => setDraftRateLimit(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Rate limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15" className="text-xs">
                        15 RPM (4s delay)
                      </SelectItem>
                      <SelectItem value="30" className="text-xs">
                        30 RPM (2s delay)
                      </SelectItem>
                      <SelectItem value="60" className="text-xs">
                        60 RPM (1s delay)
                      </SelectItem>
                      <SelectItem value="0" className="text-xs">
                        Unlimited (Tier 1)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSettingsPayload}>
                Save Changes
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* AI Prompts Tab */}
        <TabsContent value="prompts" className="m-0 flex-1">
          <Card className="bg-card shadow-xs border-border flex flex-col">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">AI Prompts & Guidelines</CardTitle>
                <CardDescription className="text-xs">
                  Customize the system prompt templates passed to Gemini Vision for PDF extraction.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPrompts}
                className="gap-1.5 cursor-pointer shadow-xs"
              >
                <Icon name="refresh" size={13} />
                <span>Reset Defaults</span>
              </Button>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
              {/* Models Sidebar */}
              <div className="md:col-span-4 border border-border rounded-lg p-2 bg-muted/20 space-y-1.5">
                <div className="text-[11px] font-bold text-muted-foreground uppercase px-2 py-1">
                  Extraction Models
                </div>
                {prompts.map((p, idx) => (
                  <button
                    key={p.name}
                    onClick={() => handlePromptChange(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      selectedPromptIdx === idx
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="truncate">{p.title}</span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ml-2 ${
                        p.enabled === 1 ? 'bg-emerald-400' : 'bg-zinc-400'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Prompt Editor */}
              <div className="md:col-span-8 space-y-3 flex flex-col">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Prompt Title
                  </label>
                  <Input
                    value={editingPromptTitle}
                    onChange={(e) => setEditingPromptTitle(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    System Instruction Content
                  </label>
                  <textarea
                    value={editingPromptText}
                    onChange={(e) => setEditingPromptText(e.target.value)}
                    rows={8}
                    className="w-full flex-1 p-3 text-xs font-mono bg-background border border-border rounded-md focus:outline-hidden focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSavePrompt} className="gap-1.5 shadow-xs">
                    <Icon name="check" size={13} />
                    <span>Save Active Prompt</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mapping Rules Tab */}
        <TabsContent value="rules" className="m-0 flex-1">
          <MappingRulesViewer embedded={true} />
        </TabsContent>

        {/* Database & Cache Tab */}
        <TabsContent value="database" className="m-0 flex-1">
          <Card className="bg-card shadow-xs border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Database & Cache Management</CardTitle>
              <CardDescription className="text-xs">
                Purge cached extraction results, vector indices, and temporary OCR files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div>
                  <div className="text-sm font-semibold text-foreground">Clear Session Cache</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Deletes cached candidate sheet images, extraction responses, and OCR tables.
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="gap-1.5 cursor-pointer shadow-xs"
                >
                  <Icon name="trash" size={13} />
                  <span>{clearingCache ? 'Clearing...' : 'Clear Cache'}</span>
                </Button>
              </div>

              {cacheClearStatus && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Icon name="check" size={14} />
                  <span>{cacheClearStatus.text}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
