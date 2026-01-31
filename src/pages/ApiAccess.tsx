import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Eye, EyeOff, Key, Zap, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  status: string;
  rate_limit_tier: string;
  created_at: string;
  last_used_at: string | null;
}

interface CreditWallet {
  credits_balance: number;
  total_credits_purchased: number;
  total_credits_burned: number;
}

interface KeyDelivery {
  plaintext_key: string;
  expires_at: string;
}

export default function ApiAccess() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customer_id');
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [delivery, setDelivery] = useState<KeyDelivery | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      loadData();
    } else {
      setError('Missing customer_id parameter');
      setLoading(false);
    }
  }, [customerId]);

  const loadData = async () => {
    try {
      // Load API keys
      const { data: keys, error: keysError } = await supabase
        .from('api_keys')
        .select('id, key_prefix, status, rate_limit_tier, created_at, last_used_at')
        .eq('customer_id', customerId)
        .eq('status', 'active');

      if (keysError) throw keysError;
      setApiKeys(keys || []);

      // Load credit wallet
      const { data: walletData, error: walletError } = await supabase
        .from('credit_wallets')
        .select('credits_balance, total_credits_purchased, total_credits_burned')
        .eq('customer_id', customerId)
        .single();

      if (!walletError && walletData) {
        setWallet(walletData);
      }

      // Check for pending key delivery
      const { data: deliveryData } = await supabase
        .from('api_key_deliveries')
        .select('plaintext_key, expires_at')
        .eq('customer_id', customerId)
        .eq('delivered', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (deliveryData) {
        setDelivery(deliveryData);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const revealKey = async () => {
    if (!delivery) return;
    
    setShowKey(true);
    
    // Mark as delivered
    await supabase
      .from('api_key_deliveries')
      .update({ delivered: true })
      .eq('customer_id', customerId)
      .eq('plaintext_key', delivery.plaintext_key);
  };

  const copyKey = () => {
    if (delivery) {
      navigator.clipboard.writeText(delivery.plaintext_key);
      toast({
        title: 'Copied!',
        description: 'API key copied to clipboard',
      });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Key className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Signal API Access</h1>
        </div>

        {/* Credit Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Credit Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">
                  {wallet?.credits_balance?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-green-600">
                  {wallet?.total_credits_purchased?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground">Purchased</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-orange-600">
                  {wallet?.total_credits_burned?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground">Used</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Key Section */}
        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API Key Yet</h3>
              <p className="text-muted-foreground mb-4">
                Purchase credits to receive your API key automatically.
              </p>
              <Button asChild>
                <a href="/purchase">Purchase Credits</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Your API Key
              </CardTitle>
              <CardDescription>
                Use this key to authenticate API requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {delivery && !showKey ? (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>One-time reveal available!</strong> Your API key can be revealed once. 
                    After viewing, save it securely - it cannot be shown again.
                    <br />
                    <span className="text-sm">
                      Expires: {formatDate(delivery.expires_at)}
                    </span>
                  </AlertDescription>
                </Alert>
              ) : null}

              {delivery && showKey ? (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between gap-4">
                    <code className="text-sm font-mono break-all">
                      {delivery.plaintext_key}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-destructive mt-2">
                    ⚠️ Save this key now! It will not be shown again.
                  </p>
                </div>
              ) : delivery ? (
                <Button onClick={revealKey} className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  Reveal API Key (One-Time Only)
                </Button>
              ) : null}

              {/* Show existing key info */}
              {apiKeys.map((key) => (
                <div key={key.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <code className="font-mono">{key.key_prefix}...</code>
                      <Badge variant="outline" className="ml-2">
                        {key.rate_limit_tier}
                      </Badge>
                    </div>
                    <Badge variant={key.status === 'active' ? 'default' : 'destructive'}>
                      {key.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Created: {formatDate(key.created_at)}
                    {key.last_used_at && (
                      <span className="ml-4">Last used: {formatDate(key.last_used_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>How to use the Signal API</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="wallet">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="wallet">signal-wallet</TabsTrigger>
                <TabsTrigger value="contract">signal-contract</TabsTrigger>
              </TabsList>

              <TabsContent value="wallet" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Wallet Risk Check (1 credit)</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analyze wallet address for risk signals
                  </p>
                  <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
{`curl -X POST \\
  https://flsdahpijdvkohwiinqm.supabase.co/functions/v1/signal-wallet \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"address": "0x...", "chain": "base"}'`}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
{`{
  "request_id": "uuid",
  "address": "0x...",
  "chain": "base",
  "risk_score": 0.2,
  "flags": ["insufficient_on_chain_data"],
  "confidence": 0.3,
  "decision": "allow",
  "cost": 1,
  "credits_remaining": 99
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="contract" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Contract Risk Check (2 credits)</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analyze smart contract for risk signals
                  </p>
                  <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
{`curl -X POST \\
  https://flsdahpijdvkohwiinqm.supabase.co/functions/v1/signal-contract \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"address": "0x...", "chain": "base"}'`}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
{`{
  "request_id": "uuid",
  "address": "0x...",
  "chain": "base",
  "risk_score": 0.3,
  "flags": ["verification_status_unknown"],
  "confidence": 0.25,
  "decision": "allow",
  "contract_info": {
    "is_verified": null,
    "is_proxy": null
  },
  "cost": 2,
  "credits_remaining": 97
}`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 border rounded-lg">
                <p className="font-semibold">Basic</p>
                <p className="text-2xl font-bold">100</p>
                <p className="text-sm text-muted-foreground">requests/hour</p>
              </div>
              <div className="p-4 border rounded-lg bg-primary/5">
                <p className="font-semibold">Pro</p>
                <p className="text-2xl font-bold">500</p>
                <p className="text-sm text-muted-foreground">requests/hour</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-semibold">Business</p>
                <p className="text-2xl font-bold">2000</p>
                <p className="text-sm text-muted-foreground">requests/hour</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
