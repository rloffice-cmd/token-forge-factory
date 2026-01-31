/**
 * Treasury Address Settings Component
 * 
 * CRITICAL: Enforces separation between Safe (treasury) and Payout (EOA) addresses
 * Shows clear validation and explanations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  ExternalLink,
  Info,
  XCircle
} from 'lucide-react';
import { useTreasurySettings, useUpdateTreasurySettings, validateSafeAddress } from '@/hooks/useTreasurySettings';
import { cn } from '@/lib/utils';

export function TreasuryAddressSettings() {
  const { data: settings, isLoading } = useTreasurySettings();
  const updateSettings = useUpdateTreasurySettings();
  
  const [safeAddress, setSafeAddress] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [validatingSafe, setValidatingSafe] = useState(false);
  const [safeIsContract, setSafeIsContract] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    if (settings) {
      setSafeAddress(settings.treasury_safe_address || '');
      setPayoutAddress(settings.payout_wallet_address || '');
    }
  }, [settings]);

  // Validate Safe address when changed
  useEffect(() => {
    if (safeAddress && safeAddress.startsWith('0x') && safeAddress.length === 42) {
      setValidatingSafe(true);
      setSafeIsContract(null);
      validateSafeAddress(safeAddress).then((isContract) => {
        setSafeIsContract(isContract);
        setValidatingSafe(false);
      });
    } else {
      setSafeIsContract(null);
    }
  }, [safeAddress]);

  // Check for same address error
  const isSameAddress = 
    safeAddress && 
    payoutAddress && 
    safeAddress.toLowerCase() === payoutAddress.toLowerCase();

  const isValidEthAddress = (addr: string) => 
    addr.startsWith('0x') && addr.length === 42;

  const canSave = 
    isValidEthAddress(safeAddress) &&
    isValidEthAddress(payoutAddress) &&
    !isSameAddress &&
    !updateSettings.isPending;

  const handleSave = async () => {
    setError(null);
    
    if (isSameAddress) {
      setError('כספת Safe חייבת להיות כתובת שונה מארנק פרטי');
      return;
    }

    try {
      await updateSettings.mutateAsync({
        treasury_safe_address: safeAddress,
        payout_wallet_address: payoutAddress,
      });
    } catch (e) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          כתובות Treasury (קופה)
        </CardTitle>
        <CardDescription>
          הגדרת כתובת הכספת (Safe) וכתובת היעד למשיכות
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Explanation Alert */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="space-y-2">
            <p><strong>Treasury Safe</strong> (כספת) = הכתובת שמחזיקה את הכספים (Contract Wallet)</p>
            <p><strong>Payout Wallet</strong> (ארנק יעד) = הכתובת שאליה יועברו הכספים בעת משיכה (Exodus/MetaMask)</p>
            <p className="text-warning">חשוב: שתי הכתובות חייבות להיות שונות!</p>
          </AlertDescription>
        </Alert>

        {/* Safe Address */}
        <div className="space-y-2">
          <Label htmlFor="safe-address" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            כתובת Treasury Safe (כספת)
          </Label>
          <div className="relative">
            <Input
              id="safe-address"
              value={safeAddress}
              onChange={(e) => setSafeAddress(e.target.value)}
              placeholder="0x..."
              className={cn(
                "font-mono text-sm pl-10",
                isSameAddress && "border-destructive",
                safeIsContract === true && "border-success",
                safeIsContract === false && "border-warning"
              )}
              dir="ltr"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {validatingSafe ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : safeIsContract === true ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : safeIsContract === false ? (
                <AlertTriangle className="w-4 h-4 text-warning" />
              ) : null}
            </div>
          </div>
          {safeIsContract === false && (
            <p className="text-sm text-warning flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              זו לא כתובת Contract (Safe). ודא שזו כתובת Safe תקינה.
            </p>
          )}
          {safeIsContract === true && (
            <p className="text-sm text-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              כתובת Contract מאומתת
            </p>
          )}
          <a
            href="https://app.safe.global/welcome"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            איך יוצרים Safe?
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <Separator />

        {/* Payout Address */}
        <div className="space-y-2">
          <Label htmlFor="payout-address" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            כתובת ארנק יעד למשיכות (Payout)
          </Label>
          <Input
            id="payout-address"
            value={payoutAddress}
            onChange={(e) => setPayoutAddress(e.target.value)}
            placeholder="0x... (Exodus / MetaMask)"
            className={cn(
              "font-mono text-sm",
              isSameAddress && "border-destructive"
            )}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            הכתובת שאליה יועברו הכספים כשתאשר משיכה ב-Safe
          </p>
        </div>

        {/* Same Address Error */}
        {isSameAddress && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>שגיאה:</strong> כספת Safe חייבת להיות כתובת שונה מארנק פרטי.
              <br />
              ה-Safe הוא Contract Wallet שמחזיק את הכספים.
              <br />
              ארנק היעד הוא הכתובת האישית שלך (Exodus).
            </AlertDescription>
          </Alert>
        )}

        {/* General Error */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full gap-2"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              שמור כתובות
            </>
          )}
        </Button>

        {/* Mobile Help */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/30">
          <p className="font-semibold">💡 עובד מהמובייל?</p>
          <p>יצירת Safe דורשת חיבור ארנק. אם אתה ב-Exodus:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>פתח את <a href="https://app.safe.global" target="_blank" className="text-primary underline">app.safe.global</a> מהמחשב</li>
            <li>צור Safe חדש עם הארנק שלך</li>
            <li>העתק את כתובת ה-Safe לכאן</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
