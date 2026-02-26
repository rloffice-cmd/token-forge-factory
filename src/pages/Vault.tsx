import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Lock,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Key as KeyIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──

interface VaultSecret {
  id: string;
  project_name: string;
  key_name: string;
  key_value: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ProjectName = 'global' | 'rmint' | 'signalforge' | 'arbibot' | 'all';

const PROJECTS: { value: ProjectName; label: string }[] = [
  { value: 'global', label: 'Global (כל הפרויקטים)' },
  { value: 'rmint', label: 'RMINT' },
  { value: 'signalforge', label: 'SignalForge' },
  { value: 'arbibot', label: 'ArbiBot' },
  { value: 'all', label: 'All' },
];

const CATEGORIES = [
  'AI', 'Database', 'Email', 'Affiliate', 'Dashboard',
  'Automation', 'Scraping', 'Telegram', 'Maps', 'Security', 'Config',
];

const CATEGORY_ICONS: Record<string, string> = {
  AI: '🤖', Database: '🗄️', Email: '📧', Affiliate: '🤝',
  Dashboard: '📊', Automation: '⚡', Scraping: '🕷️', Telegram: '📱',
  Maps: '🗺️', Security: '🔐', Config: '⚙️',
};

const SEED_SECRETS: { key_name: string; category: string; description: string; key_value?: string }[] = [
  { key_name: 'AI_INTEGRATIONS_OPENAI_API_KEY', category: 'AI', description: 'OpenAI API key for AI integrations' },
  { key_name: 'AI_INTEGRATIONS_OPENAI_BASE_URL', category: 'AI', description: 'OpenAI base URL override' },
  { key_name: 'OPENAI_API_KEY', category: 'AI', description: 'Primary OpenAI API key' },
  { key_name: 'DATABASE_URL', category: 'Database', description: 'Full database connection string' },
  { key_name: 'PGDATABASE', category: 'Database', description: 'PostgreSQL database name' },
  { key_name: 'PGHOST', category: 'Database', description: 'PostgreSQL host' },
  { key_name: 'PGPASSWORD', category: 'Database', description: 'PostgreSQL password' },
  { key_name: 'PGPORT', category: 'Database', description: 'PostgreSQL port' },
  { key_name: 'PGUSER', category: 'Database', description: 'PostgreSQL user' },
  { key_name: 'RESEND_API_KEY', category: 'Email', description: 'Resend email service API key' },
  { key_name: 'IMPACT_ACCOUNT_SID', category: 'Affiliate', description: 'Impact.com account SID' },
  { key_name: 'IMPACT_AUTH_TOKEN', category: 'Affiliate', description: 'Impact.com auth token' },
  { key_name: 'DASHBOARD_API_KEY', category: 'Dashboard', description: 'Dashboard internal API key' },
  { key_name: 'INNGEST_EVENT_KEY', category: 'Automation', description: 'Inngest event key' },
  { key_name: 'FIRECRAWL_API_KEY', category: 'Scraping', description: 'Firecrawl web scraping API key' },
  { key_name: 'TELEGRAM_BOT_TOKEN', category: 'Telegram', description: 'Telegram bot token' },
  { key_name: 'TELEGRAM_CHAT_ID', category: 'Telegram', description: 'Telegram chat ID for notifications' },
  { key_name: 'GOOGLE_MAPS_API_KEY', category: 'Maps', description: 'Google Maps API key' },
  { key_name: 'SESSION_SECRET', category: 'Security', description: 'Session encryption secret' },
  { key_name: 'FINTECH_MODULE_ENABLED', category: 'Config', description: 'Enable fintech module', key_value: 'true' },
  { key_name: 'REDDIT_ENABLED', category: 'Config', description: 'Enable Reddit integration', key_value: 'true' },
];

// ── Helpers ──

function maskValue(v: string) {
  if (!v) return '(ריק)';
  if (v.length <= 4) return '••••••••';
  return '••••••••' + v.slice(-4);
}

// ── Components ──

function SecretRow({
  secret,
  onEdit,
  onDelete,
}: {
  secret: VaultSecret;
  onEdit: (s: VaultSecret) => void;
  onDelete: (s: VaultSecret) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(secret.key_value);
    setCopied(true);
    toast.success('הועתק ללוח');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 transition-all hover:border-[#c9a84c]/20 hover:bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-semibold text-foreground">{secret.key_name}</code>
          {!secret.is_active && (
            <Badge variant="outline" className="text-[10px] opacity-60">לא פעיל</Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {visible ? (secret.key_value || '(ריק)') : maskValue(secret.key_value)}
          </span>
        </div>
        {secret.description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">{secret.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyToClipboard}>
          {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(secret)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(secret)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Badge variant="outline" className="text-[10px] shrink-0">{secret.project_name}</Badge>
    </div>
  );
}

// ── Main Page ──

export default function Vault() {
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState<string>('__all__');
  const [filterCategory, setFilterCategory] = useState<string>('__all__');

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<VaultSecret | null>(null);

  // Form fields
  const [formKeyName, setFormKeyName] = useState('');
  const [formKeyValue, setFormKeyValue] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formProject, setFormProject] = useState<string>('global');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Import
  const [importText, setImportText] = useState('');
  const [importProject, setImportProject] = useState<string>('global');

  // ── Data fetching ──

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vault_secrets' as 'offer_sources')
      .select('*')
      .order('category', { ascending: true })
      .order('key_name', { ascending: true });

    if (error) {
      toast.error('שגיאה בטעינת הסודות');
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as VaultSecret[];

    if (rows.length === 0) {
      await seedDefaults();
      return;
    }

    setSecrets(rows);
    setLoading(false);
  }, []);

  const seedDefaults = async () => {
    const rows = SEED_SECRETS.map((s) => ({
      project_name: 'global',
      key_name: s.key_name,
      key_value: s.key_value ?? '',
      description: s.description,
      category: s.category,
      is_active: true,
    }));

    const { error } = await supabase
      .from('vault_secrets' as 'offer_sources')
      .insert(rows as never[]);

    if (error) {
      console.error('Seed error:', error);
      toast.error('שגיאה באתחול ברירות מחדל');
      setLoading(false);
      return;
    }

    toast.success(`${rows.length} סודות נוצרו כברירת מחדל`);
    await fetchSecrets();
  };

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  // ── Filtered data ──

  const filtered = useMemo(() => {
    return secrets.filter((s) => {
      if (search && !s.key_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProject !== '__all__' && s.project_name !== filterProject) return false;
      if (filterCategory !== '__all__' && s.category !== filterCategory) return false;
      return true;
    });
  }, [secrets, search, filterProject, filterCategory]);

  const grouped = useMemo(() => {
    const map: Record<string, VaultSecret[]> = {};
    for (const s of filtered) {
      const cat = s.category || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // ── CRUD ──

  const openNew = () => {
    setEditingSecret(null);
    setFormKeyName('');
    setFormKeyValue('');
    setFormDescription('');
    setFormCategory(CATEGORIES[0]);
    setFormProject('global');
    setFormActive(true);
    setEditOpen(true);
  };

  const openEdit = (s: VaultSecret) => {
    setEditingSecret(s);
    setFormKeyName(s.key_name);
    setFormKeyValue(s.key_value);
    setFormDescription(s.description ?? '');
    setFormCategory(s.category ?? '');
    setFormProject(s.project_name);
    setFormActive(s.is_active);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!formKeyName.trim()) {
      toast.error('שם המפתח חסר');
      return;
    }
    setSaving(true);

    if (editingSecret) {
      const { error } = await supabase
        .from('vault_secrets' as 'offer_sources')
        .update({
          key_name: formKeyName.trim(),
          key_value: formKeyValue,
          description: formDescription || null,
          category: formCategory || null,
          project_name: formProject,
          is_active: formActive,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', editingSecret.id);

      if (error) {
        toast.error('שגיאה בעדכון');
        console.error(error);
      } else {
        toast.success('הסוד עודכן בהצלחה');
        setEditOpen(false);
        await fetchSecrets();
      }
    } else {
      const { error } = await supabase
        .from('vault_secrets' as 'offer_sources')
        .insert({
          key_name: formKeyName.trim(),
          key_value: formKeyValue,
          description: formDescription || null,
          category: formCategory || null,
          project_name: formProject,
          is_active: formActive,
        } as never);

      if (error) {
        toast.error(error.message?.includes('unique') ? 'מפתח כזה כבר קיים' : 'שגיאה ביצירה');
        console.error(error);
      } else {
        toast.success('הסוד נוצר בהצלחה');
        setEditOpen(false);
        await fetchSecrets();
      }
    }
    setSaving(false);
  };

  const confirmDelete = (s: VaultSecret) => {
    setEditingSecret(s);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!editingSecret) return;
    const { error } = await supabase
      .from('vault_secrets' as 'offer_sources')
      .delete()
      .eq('id', editingSecret.id);

    if (error) {
      toast.error('שגיאה במחיקה');
      console.error(error);
    } else {
      toast.success('הסוד נמחק');
      setDeleteOpen(false);
      await fetchSecrets();
    }
  };

  // ── Import ──

  const handleImport = async () => {
    const lines = importText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='));

    if (lines.length === 0) {
      toast.error('לא נמצאו שורות KEY=VALUE תקינות');
      return;
    }

    setSaving(true);
    let count = 0;

    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

      if (!key) continue;

      const { error } = await supabase
        .from('vault_secrets' as 'offer_sources')
        .upsert(
          {
            project_name: importProject,
            key_name: key,
            key_value: value,
            is_active: true,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'project_name,key_name' },
        );

      if (!error) count++;
    }

    toast.success(`יובאו ${count} מתוך ${lines.length} סודות`);
    setSaving(false);
    setImportOpen(false);
    setImportText('');
    await fetchSecrets();
  };

  // ── Export ──

  const handleExport = (project: string) => {
    const exportSecrets = secrets.filter(
      (s) =>
        s.is_active &&
        (s.project_name === project || s.project_name === 'global' || s.project_name === 'all'),
    );

    const envContent = exportSecrets
      .map((s) => `${s.key_name}=${s.key_value}`)
      .join('\n');

    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project}.env`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`קובץ ${project}.env הורד`);
  };

  // ── Render ──

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#a08838] flex items-center justify-center shadow-lg shadow-[#c9a84c]/10">
              <Lock className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>Vault</span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {secrets.length} secrets
                </Badge>
              </h1>
              <p className="text-muted-foreground text-sm">ניהול סודות ומפתחות API מרכזי</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 ml-1" />
              ייבוא
            </Button>
            <Select onValueChange={handleExport}>
              <SelectTrigger className="w-auto h-9 text-sm">
                <Download className="w-4 h-4 ml-1" />
                <span>ייצוא .env</span>
              </SelectTrigger>
              <SelectContent>
                {PROJECTS.filter((p) => p.value !== 'all').map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openNew} className="bg-[#c9a84c] hover:bg-[#a08838] text-black">
              <Plus className="w-4 h-4 ml-1" />
              סוד חדש
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="חיפוש לפי שם מפתח..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 h-9"
                />
              </div>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="פרויקט" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כל הפרויקטים</SelectItem>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כל הקטגוריות</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_ICONS[c] || '📁'} {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Secrets grouped by category */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#c9a84c]" />
            <span className="mr-3 text-muted-foreground">טוען סודות...</span>
          </div>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">לא נמצאו סודות תואמים</p>
            </CardContent>
          </Card>
        ) : (
          grouped.map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{CATEGORY_ICONS[category] || '📁'}</span>
                  <span>{category}</span>
                  <Badge variant="secondary" className="text-[10px] mr-auto">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((s) => (
                  <SecretRow key={s.id} secret={s} onEdit={openEdit} onDelete={confirmDelete} />
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyIcon className="w-5 h-5 text-[#c9a84c]" />
              {editingSecret ? 'עריכת סוד' : 'סוד חדש'}
            </DialogTitle>
            <DialogDescription>
              {editingSecret ? 'עדכן את פרטי הסוד' : 'הוסף מפתח API או סוד חדש למערכת'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם מפתח</Label>
              <Input
                placeholder="e.g. OPENAI_API_KEY"
                value={formKeyName}
                onChange={(e) => setFormKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                className="font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ערך</Label>
              <Input
                placeholder="sk-..."
                value={formKeyValue}
                onChange={(e) => setFormKeyValue(e.target.value)}
                className="font-mono"
                dir="ltr"
                type="password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>פרויקט</Label>
                <Select value={formProject} onValueChange={setFormProject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>קטגוריה</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>תיאור (אופציונלי)</Label>
              <Input
                placeholder="תיאור קצר..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#c9a84c] hover:bg-[#a08838] text-black">
              {saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              {editingSecret ? 'עדכן' : 'צור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              מחיקת סוד
            </DialogTitle>
            <DialogDescription>
              האם למחוק את <code className="font-semibold">{editingSecret?.key_name}</code>?
              <br />פעולה זו בלתי הפיכה.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>ביטול</Button>
            <Button variant="destructive" onClick={handleDelete}>מחק</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Dialog ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#c9a84c]" />
              ייבוא סודות
            </DialogTitle>
            <DialogDescription>
              הדבק שורות בפורמט <code>KEY=VALUE</code>, שורה אחת לכל סוד.
              שורות שמתחילות ב-# יידלגו.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>פרויקט יעד</Label>
              <Select value={importProject} onValueChange={setImportProject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>תוכן</Label>
              <textarea
                className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                dir="ltr"
                placeholder={"# Database\nDATABASE_URL=postgres://...\nPGHOST=localhost\n\n# API Keys\nOPENAI_API_KEY=sk-..."}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>ביטול</Button>
            <Button onClick={handleImport} disabled={saving} className="bg-[#c9a84c] hover:bg-[#a08838] text-black">
              {saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              ייבא
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
