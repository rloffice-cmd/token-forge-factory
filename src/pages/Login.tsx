import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Radio, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Account created', description: 'You are now signed in.' });
        navigate('/forge/money-machine');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: 'Authentication failed', description: error.message, variant: 'destructive' });
      } else {
        navigate('/forge/money-machine');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6" dir="ltr">
      <div className="glass-card p-10 w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Radio className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg tracking-tight">Token Forge AI</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn className="w-4 h-4" />
            {loading ? 'Processing...' : isSignup ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <button
          onClick={() => setIsSignup(!isSignup)}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors"
        >
          {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}
