import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { tasksApi } from '@/api/tasks';
import { financeApi } from '@/api/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Task, TaskStatus } from '@/types';
import { Crown, DollarSign, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/StatusPill';
import { ApproveAssignTaskModal } from '@/components/modals/ApproveAssignTaskModal';
import { ReviewTaskModal } from '@/components/modals/ReviewTaskModal';

const TX_TYPE_LABELS: Record<string, string> = {
  DEPT_ALLOCATE_TO_ROOM: 'Allocated from Dept',
  DEPT_RECALL_FROM_ROOM: 'Recalled to Dept',
  ROOM_TASK_SPEND: 'Task Spend',
  USER_BUY_SOCIAL_SCORE: 'Social Score Purchase',
};

const TX_TYPE_COLORS: Record<string, string> = {
  DEPT_ALLOCATE_TO_ROOM: 'text-green-400',
  DEPT_RECALL_FROM_ROOM: 'text-amber-400',
  ROOM_TASK_SPEND: 'text-red-400',
  USER_BUY_SOCIAL_SCORE: 'text-blue-400',
};

export default function MayorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const {
    data: pendingTasks = [],
    isLoading: isLoadingPending,
    isError: isErrorPending,
    error: errorPending,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['tasks', TaskStatus.PENDING_APPROVAL],
    queryFn: () => tasksApi.getTasks({ status: TaskStatus.PENDING_APPROVAL }),
  });

  const {
    data: reviewTasks = [],
    isLoading: isLoadingReview,
    isError: isErrorReview,
    error: errorReview,
    refetch: refetchReview,
  } = useQuery({
    queryKey: ['tasks', TaskStatus.AWAITING_REVIEW],
    queryFn: () => tasksApi.getTasks({ status: TaskStatus.AWAITING_REVIEW }),
  });

  const {
    data: treasury,
    isLoading: isTreasuryLoading,
    isError: isTreasuryError,
    error: treasuryError,
  } = useQuery({
    queryKey: ['finance', 'room-treasury'],
    queryFn: financeApi.getRoomTreasury,
  });

  const roomResidents = useMemo(() => {
    // candidates must be residents of the mayor's room
    return user?.room?.users ?? [];
  }, [user?.room?.users]);

  const openApprove = (task: Task) => {
    setSelectedTask(task);
    setApproveOpen(true);
  };

  const openReview = (task: Task) => {
    setSelectedTask(task);
    setReviewOpen(true);
  };

  const treasuryErrorMsg = treasuryError instanceof Error ? treasuryError.message : '';

  return (
    <div className="min-h-screen p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <Crown className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Mayor Dashboard</h1>
        </div>

        {/* ── Room Treasury ──────────────────────────────── */}
        <div className="mb-6">
          {isTreasuryLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : isTreasuryError ? (
            !(/forbidden|403/i.test(treasuryErrorMsg)) && (
              <Card className="glass-card">
                <CardContent className="py-4 text-center text-muted-foreground">
                  {treasuryErrorMsg || 'Failed to load treasury'}
                </CardContent>
              </Card>
            )
          ) : treasury ? (
            <Card className="glass-card border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  Room {treasury.roomNumber} Treasury
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-3xl font-bold mb-4">
                  <DollarSign className="h-7 w-7 text-green-400" />
                  {treasury.treasuryCredits.toLocaleString()}
                  <span className="text-lg font-normal text-muted-foreground">credits</span>
                </div>

                {/* Spending History */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1 mb-2 text-muted-foreground">
                    <History className="h-4 w-4" /> Recent Transactions
                  </h3>
                  {treasury.recentTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {treasury.recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between text-sm rounded border bg-card/50 px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${TX_TYPE_COLORS[tx.type] ?? ''}`}>
                              {TX_TYPE_LABELS[tx.type] ?? tx.type}
                            </span>
                            {tx.note && <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {tx.note}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-bold">{tx.amount.toLocaleString()} cr</span>
                            <span className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-2xl">Pending Approval ({pendingTasks.length})</CardTitle>
              <p className="text-sm text-muted-foreground">Approve and assign tasks to room residents.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingPending ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : isErrorPending ? (
                <div className="py-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {errorPending instanceof Error ? errorPending.message : 'Failed to load tasks'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['tasks', TaskStatus.PENDING_APPROVAL] });
                      refetchPending();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks awaiting approval.</p>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((t) => (
                    <div key={t.id} className="rounded-lg border bg-background/40 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Requested by: <span className="text-foreground">{t.createdBy?.username ?? 'Unknown'}</span>
                          </p>
                        </div>
                        <StatusPill status={t.status} />
                      </div>
                      {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
                      <Button className="w-full" onClick={() => openApprove(t)}>
                        Approve & Assign
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-2xl">Awaiting Review ({reviewTasks.length})</CardTitle>
              <p className="text-sm text-muted-foreground">Review completed tasks and accept or reject.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingReview ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : isErrorReview ? (
                <div className="py-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {errorReview instanceof Error ? errorReview.message : 'Failed to load tasks'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['tasks', TaskStatus.AWAITING_REVIEW] });
                      refetchReview();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : reviewTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks awaiting review.</p>
              ) : (
                <div className="space-y-3">
                  {reviewTasks.map((t) => (
                    <div key={t.id} className="rounded-lg border bg-background/40 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Completed by: <span className="text-foreground">{t.assignedTo?.username ?? 'Unknown'}</span>
                          </p>
                        </div>
                        <StatusPill status={t.status} />
                      </div>
                      {t.completionSummary ? (
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-sm font-medium mb-1">Completion Summary</p>
                          <p className="text-sm text-muted-foreground">{t.completionSummary}</p>
                        </div>
                      ) : null}
                      <Button className="w-full" onClick={() => openReview(t)}>
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <ApproveAssignTaskModal
        open={approveOpen}
        onClose={() => {
          setApproveOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        candidates={roomResidents}
      />

      <ReviewTaskModal
        open={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
      />
    </div>
  );
}