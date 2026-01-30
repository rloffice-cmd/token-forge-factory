import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">הגדרות</h1>
          <p className="text-muted-foreground mt-1">
            הגדרות מערכת ותצורה
          </p>
        </div>

        {/* Sandbox settings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>הגדרות Sandbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Piston API URL</Label>
                <p className="text-sm text-muted-foreground">
                  כתובת שרת ההרצה
                </p>
              </div>
              <Input 
                className="max-w-xs bg-muted/30" 
                defaultValue="https://emkc.org/api/v2/piston"
                dir="ltr"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Timeout (שניות)</Label>
                <p className="text-sm text-muted-foreground">
                  זמן מקסימלי להרצה
                </p>
              </div>
              <Input 
                type="number"
                className="max-w-[100px] bg-muted/30" 
                defaultValue={30}
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reward Network */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>רשת תגמול</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>מצב MOCK</Label>
                <p className="text-sm text-muted-foreground">
                  הרצה ללא חיבור אמיתי לבלוקצ׳יין
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>כתובת ארנק יעד</Label>
                <p className="text-sm text-muted-foreground">
                  לשימוש עתידי - כתובת CEX
                </p>
              </div>
              <Input 
                className="max-w-xs bg-muted/30 font-mono text-sm" 
                placeholder="0x..."
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Judge settings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>הגדרות שיפוט</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>סף ציון מינימלי</Label>
                <p className="text-sm text-muted-foreground">
                  ציון מינימלי לאישור (0.95 = 95%)
                </p>
              </div>
              <Input 
                type="number"
                step="0.01"
                className="max-w-[100px] bg-muted/30" 
                defaultValue={0.95}
                dir="ltr"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Kill Gates פעילים</Label>
                <p className="text-sm text-muted-foreground">
                  AMBIGUITY, INVALID_DATES, MALFORMED_ISO
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button size="lg">
            שמור הגדרות
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
