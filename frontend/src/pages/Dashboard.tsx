import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { usersApi } from '@/api/users';
import { tasksApi } from '@/api/tasks';
import { financeApi } from '@/api/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/RoleBadge';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { User, Building2, Award, CheckCircle2, Star, Send, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SocialScorePurchaseRequest } from '@/types';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: usersApi.getMe,
  });

  const myTasksQuery = useQuery({
    queryKey: ['tasks', 'dashboard', 'my'],
    queryFn: () => tasksApi.getTasks({ myOnly: true }),
    enabled: Boolean(user),
  });

  const mySSRequests = useQuery({
    queryKey: ['finance', 'social-score', 'my'],
    queryFn: financeApi.getMySocialScoreRequests,
    enabled: Boolean(user),
  });

  const [requestNote, setRequestNote] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const createRequestMutation = useMutation({
    mutationFn: (data: { requestNote?: string }) => financeApi.createSocialScoreRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'social-score', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Request submitted', description: 'Your PM will review your request.' });
      setRequestNote('');
      setShowRequestForm(false);
    },
    onError: (e) => {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => financeApi.acceptOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'social-score', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Offer accepted!', description: 'Credits deducted and social score added.' });
    },
    onError: (e) => {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => financeApi.rejectOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'social-score', 'my'] });
      toast({ title: 'Offer rejected' });
    },
    onError: (e) => {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    );
  }

  const roomNumber = user?.room?.roomNumber ?? 'N/A';
  const departmentName = user?.room?.department?.name ?? 'N/A';
  const Name = user?.room?.mayor?.username ?? 'Not assigned';
  const roommates = user?.room?.users ?? [];

  return (
    <div className="min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl space-y-8"
      >
        <div>
          <h1 className="text-4xl font-bold mb-2">Welcome back, {user.username}</h1>
          <p className="text-muted-foreground">Your citizen dashboard</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                My Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium">{user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Role</span>
                <RoleBadge role={user.role} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{departmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room</span>
                <span className="font-medium">{roomNumber}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Social Score
                </span>
                <span className="text-2xl font-bold text-primary">{user.socialScore}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Credits
                </span>
                <span className="text-2xl font-bold text-primary">{user.credits}</span>
              </div>

            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                My Room — {roomNumber}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roommates.length === 0 ? (
                <p className="text-muted-foreground">No members found</p>
              ) : (
                <ul className="space-y-2">
                  {roommates.map((rm) => {
                    const roles: string[] = [];
                    if (user?.room?.department?.primeMinisterId === rm.id) roles.push('PM');
                    if (user?.room?.department?.foreignMinisterId === rm.id) roles.push('Foreign Minister');
                    if (user?.room?.department?.financeMinisterId === rm.id) roles.push('Finance Minister');
                    return (
                      <li key={rm.id} className="flex items-center justify-between rounded-lg border bg-card p-2 px-3">
                        <span className="font-medium">{rm.username}</span>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">{rm.role}</span>
                          {roles.map((r) => (
                            <span key={r} className="inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">{r}</span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── My Tasks ─────────────────────────────────── */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              My Tasks
            </CardTitle>
            <Link to="/app/tasks">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {myTasksQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : myTasksQuery.isError ? (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {myTasksQuery.error instanceof Error ? myTasksQuery.error.message : 'Failed to load tasks'}
                </p>
                <Button variant="outline" size="sm" onClick={() => myTasksQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (myTasksQuery.data?.length ?? 0) === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No tasks assigned to you yet.
              </p>
            ) : (
              <div className="space-y-3">
                {myTasksQuery.data!.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(task.createdAt).toLocaleDateString()} • {task.status.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <StatusPill status={task.status} />
                  </div>
                ))}
                <div className="pt-2">
                  <Link to="/app/tasks">
                    <Button variant="secondary" className="w-full">Open Tasks</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Social Score Purchase ─────────────────────── */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Buy Social Score
            </CardTitle>
            {!showRequestForm && (
              <Button size="sm" onClick={() => setShowRequestForm(true)}>
                New Request
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Request form */}
            {showRequestForm && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Request to buy social score from your department's PM. They will set the price.
                </p>
                <div className="grid gap-2">
                  <Label>Note (optional)</Label>
                  <Input
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Why do you need social score?"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => createRequestMutation.mutate({ requestNote: requestNote || undefined })}
                    disabled={createRequestMutation.isPending}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowRequestForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* My requests list */}
            {mySSRequests.isLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (mySSRequests.data?.length ?? 0) === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">
                No purchase requests yet. Click "New Request" to buy social score.
              </p>
            ) : (
              <div className="space-y-2">
                {mySSRequests.data!.map((req: SocialScorePurchaseRequest) => (
                  <div key={req.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {req.status === 'REQUESTED' && '⏳ Awaiting PM offer'}
                          {req.status === 'OFFERED' && `💰 Offer: ${req.offeredSocialScore} score for ${req.offeredPriceCredits} credits`}
                          {req.status === 'ACCEPTED' && `✅ Purchased ${req.offeredSocialScore} score for ${req.offeredPriceCredits} credits`}
                          {req.status === 'REJECTED' && '❌ Rejected'}
                          {req.status === 'CANCELLED' && '🚫 Cancelled'}
                        </span>
                      </div>
                      {req.requestNote && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{req.requestNote}"</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {/* Accept / Reject buttons for OFFERED status */}
                    {req.status === 'OFFERED' && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => acceptMutation.mutate(req.id)}
                          disabled={acceptMutation.isPending}
                        >
                          <Check className="mr-1 h-3 w-3" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(req.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div >
    </div >
  );
}