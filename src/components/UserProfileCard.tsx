import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import * as db from '@/lib/database';

export function UserProfileCard() {
  const [isEditing, setIsEditing] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: db.fetchCurrentUserProfile,
  });

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<db.UserProfile>) => db.updateUserProfile(updates),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['user-profile'], updatedProfile);
      setIsEditing(false);
      toast({
        title: 'Profile Updated',
        description: 'Your LinkedIn URL has been saved successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  // Initialize form with profile data
  useEffect(() => {
    if (profile?.linkedin_url) {
      setLinkedinUrl(profile.linkedin_url);
    }
  }, [profile]);

  const handleSave = () => {
    if (!linkedinUrl.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid LinkedIn URL',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate({ linkedin_url: linkedinUrl });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Manage your public profile and contact details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email</Label>
          <div className="text-sm text-muted-foreground">{profile.email}</div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Name</Label>
          <div className="text-sm text-muted-foreground">{profile.name || 'Not set'}</div>
        </div>

        {/* LinkedIn URL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">LinkedIn Profile</Label>
            {!isEditing && profile.linkedin_url && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>

          {!isEditing ? (
            <div className="flex items-center gap-2">
              {profile.linkedin_url ? (
                <>
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {profile.linkedin_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Not configured</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                {profile.linkedin_url ? 'Update' : 'Add'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="url"
                placeholder="https://www.linkedin.com/in/your-profile"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                disabled={updateMutation.isPending}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setLinkedinUrl(profile.linkedin_url || '');
                  }}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Info message */}
        <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-xs text-muted-foreground">
          Your LinkedIn profile is used in API calls and registration forms to maintain consistency across the platform.
        </div>
      </CardContent>
    </Card>
  );
}
