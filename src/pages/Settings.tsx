import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { TreasuryAddressSettings } from '@/components/settings/TreasuryAddressSettings';
import { UserProfileCard } from '@/components/UserProfileCard';
import { Settings2, Cpu, Gavel, Shield, Link2 } from 'lucide-react';

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" />
            הגדרות
          </h1>
          <p className="text-muted-foreground mt-1">
            הגדרות מערכת, Treasury וקופה
          </p>
        </div>

        {/* User Profile */}
        <UserProfileCard />

        {/* Treasury Address Settings - CRITICAL */}
        <TreasuryAddressSettings />

        {/* Sandbox settings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              הגדרות Sandbox (סביבת הרצה)
            </CardTitle>
            <CardDescription>
              הגדרות שרת Piston להרצת קוד
            </CardDescription>
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

        {/* Network settings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              רשת ותשלומים
            </CardTitle>
            <CardDescription>
              הגדרות רשת Ethereum ו-Coinbase Commerce
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>מצב MOCK (בדיקה)</Label>
                <p className="text-sm text-muted-foreground">
                  הרצה ללא חיבור אמיתי לבלוקצ׳יין
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>רשת</Label>
                <p className="text-sm text-muted-foreground">
                  Ethereum Mainnet (ראשית)
                </p>
              </div>
              <span className="text-sm font-mono bg-muted/30 px-3 py-1 rounded">mainnet</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>סף התראה (DTF)</Label>
                <p className="text-sm text-muted-foreground">
                  התראת טלגרם כשיתרה נמוכה מ-
                </p>
              </div>
              <Input 
                type="number"
                className="max-w-[100px] bg-muted/30" 
                defaultValue={1000}
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Judge settings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              הגדרות שיפוט (Judge)
            </CardTitle>
            <CardDescription>
              פרמטרים לשיפוט תוצאות Pipeline
            </CardDescription>
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

        {/* PartnerStack / Reditus Integration */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              PartnerStack / Reditus Integration
            </CardTitle>
            <CardDescription>
              מפתח API לקבלת Postback-ים מרשתות שותפים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>PartnerStack API Key</Label>
                <p className="text-sm text-muted-foreground">
                  יוגדר כשנחבר רשת שותפים חיצונית
                </p>
              </div>
              <Input
                className="max-w-xs bg-muted/30 font-mono"
                placeholder="ps_live_..."
                disabled
                dir="ltr"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Postback Endpoint</Label>
                <p className="text-sm text-muted-foreground">
                  כתובת לקבלת אירועי המרה
                </p>
              </div>
              <code className="text-xs bg-muted/30 px-3 py-1.5 rounded font-mono max-w-xs truncate block" dir="ltr">
                /functions/v1/m2m-postback
              </code>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Postback Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  אימות HMAC חתימה על בקשות נכנסות
                </p>
              </div>
              <Switch disabled />
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