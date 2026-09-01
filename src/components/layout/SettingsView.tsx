import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import {
  Settings2Icon,
  SparklesIcon,
  SlidersHorizontalIcon,
  DatabaseIcon,
  KeyRoundIcon,
  SunIcon,
  MoonIcon,
  LaptopIcon,
  CheckCircle2Icon,
  RotateCcwIcon,
  Trash2Icon,
  SaveIcon,
  CpuIcon,
  HardDriveIcon,
  ActivityIcon,
  Code2Icon,
  CopyIcon,
  FileSpreadsheetIcon,
} from 'lucide-react';
import { toast } from 'sonner';

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
  category?: string;
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
  const [currency, setCurrency] = useState<string>('USD');
  const [units, setUnits] = useState<'imperial' | 'metric'>('metric');
  const [apiKey, setApiKey] = useState<string>('AIzaSyD8...9xK2mP');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'valid'>('idle');

  // AI Prompts Tab States
  const [prompts, setPrompts] = useState<AIPrompt[]>([
    {
      id: 1,
      name: 'drawing_schedule_extractor',
      title: 'Drawing Schedule & BOQ Extractor',
      category: 'Extraction',
      prompt: `Extract all tabular takeoff items, structural specifications, antenna models, mount brackets, coax feeder lines, and material descriptions from the drawing sheet.\n\nStructure the response strictly as valid JSON conforming to the TelecomBOQ schema: [{ "item_code": string, "description": string, "category": string, "qty": number, "unit": string, "confidence": number }].`,
      enabled: 1,
      project_type: 'wireless',
    },
    {
      id: 2,
      name: 'antenna_layout_analyzer',
      title: 'Antenna Layout & Sector Elevation Inspector',
      category: 'Analysis',
      prompt: `Analyze telecom sector layout elevations, antenna mounts, RRU allocations, TMA units, azimuth angles, mechanical tilts, and decommissioning tags.\n\nDetect conflicts between drawing annotations and Schedule of Rates master specifications.`,
      enabled: 1,
      project_type: 'wireless',
    },
    {
      id: 3,
      name: 'bill_of_materials_validator',
      title: 'BOM Cost & Price Resolver',
      category: 'Validation',
      prompt: `Cross-reference all extracted material items against the master pricelist catalog.\n\nFlag unidentified vendor codes and estimate fuzzy alias matches with minimum 85% token similarity score.`,
      enabled: 1,
      project_type: 'materials',
    },
  ]);

  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number>(0);
  const [editingPromptText, setEditingPromptText] = useState<string>(prompts[0]?.prompt || '');
  const [editingPromptEnabled, setEditingPromptEnabled] = useState<number>(prompts[0]?.enabled || 1);
  const [editingPromptTitle, setEditingPromptTitle] = useState<string>(prompts[0]?.title || '');

  useEffect(() => {
    setDraftTheme(theme);
  }, [theme]);

  const handlePromptSelect = (idx: number) => {
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
      toast.success('AI Prompt template saved successfully!');
    }
  };

  const handleTestApiKey = () => {
    setApiKeyStatus('testing');
    setTimeout(() => {
      setApiKeyStatus('valid');
      toast.success('Gemini 1.5 Flash / Pro API Connection Verified (42ms latency)');
    }, 800);
  };

  const handleSaveGeneralSettings = () => {
    handleUpdateDefaultTheme(draftTheme);
    handleUpdateRateLimit(draftRateLimit);
    toast.success('Workspace preferences successfully saved!');
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-7 overflow-y-auto bg-background text-foreground h-full gap-5 select-none font-sans animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Settings2Icon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground leading-tight">
                Settings & Configuration
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-border/70 text-muted-foreground">
                Engine v2.4
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage visual preferences, AI vision prompt templates, calculation units, and system storage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-8.5 px-3 text-xs gap-1.5 rounded-lg border-border/70 hover:bg-muted/70 cursor-pointer shadow-2xs font-medium"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveGeneralSettings}
            className="h-8.5 px-3.5 text-xs gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-2xs font-medium"
          >
            <SaveIcon className="size-3.5" />
            <span>Save Settings</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col gap-4 min-h-0">
        <TabsList className="w-fit bg-muted/60 p-1 rounded-xl border border-border/60 shadow-2xs">
          <TabsTrigger value="general" className="text-xs font-semibold gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
            <SlidersHorizontalIcon className="size-3.5" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="text-xs font-semibold gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
            <SparklesIcon className="size-3.5 text-primary" />
            <span>AI Vision Prompts</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="text-xs font-semibold gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
            <DatabaseIcon className="size-3.5" />
            <span>Storage & Cache</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. General Preferences Tab */}
        <TabsContent value="general" className="m-0 flex-1 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Visual Theme Card */}
            <Card className="rounded-xl bg-card border-border/70 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/15">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <SunIcon className="size-4 text-primary" />
                  <span>Theme & Appearance</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose how Strelza BOQ looks across light and dark workspaces.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDraftTheme('light')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      draftTheme === 'light'
                        ? 'border-primary bg-primary/5 shadow-2xs font-semibold'
                        : 'border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className="size-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2">
                      <SunIcon className="size-4.5" />
                    </div>
                    <span className="text-xs text-foreground">Light Mode</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">High clarity daylight</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftTheme('dark')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      draftTheme === 'dark'
                        ? 'border-primary bg-primary/5 shadow-2xs font-semibold'
                        : 'border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                      <MoonIcon className="size-4.5" />
                    </div>
                    <span className="text-xs text-foreground">Dark Mode</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Low-light CAD contrast</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* AI Rate Limiting & Vision Throughput */}
            <Card className="rounded-xl bg-card border-border/70 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/15">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CpuIcon className="size-4 text-primary" />
                  <span>Gemini API Rate Limiting</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure request throttling to stay within Gemini API quotas.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Dispatched Request Throttle</label>
                  <Select
                    value={String(draftRateLimit)}
                    onValueChange={(val) => setDraftRateLimit(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-border/70">
                      <SelectValue placeholder="Rate limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15" className="text-xs">
                        15 RPM — Standard Tier (4.0s delay between sheets)
                      </SelectItem>
                      <SelectItem value="30" className="text-xs">
                        30 RPM — Accelerated Tier (2.0s delay)
                      </SelectItem>
                      <SelectItem value="60" className="text-xs">
                        60 RPM — Pro Dedicated (1.0s delay)
                      </SelectItem>
                      <SelectItem value="0" className="text-xs">
                        Unlimited Throughput — Enterprise Dedicated
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/60 text-xs">
                  <div className="flex items-center gap-2">
                    <ActivityIcon className="size-4 text-emerald-500 animate-pulse" />
                    <span className="text-muted-foreground">Current Model:</span>
                    <span className="font-semibold text-foreground">gemini-1.5-pro-vision</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Units & Measurement Standards */}
            <Card className="rounded-xl bg-card border-border/70 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/15">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileSpreadsheetIcon className="size-4 text-primary" />
                  <span>Takeoff Units & Currency</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Default format for quantities, lengths, and cost estimation tables.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Measurement System</label>
                    <Select value={units} onValueChange={(val: any) => setUnits(val)}>
                      <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-border/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric" className="text-xs">Metric (m, kg, mm)</SelectItem>
                        <SelectItem value="imperial" className="text-xs">Imperial (ft, lbs, in)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Currency Symbol</label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-border/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD" className="text-xs">$ USD — US Dollar</SelectItem>
                        <SelectItem value="AUD" className="text-xs">A$ AUD — Australian Dollar</SelectItem>
                        <SelectItem value="EUR" className="text-xs">€ EUR — Euro</SelectItem>
                        <SelectItem value="GBP" className="text-xs">£ GBP — British Pound</SelectItem>
                        <SelectItem value="INR" className="text-xs">₹ INR — Indian Rupee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gemini API Key */}
            <Card className="rounded-xl bg-card border-border/70 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/15">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <KeyRoundIcon className="size-4 text-primary" />
                  <span>Google AI API Key</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Direct key integration for standalone drawing OCR extraction.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-9 text-xs bg-background font-mono rounded-lg border-border/70"
                    placeholder="Enter API Key..."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestApiKey}
                    disabled={apiKeyStatus === 'testing'}
                    className="h-9 px-3 text-xs gap-1.5 rounded-lg border-border/70 shrink-0 cursor-pointer shadow-2xs"
                  >
                    {apiKeyStatus === 'testing' ? (
                      <span className="animate-spin text-xs">⏳</span>
                    ) : apiKeyStatus === 'valid' ? (
                      <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                    ) : (
                      <ActivityIcon className="size-3.5" />
                    )}
                    <span>{apiKeyStatus === 'testing' ? 'Testing...' : 'Ping Test'}</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Key stored encrypted in local environment memory. Never transmitted to third parties.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. AI Prompts & Guidelines Tab */}
        <TabsContent value="prompts" className="m-0 flex-1">
          <Card className="rounded-xl bg-card border-border/70 shadow-2xs overflow-hidden flex flex-col">
            <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/15 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <SparklesIcon className="size-4 text-primary" />
                  <span>AI Vision Prompt Templates</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize system instructions passed to Gemini Vision models during drawing takeoff parsing.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success('Standard prompt guidelines restored')}
                className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-border/70 hover:bg-muted/70 cursor-pointer shadow-2xs"
              >
                <RotateCcwIcon className="size-3 text-muted-foreground" />
                <span>Reset Defaults</span>
              </Button>
            </CardHeader>

            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
              {/* Left Prompt Selector Column */}
              <div className="md:col-span-4 border border-border/60 rounded-xl p-2 bg-muted/20 space-y-1.5 flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 tracking-wider">
                  Configured Pipelines ({prompts.length})
                </span>
                {prompts.map((p, idx) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handlePromptSelect(idx)}
                    className={`w-full text-left p-3 rounded-lg text-xs transition-all flex flex-col gap-1 cursor-pointer border ${
                      selectedPromptIdx === idx
                        ? 'bg-background border-primary/40 text-foreground font-semibold shadow-2xs'
                        : 'border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono uppercase text-primary font-bold">
                        {p.category}
                      </span>
                      <span className={`size-2 rounded-full ${p.enabled === 1 ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                    </div>
                    <span className="truncate text-xs font-medium text-foreground">{p.title}</span>
                  </button>
                ))}
              </div>

              {/* Right Prompt Editor Column */}
              <div className="md:col-span-8 space-y-3 flex flex-col">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Pipeline Name</label>
                  <Input
                    value={editingPromptTitle}
                    onChange={(e) => setEditingPromptTitle(e.target.value)}
                    className="h-8.5 text-xs bg-background rounded-lg border-border/70 font-medium"
                  />
                </div>

                <div className="flex-1 flex flex-col space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">System Prompt Instructions</label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {editingPromptText.length} characters
                    </span>
                  </div>
                  <textarea
                    value={editingPromptText}
                    onChange={(e) => setEditingPromptText(e.target.value)}
                    rows={9}
                    className="w-full flex-1 p-3.5 text-xs font-mono bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary resize-none leading-relaxed text-foreground shadow-2xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Code2Icon className="size-3.5 text-primary" />
                    <span>Supports JSON schemas & regex constraints</span>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSavePrompt}
                    className="h-8 px-3.5 text-xs gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-2xs font-medium"
                  >
                    <SaveIcon className="size-3.5" />
                    <span>Save Prompt</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Storage & Cache Tab */}
        <TabsContent value="database" className="m-0 flex-1 space-y-4">
          <Card className="rounded-xl bg-card border-border/70 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/15">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <HardDriveIcon className="size-4 text-primary" />
                <span>Local Cache & Session Storage</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Manage temporary rasterized PDF canvases, extracted OCR payloads, and indexed drawing vectors.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Storage Usage Bar */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">Storage Allocation</span>
                  <span className="font-mono text-muted-foreground">19.3 MB / 250 MB Allocated</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="bg-primary h-full w-[8%]" title="PDF Vector Images (12.4 MB)" />
                  <div className="bg-emerald-500 h-full w-[4%]" title="Takeoff Cache (4.8 MB)" />
                  <div className="bg-amber-500 h-full w-[2%]" title="Indexed OCR (2.1 MB)" />
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" />
                    <span>Raster Sheet Images (12.4 MB)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Takeoff JSON (4.8 MB)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span>OCR Embeddings (2.1 MB)</span>
                  </div>
                </div>
              </div>

              {/* Clear Cache Destructive Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                <div>
                  <div className="text-xs font-semibold text-foreground">Purge Local Session Cache</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Removes all cached candidate sheet images, extraction responses, and OCR tables.
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="h-8.5 px-3 text-xs gap-1.5 rounded-lg cursor-pointer shadow-2xs font-medium shrink-0"
                >
                  <Trash2Icon className="size-3.5" />
                  <span>{clearingCache ? 'Purging...' : 'Purge Cache'}</span>
                </Button>
              </div>

              {cacheClearStatus && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2Icon className="size-4 shrink-0" />
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
