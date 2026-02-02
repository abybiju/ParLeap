'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { LogOut, User, Mail, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppPageWrapper } from '@/components/layout/AppPageWrapper';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, isLoading, fetchUser, signOut } = useAuthStore();
  const [username, setUsername] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Fetch user data if not already loaded
    if (!user && !isLoading) {
      fetchUser();
    } else if (profile) {
      setUsername(profile.username || '');
    }
  }, [user, profile, isLoading, fetchUser]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    const supabase = createClient();

    // Using type assertion to work around Supabase type inference issues
    const { error } = await (supabase
      .from('profiles') as ReturnType<typeof supabase.from>)
      .update({
        username: username || null,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update username: ' + error.message);
    } else {
      toast.success('Username updated successfully');
      await fetchUser(); // Refresh user data
    }

    setIsUpdating(false);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    toast.success('Signed out successfully');
    router.push('/auth/login');
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const subscriptionTier = profile?.subscription_tier || 'free';
  const tierColors = {
    free: 'text-slate-400',
    pro: 'text-indigo-400',
    team: 'text-purple-400',
  };

  return (
    <AppPageWrapper className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
              <p className="text-sm text-slate-400 mt-0.5">Manage your account settings</p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur">
          {/* User Info Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Information
            </h2>

            <div className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Username (editable) */}
              <form onSubmit={handleUpdateUsername}>
                <div>
                  <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      className={cn(
                        'flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                        'placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40'
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={isUpdating || username === (profile?.username || '')}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white"
                    >
                      {isUpdating ? 'Updating...' : 'Update'}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Subscription Tier */}
              <div>
                <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  Subscription Tier
                </label>
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg font-medium capitalize', tierColors[subscriptionTier])}>
                    {subscriptionTier}
                  </span>
                  {subscriptionTier === 'free' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to upgrade page or show upgrade modal
                        toast.info('Upgrade feature coming soon!');
                      }}
                      className="ml-2 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
            <div className="space-y-3">
              <Button
                variant="destructive"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full flex items-center justify-center gap-2"
              >
                {isSigningOut ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Account Stats (optional) */}
          <div className="border-t border-white/10 pt-8 mt-8">
            <h2 className="text-xl font-semibold mb-4">Account Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Member Since</p>
                <p className="text-lg font-semibold mt-1">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })
                    : 'N/A'}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">User ID</p>
                <p className="text-xs font-mono text-slate-500 mt-1 truncate">{user.id}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </AppPageWrapper>
  );
}
