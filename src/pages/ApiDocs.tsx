/**
 * API Documentation Page
 * תיעוד API עבור לקוחות B2B
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Code2, 
  Copy, 
  CheckCircle2, 
  Zap, 
  Key,
  ArrowLeft,
  Terminal,
  FileJson,
  Shield,
  Clock,
  CreditCard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE = 'https://flsdahpijdvkohwiinqm.supabase.co/functions/v1';

const CODE_EXAMPLES = {
  curl: `curl -X POST '${API_BASE}/public-api' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -d '{
    "action": "create_job",
    "task": {
      "name": "Extract dates from document",
      "input": "Meeting scheduled for 2024-05-15 and 2024-06-20"
    }
  }'`,

  javascript: `const response = await fetch('${API_BASE}/public-api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    action: 'create_job',
    task: {
      name: 'Extract dates from document',
      input: 'Meeting scheduled for 2024-05-15 and 2024-06-20'
    }
  })
});

const data = await response.json();
console.log(data);
// { success: true, job_id: "abc123", status: "processing" }`,

  python: `import requests

response = requests.post(
    '${API_BASE}/public-api',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'YOUR_API_KEY'
    },
    json={
        'action': 'create_job',
        'task': {
            'name': 'Extract dates from document',
            'input': 'Meeting scheduled for 2024-05-15 and 2024-06-20'
        }
    }
)

data = response.json()
print(data)
# { "success": True, "job_id": "abc123", "status": "processing" }`,
};

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/public-api',
    action: 'create_job',
    description: 'יצירת Job חדש לעיבוד',
    params: [
      { name: 'task.name', type: 'string', required: true, description: 'שם המשימה' },
      { name: 'task.input', type: 'string', required: true, description: 'הטקסט לעיבוד' },
      { name: 'webhook_url', type: 'string', required: false, description: 'URL לקבלת עדכונים' },
    ],
    response: `{
  "success": true,
  "job_id": "abc123-def456",
  "status": "processing",
  "estimated_time_seconds": 30
}`,
  },
  {
    method: 'POST',
    path: '/public-api',
    action: 'get_job',
    description: 'בדיקת סטטוס Job',
    params: [
      { name: 'job_id', type: 'string', required: true, description: 'מזהה ה-Job' },
    ],
    response: `{
  "success": true,
  "job": {
    "id": "abc123-def456",
    "status": "SETTLED",
    "score": 1.0,
    "result": ["2024-05-15", "2024-06-20"],
    "created_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:30:25Z"
  }
}`,
  },
  {
    method: 'POST',
    path: '/public-api',
    action: 'get_balance',
    description: 'בדיקת יתרת קרדיטים',
    params: [],
    response: `{
  "success": true,
  "balance": {
    "credits": 85,
    "used": 15,
    "total_jobs": 15
  }
}`,
  },
];

export default function ApiDocs() {
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success('הועתק!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/landing')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              חזרה
            </Button>
            <div className="flex items-center gap-2">
              <Code2 className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">API Documentation</h1>
            </div>
          </div>
          <Badge variant="outline">v1.0</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Intro */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Token Forge API</h2>
          <p className="text-lg text-muted-foreground mb-6">
            ממשק תכנות (API) פשוט ועוצמתי לשילוב הוכחות אוטומטיות באפליקציה שלך
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardContent className="pt-4 flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">אימות API Key</p>
                  <p className="text-sm text-muted-foreground">מאובטח</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-4 flex items-center gap-3">
                <Clock className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">{'<30 שניות'}</p>
                  <p className="text-sm text-muted-foreground">זמן עיבוד</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-4 flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">99.9% Uptime</p>
                  <p className="text-sm text-muted-foreground">זמינות</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-4 flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">Pay-per-use</p>
                  <p className="text-sm text-muted-foreground">תשלום לפי שימוש</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Authentication */}
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              אימות (Authentication)
            </CardTitle>
            <CardDescription>
              כל בקשות ה-API דורשות מפתח API ב-Header
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
              <div className="flex items-center justify-between">
                <code>X-API-Key: YOUR_API_KEY</code>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard('X-API-Key: YOUR_API_KEY', 'header')}
                >
                  {copiedCode === 'header' ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              לקבלת API Key, צור קשר ב-<a href="mailto:api@tokenforge.io" className="text-primary underline">api@tokenforge.io</a> 
              {' '}או רכוש חבילת קרדיטים והמפתח יישלח אליך.
            </p>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              התחלה מהירה
            </CardTitle>
            <CardDescription>
              דוגמאות קוד בשפות שונות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList className="mb-4">
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              
              {Object.entries(CODE_EXAMPLES).map(([lang, code]) => (
                <TabsContent key={lang} value={lang}>
                  <div className="relative">
                    <pre className="bg-muted text-foreground rounded-lg p-4 overflow-x-auto text-sm border border-border">
                      <code>{code}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(code, lang)}
                    >
                      {copiedCode === lang ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FileJson className="w-6 h-6" />
          Endpoints
        </h3>

        <div className="space-y-6">
          {ENDPOINTS.map((endpoint, i) => (
            <Card key={i} className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={endpoint.method === 'GET' ? 'secondary' : 'default'}
                    className="font-mono"
                  >
                    {endpoint.method}
                  </Badge>
                  <code className="text-lg font-mono">{endpoint.path}</code>
                  <Badge variant="outline">{endpoint.action}</Badge>
                </div>
                <CardDescription className="mt-2">
                  {endpoint.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parameters */}
                {endpoint.params.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">פרמטרים</h4>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-right p-2 font-medium">שם</th>
                            <th className="text-right p-2 font-medium">סוג</th>
                            <th className="text-right p-2 font-medium">חובה</th>
                            <th className="text-right p-2 font-medium">תיאור</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoint.params.map((param, j) => (
                            <tr key={j} className="border-t border-border">
                              <td className="p-2 font-mono text-primary">{param.name}</td>
                              <td className="p-2 font-mono text-muted-foreground">{param.type}</td>
                              <td className="p-2">
                                {param.required ? (
                                  <Badge variant="destructive" className="text-xs">חובה</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">אופציונלי</Badge>
                                )}
                              </td>
                              <td className="p-2">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-2">תגובה לדוגמה</h4>
                  <pre className="bg-muted text-foreground rounded-lg p-4 overflow-x-auto text-sm border border-border">
                    <code>{endpoint.response}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Error Codes */}
        <Card className="glass-card mt-8">
          <CardHeader>
            <CardTitle>קודי שגיאה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-right p-2 font-medium">קוד</th>
                    <th className="text-right p-2 font-medium">סטטוס</th>
                    <th className="text-right p-2 font-medium">תיאור</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="p-2 font-mono">400</td>
                    <td className="p-2">Bad Request</td>
                    <td className="p-2">פרמטרים חסרים או לא תקינים</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="p-2 font-mono">401</td>
                    <td className="p-2">Unauthorized</td>
                    <td className="p-2">API Key חסר או לא תקין</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="p-2 font-mono">402</td>
                    <td className="p-2">Payment Required</td>
                    <td className="p-2">אין מספיק קרדיטים</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="p-2 font-mono">429</td>
                    <td className="p-2">Too Many Requests</td>
                    <td className="p-2">חריגה ממכסת הבקשות</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="p-2 font-mono">500</td>
                    <td className="p-2">Internal Error</td>
                    <td className="p-2">שגיאת שרת פנימית</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card className="glass-card mt-8">
          <CardHeader>
            <CardTitle>מגבלות שימוש (Rate Limits)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li>• <strong>100 בקשות/דקה</strong> - לחשבונות רגילים</li>
              <li>• <strong>1000 בקשות/דקה</strong> - לחשבונות Enterprise</li>
              <li>• <strong>Webhook</strong> - ללא הגבלה (מומלץ לעיבוד גדול)</li>
            </ul>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="glass-card mt-12 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <h3 className="text-2xl font-bold mb-4">מוכן להתחיל?</h3>
            <p className="text-muted-foreground mb-6">
              רכוש קרדיטים וקבל גישה מיידית ל-API
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/purchase')}>
                <Zap className="w-4 h-4 mr-2" />
                רכוש קרדיטים
              </Button>
              <Button variant="outline" onClick={() => window.location.href = 'mailto:api@tokenforge.io'}>
                צור קשר לחשבון Enterprise
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
