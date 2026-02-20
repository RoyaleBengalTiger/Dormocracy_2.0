import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { interDeptTreatiesApi } from '@/api/interDeptTreaties';
import { treatiesApi } from '@/api/treaties';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    TreatyStatus, TreatyType, TreatyDepartmentStatus,
    InterDeptTreaty, InterDeptBreachCase,
    BreachVerdict, BreachVerdictStatus,
    Exchange, ExchangeType, ExchangeStatus,
} from '@/types';
import {
    ArrowLeft, MessageSquare, Plus, Gavel, Trash2, Globe,
    Lock, Check, X, ThumbsUp, ThumbsDown, Shield,
    ShoppingCart, Package,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InterDeptTreatyDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // ─── State ─────────────────────────────────────────────────
    const [tab, setTab] = useState<'departments' | 'clauses' | 'participants' | 'exchanges' | 'breaches'>('clauses');

    // Clause state
    const [clauseContent, setClauseContent] = useState('');
    const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    // Exchange create
    const [exOpen, setExOpen] = useState(false);
    const [exTitle, setExTitle] = useState('');
    const [exDesc, setExDesc] = useState('');
    const [exType, setExType] = useState<ExchangeType>(ExchangeType.TASK_FOR_BOUNTY);
    const [exBounty, setExBounty] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // Breach create
    const [brOpen, setBrOpen] = useState(false);
    const [brTitle, setBrTitle] = useState('');
    const [brDesc, setBrDesc] = useState('');
    const [brAccused, setBrAccused] = useState('');
    const [brAccusedSearch, setBrAccusedSearch] = useState('');
    const [brClauses, setBrClauses] = useState<string[]>([]);

    // Verdict state
    const [verdictOpen, setVerdictOpen] = useState<string | null>(null);
    const [vRuledAgainst, setVRuledAgainst] = useState('ACCUSED');
    const [vCreditFine, setVCreditFine] = useState(0);
    const [vSocialPenalty, setVSocialPenalty] = useState(0);
    const [vPenaltyMode, setVPenaltyMode] = useState('BOTH_MANDATORY');
    const [vNotes, setVNotes] = useState('');

    // ─── Queries ────────────────────────────────────────────────
    const { data: treaty, isLoading } = useQuery({
        queryKey: ['inter-dept-treaty', id],
        queryFn: () => interDeptTreatiesApi.get(id!),
        enabled: !!id,
    });

    const { data: breaches = [] } = useQuery({
        queryKey: ['inter-dept-breaches', id],
        queryFn: () => interDeptTreatiesApi.listBreaches(id!),
        enabled: !!id,
    });

    const { data: exchanges = [] } = useQuery({
        queryKey: ['inter-dept-exchanges', id],
        queryFn: () => treatiesApi.listExchanges(id!),
        enabled: !!id && treaty?.type === TreatyType.EXCHANGE,
    });

    const { data: roomCandidates = [] } = useQuery({
        queryKey: ['inter-dept-room-candidates', id],
        queryFn: () => interDeptTreatiesApi.getRoomCandidates(id!),
        enabled: !!id && !!user?.isForeignMinister,
    });

    const { data: userCandidates = [] } = useQuery({
        queryKey: ['inter-dept-user-candidates', id],
        queryFn: () => interDeptTreatiesApi.getUserCandidates(id!),
        enabled: !!id && !!user?.isForeignMinister,
    });

    const { data: stakeholders = [] } = useQuery({
        queryKey: ['inter-dept-stakeholders', id],
        queryFn: () => interDeptTreatiesApi.listStakeholders(id!),
        enabled: !!id,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['inter-dept-treaty', id] });
        queryClient.invalidateQueries({ queryKey: ['inter-dept-breaches', id] });
        queryClient.invalidateQueries({ queryKey: ['inter-dept-exchanges', id] });
        queryClient.invalidateQueries({ queryKey: ['inter-dept-room-candidates', id] });
        queryClient.invalidateQueries({ queryKey: ['inter-dept-user-candidates', id] });
    };

    // ─── Mutations ─────────────────────────────────────────────

    const respondDept = useMutation({
        mutationFn: ({ deptId, action }: { deptId: string; action: 'ACCEPT' | 'REJECT' }) =>
            interDeptTreatiesApi.respondDepartment(id!, deptId, action),
        onSuccess: () => { invalidate(); toast({ title: 'Response recorded' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Participants
    const addRoomMut = useMutation({
        mutationFn: (roomId: string) => interDeptTreatiesApi.addRoom(id!, roomId),
        onSuccess: () => { invalidate(); toast({ title: 'Room added' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const addUserMut = useMutation({
        mutationFn: (userId: string) => interDeptTreatiesApi.addUser(id!, userId),
        onSuccess: () => { invalidate(); toast({ title: 'User added' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const removeRoomMut = useMutation({
        mutationFn: (roomId: string) => interDeptTreatiesApi.removeRoom(id!, roomId),
        onSuccess: () => { invalidate(); toast({ title: 'Room removed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const removeUserMut = useMutation({
        mutationFn: (userId: string) => interDeptTreatiesApi.removeUser(id!, userId),
        onSuccess: () => { invalidate(); toast({ title: 'User removed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Clauses
    const addClauseMut = useMutation({
        mutationFn: () => interDeptTreatiesApi.addClause(id!, clauseContent),
        onSuccess: () => { invalidate(); setClauseContent(''); toast({ title: 'Clause added' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const updateClauseMut = useMutation({
        mutationFn: ({ clauseId, content }: { clauseId: string; content: string }) =>
            interDeptTreatiesApi.updateClause(id!, clauseId, content),
        onSuccess: () => { invalidate(); setEditingClauseId(null); toast({ title: 'Clause updated' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const deleteClauseMut = useMutation({
        mutationFn: (clauseId: string) => interDeptTreatiesApi.deleteClause(id!, clauseId),
        onSuccess: () => { invalidate(); toast({ title: 'Clause removed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Advance (lock all clauses + NEGOTIATION → LOCKED)
    const advanceMut = useMutation({
        mutationFn: () => interDeptTreatiesApi.advance(id!),
        onSuccess: () => { invalidate(); toast({ title: 'All clauses locked — treaty is now LOCKED' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Accept / Reject / Leave (LOCKED stage)
    const acceptMut = useMutation({
        mutationFn: () => interDeptTreatiesApi.accept(id!),
        onSuccess: () => { invalidate(); toast({ title: 'You accepted the treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const rejectMut = useMutation({
        mutationFn: () => interDeptTreatiesApi.reject(id!),
        onSuccess: () => { invalidate(); toast({ title: 'You rejected the treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const leaveMut = useMutation({
        mutationFn: () => interDeptTreatiesApi.leave(id!),
        onSuccess: () => { invalidate(); toast({ title: 'You left the treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Exchanges (reuse existing treaties API - same Treaty model)
    const createExMut = useMutation({
        mutationFn: () => treatiesApi.createExchange(id!, { title: exTitle, description: exDesc || undefined, type: exType, bounty: Number(exBounty) }),
        onSuccess: () => { invalidate(); setExOpen(false); setExTitle(''); setExDesc(''); setExBounty(''); toast({ title: 'Exchange created' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const acceptExMut = useMutation({
        mutationFn: (eid: string) => treatiesApi.acceptExchange(id!, eid),
        onSuccess: () => { invalidate(); toast({ title: 'Exchange accepted' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const deliverExMut = useMutation({
        mutationFn: (eid: string) => treatiesApi.deliverExchange(id!, eid, deliveryNotes || undefined),
        onSuccess: () => { invalidate(); setDeliveryNotes(''); toast({ title: 'Marked as delivered' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const reviewExMut = useMutation({
        mutationFn: ({ eid, approve }: { eid: string; approve: boolean }) => treatiesApi.reviewExchange(id!, eid, approve),
        onSuccess: () => { invalidate(); toast({ title: 'Exchange reviewed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Breaches
    const createBrMut = useMutation({
        mutationFn: () => interDeptTreatiesApi.createBreach(id!, {
            accusedUserId: brAccused, clauseIds: brClauses,
            title: brTitle, description: brDesc || undefined,
        }),
        onSuccess: () => {
            invalidate(); setBrOpen(false); setBrTitle(''); setBrDesc(''); setBrAccused(''); setBrClauses([]);
            toast({ title: 'Breach case filed' });
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Verdicts
    const proposeVerdictMut = useMutation({
        mutationFn: (breachId: string) => interDeptTreatiesApi.proposeVerdict(id!, breachId, {
            ruledAgainst: vRuledAgainst, creditFine: vCreditFine,
            socialPenalty: vSocialPenalty, penaltyMode: vPenaltyMode, notes: vNotes || undefined,
        }),
        onSuccess: () => { invalidate(); setVerdictOpen(null); toast({ title: 'Verdict proposed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const voteVerdictMut = useMutation({
        mutationFn: ({ verdictId, vote }: { verdictId: string; vote: 'ACCEPT' | 'REJECT' }) =>
            interDeptTreatiesApi.voteVerdict(verdictId, { vote }),
        onSuccess: () => { invalidate(); toast({ title: 'Vote recorded' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    if (isLoading || !treaty) return <p className="p-6 text-muted-foreground">Loading...</p>;

    const isHostFM = user?.id === treaty.hostForeignMinisterId;
    const isFM = user?.isForeignMinister;
    const userAcceptedDept = treaty.treatyDepartments.find(
        td => td.status === TreatyDepartmentStatus.ACCEPTED && td.department.foreignMinisterId === user?.id
    );
    const canEditClauses = (!!userAcceptedDept || isHostFM) && treaty.status === TreatyStatus.NEGOTIATION;
    const canManageParticipants = !!(isFM && userAcceptedDept && treaty.status === TreatyStatus.NEGOTIATION);

    // Check if current user's dept has a PENDING invite
    const myPendingDept = treaty.treatyDepartments.find(
        td => td.status === TreatyDepartmentStatus.PENDING && td.department.foreignMinisterId === user?.id
    );

    // Check if user is a PENDING participant (LOCKED stage — needs to accept/reject)
    const myPendingParticipant = treaty.status === TreatyStatus.LOCKED
        ? treaty.participants.find(p => {
            if (p.status !== 'PENDING') return false;
            if (p.type === 'USER' && p.userId === user?.id) return true;
            if (p.type === 'ROOM' && p.roomId && user?.room?.id === p.roomId) return true;
            return false;
        })
        : null;

    const statusColor = (s: string) => {
        const map: Record<string, string> = {
            NEGOTIATION: 'bg-blue-500/20 text-blue-300',
            LOCKED: 'bg-yellow-500/20 text-yellow-300',
            ACTIVE: 'bg-green-500/20 text-green-300',
            EXPIRED: 'bg-red-500/20 text-red-300',
            OPEN: 'bg-blue-500/20 text-blue-300',
            IN_REVIEW: 'bg-orange-500/20 text-orange-300',
            ACCEPTED: 'bg-cyan-500/20 text-cyan-300',
            DELIVERED: 'bg-purple-500/20 text-purple-300',
            APPROVED: 'bg-green-500/20 text-green-300',
            REJECTED: 'bg-red-500/20 text-red-300',
            RESOLVED: 'bg-green-500/20 text-green-300',
            PENDING: 'bg-yellow-500/20 text-yellow-300',
            LEFT: 'bg-gray-500/20 text-gray-300',
            PROPOSED: 'bg-blue-500/20 text-blue-300',
        };
        return map[s] || 'bg-gray-500/20 text-gray-300';
    };

    const tabList: typeof tab[] = ['departments', 'clauses', 'participants',
        ...(treaty.type === TreatyType.EXCHANGE ? ['exchanges' as const] : []),
        'breaches'];

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header — matches TreatyDetail style */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/app/treaties')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">{treaty.title}</h1>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">
                            <Globe className="h-3 w-3 mr-1" /> Inter-Dept
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(treaty.status)}`}>
                            {treaty.status.replace('_', ' ')}
                        </span>
                        <span>{treaty.type === TreatyType.EXCHANGE ? 'Exchange' : 'Non-Exchange'}</span>
                        <span>Ends {new Date(treaty.endsAt).toLocaleString()}</span>
                        <span>Host: {treaty.department.name}</span>
                        <span>FM: {treaty.hostForeignMinister?.username ?? 'N/A'}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {treaty.chatRoom && (
                        <Button variant="outline" onClick={() => navigate(`/app/inter-dept-treaties/${id}/chat`)}>
                            <MessageSquare className="h-4 w-4 mr-2" /> Treaty Chat
                        </Button>
                    )}
                </div>
            </div>

            {/* Accept / Reject banner for pending dept FM */}
            {myPendingDept && (
                <Card className="glass-card border-orange-500/30">
                    <CardContent className="py-4 flex items-center justify-between">
                        <span className="font-medium">Your department ({myPendingDept.department.name}) has been invited to this treaty.</span>
                        <div className="flex gap-2">
                            <Button variant="default" onClick={() => respondDept.mutate({ deptId: myPendingDept.departmentId, action: 'ACCEPT' })} disabled={respondDept.isPending}>
                                <Check className="h-4 w-4 mr-2" /> Accept
                            </Button>
                            <Button variant="destructive" onClick={() => respondDept.mutate({ deptId: myPendingDept.departmentId, action: 'REJECT' })} disabled={respondDept.isPending}>
                                <X className="h-4 w-4 mr-2" /> Reject
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Accept / Reject / Leave banner for LOCKED stage participants */}
            {treaty.status === TreatyStatus.LOCKED && myPendingParticipant && (
                <Card className="glass-card border-cyan-500/30">
                    <CardContent className="py-4 flex items-center justify-between">
                        <span className="font-medium">The treaty is locked. Review the clauses and respond.</span>
                        <div className="flex gap-2">
                            <Button variant="default" onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}>
                                <Check className="h-4 w-4 mr-2" /> Accept Treaty
                            </Button>
                            <Button variant="outline" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                                <X className="h-4 w-4 mr-2" /> Reject
                            </Button>
                            <Button variant="destructive" onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}>
                                Leave
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabs — same style as TreatyDetail */}
            <div className="flex gap-2 border-b pb-2">
                {tabList.map((t) => (
                    <Button
                        key={t}
                        variant={tab === t ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTab(t)}
                        className="capitalize"
                    >
                        {t}
                    </Button>
                ))}
            </div>

            {/* ─── Departments Tab ───────────────────────────────── */}
            {tab === 'departments' && (
                <div className="space-y-3">
                    {treaty.treatyDepartments.map(td => (
                        <Card key={td.id} className="glass-card">
                            <CardContent className="py-3 flex items-center justify-between">
                                <div>
                                    <span className="font-medium">{td.department.name}</span>
                                    {td.department.foreignMinister && (
                                        <span className="text-sm text-muted-foreground ml-2">FM: {td.department.foreignMinister.username}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(td.status)}`}>
                                        {td.status}
                                    </span>
                                    {td.status === TreatyDepartmentStatus.PENDING && td.department.foreignMinisterId === user?.id && (
                                        <div className="flex gap-1 ml-2">
                                            <Button size="sm" variant="default"
                                                onClick={() => respondDept.mutate({ deptId: td.departmentId, action: 'ACCEPT' })}
                                                disabled={respondDept.isPending}>
                                                <Check className="h-3 w-3 mr-1" /> Accept
                                            </Button>
                                            <Button size="sm" variant="destructive"
                                                onClick={() => respondDept.mutate({ deptId: td.departmentId, action: 'REJECT' })}
                                                disabled={respondDept.isPending}>
                                                <X className="h-3 w-3 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ─── Clauses Tab ───────────────────────────────────── */}
            {tab === 'clauses' && (
                <div className="space-y-3">
                    {treaty.clauses.length === 0 && (
                        <p className="text-muted-foreground text-sm">No clauses yet.</p>
                    )}
                    {treaty.clauses.map((c, i) => (
                        <Card key={c.id} className={`glass-card ${c.isLocked ? 'border-yellow-500/20' : ''}`}>
                            <CardContent className="py-3">
                                {editingClauseId === c.id ? (
                                    <div className="flex gap-2">
                                        <Input value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1" />
                                        <Button size="sm" onClick={() => updateClauseMut.mutate({ clauseId: c.id, content: editContent })}>Save</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingClauseId(null)}>Cancel</Button>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-xs text-muted-foreground mr-2">§{i + 1}</span>
                                            {c.isLocked && <Lock className="h-3 w-3 text-yellow-400 inline mr-1" />}
                                            <span>{c.content}</span>
                                            <span className="text-xs text-muted-foreground ml-2">— {c.createdBy.username}</span>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-4">
                                            {canEditClauses && (
                                                <>
                                                    <Button size="sm" variant="ghost" onClick={() => { setEditingClauseId(c.id); setEditContent(c.content); }}>
                                                        Edit
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => deleteClauseMut.mutate(c.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                    {canEditClauses && (
                        <div className="flex gap-2">
                            <Input value={clauseContent} onChange={e => setClauseContent(e.target.value)} placeholder="New clause text..." className="flex-1" />
                            <Button onClick={() => addClauseMut.mutate()} disabled={!clauseContent || addClauseMut.isPending}>
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>
                    )}
                    {/* Host FM: Lock all clauses & advance */}
                    {isHostFM && treaty.status === TreatyStatus.NEGOTIATION && treaty.clauses.length > 0 && (
                        <Button
                            className="mt-4"
                            onClick={() => advanceMut.mutate()}
                            disabled={advanceMut.isPending}
                        >
                            <Lock className="h-4 w-4 mr-2" /> Lock All Clauses & Advance to LOCKED
                        </Button>
                    )}
                </div>
            )}

            {/* ─── Participants Tab ──────────────────────────────── */}
            {tab === 'participants' && (
                <div className="space-y-4">
                    {/* FM add controls (NEGOTIATION only) */}
                    {canManageParticipants && (
                        <Card className="glass-card border-primary/30">
                            <CardContent className="py-4 space-y-3">
                                <h3 className="text-sm font-medium">Add Participants (from your department)</h3>
                                {roomCandidates.length > 0 && (
                                    <Select onValueChange={v => addRoomMut.mutate(v)}>
                                        <SelectTrigger><SelectValue placeholder="+ Add room from your department" /></SelectTrigger>
                                        <SelectContent>
                                            {roomCandidates.map(r => (
                                                <SelectItem key={r.id} value={r.id}>Room {r.roomNumber} ({r.users.length} users)</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {userCandidates.length > 0 && (
                                    <Select onValueChange={v => addUserMut.mutate(v)}>
                                        <SelectTrigger><SelectValue placeholder="+ Add user from your department" /></SelectTrigger>
                                        <SelectContent>
                                            {userCandidates.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.username} ({u.email})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Participant list */}
                    {treaty.participants.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No participants added yet.</p>
                    ) : (
                        treaty.participants.map(p => (
                            <Card key={p.id} className="glass-card">
                                <CardContent className="py-3 flex items-center justify-between">
                                    <div>
                                        {p.type === 'ROOM' ? (
                                            <span>🏠 Room {p.room?.roomNumber || p.roomId}</span>
                                        ) : (
                                            <span>👤 {p.user?.username || p.userId}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                                            {p.status}
                                        </span>
                                        {canManageParticipants && (
                                            p.type === 'ROOM'
                                                ? p.room?.departmentId === userAcceptedDept?.departmentId
                                                : true // For USER participants, the backend validates department ownership
                                        ) && (
                                                <Button size="sm" variant="ghost" onClick={() =>
                                                    p.type === 'ROOM' && p.roomId
                                                        ? removeRoomMut.mutate(p.roomId)
                                                        : p.userId && removeUserMut.mutate(p.userId)
                                                }>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* ─── Exchanges Tab ─────────────────────────────────── */}
            {tab === 'exchanges' && (
                <div className="space-y-4">
                    {treaty.status === TreatyStatus.ACTIVE && (
                        <Dialog open={exOpen} onOpenChange={setExOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> New Exchange</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Create Exchange</DialogTitle></DialogHeader>
                                <div className="space-y-3 mt-3">
                                    <Input placeholder="Title" value={exTitle} onChange={e => setExTitle(e.target.value)} />
                                    <Textarea placeholder="Description (optional)" value={exDesc} onChange={e => setExDesc(e.target.value)} />
                                    <Select value={exType} onValueChange={v => setExType(v as ExchangeType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ExchangeType.TASK_FOR_BOUNTY}>Task for Bounty</SelectItem>
                                            <SelectItem value={ExchangeType.NOTES_OR_RESOURCES_FOR_BOUNTY}>Notes/Resources for Bounty</SelectItem>
                                            <SelectItem value={ExchangeType.ITEMS_FOR_BOUNTY}>Items for Bounty</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Bounty (credits)" value={exBounty} onChange={e => setExBounty(e.target.value)} />
                                    <Button className="w-full" onClick={() => createExMut.mutate()} disabled={!exTitle || !exBounty || createExMut.isPending}>
                                        Create
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {exchanges.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No exchanges yet.</p>
                    ) : (
                        exchanges.map((ex: Exchange) => (
                            <Card key={ex.id} className="glass-card">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{ex.title}</CardTitle>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(ex.status)}`}>{ex.status}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="text-sm text-muted-foreground">
                                        {ex.description && <p>{ex.description}</p>}
                                        <p>💰 Bounty: {ex.bounty} credits | Requester: {ex.buyer.username} {ex.seller ? `| Worker: ${ex.seller.username}` : ''}</p>
                                        {ex.deliveryNotes && <p>📦 Notes: {ex.deliveryNotes}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        {ex.status === ExchangeStatus.OPEN && ex.buyer.id !== user?.id && (
                                            <Button size="sm" onClick={() => acceptExMut.mutate(ex.id)} disabled={acceptExMut.isPending}>
                                                <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Accept
                                            </Button>
                                        )}
                                        {ex.status === ExchangeStatus.ACCEPTED && ex.seller?.id === user?.id && (
                                            <div className="flex gap-2 items-center">
                                                <Input placeholder="Delivery notes..." value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} className="w-56" />
                                                <Button size="sm" onClick={() => deliverExMut.mutate(ex.id)} disabled={deliverExMut.isPending}>
                                                    <Package className="h-3.5 w-3.5 mr-1" /> Deliver
                                                </Button>
                                            </div>
                                        )}
                                        {ex.status === ExchangeStatus.DELIVERED && ex.buyer.id === user?.id && (
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => reviewExMut.mutate({ eid: ex.id, approve: true })} disabled={reviewExMut.isPending}>
                                                    <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve & Pay
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => reviewExMut.mutate({ eid: ex.id, approve: false })} disabled={reviewExMut.isPending}>
                                                    <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* ─── Breach Cases Tab ──────────────────────────────── */}
            {tab === 'breaches' && (
                <div className="space-y-4">
                    {treaty.status === TreatyStatus.ACTIVE && (
                        <Dialog open={brOpen} onOpenChange={setBrOpen}>
                            <DialogTrigger asChild>
                                <Button><Gavel className="h-4 w-4 mr-2" /> File Breach Case</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>File Breach Case</DialogTitle></DialogHeader>
                                <div className="space-y-3 mt-3">
                                    <Input placeholder="Title" value={brTitle} onChange={e => setBrTitle(e.target.value)} />
                                    <Textarea placeholder="Description" value={brDesc} onChange={e => setBrDesc(e.target.value)} />
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Accused User:</label>
                                        <div className="relative">
                                            <Input
                                                placeholder="Search user..."
                                                value={brAccusedSearch}
                                                onChange={e => {
                                                    setBrAccusedSearch(e.target.value);
                                                    if (brAccused) setBrAccused('');
                                                }}
                                            />
                                            {brAccused && (
                                                <div className="mt-1 text-sm text-green-400">
                                                    Selected: {stakeholders.find(s => s.id === brAccused)?.username ?? brAccused}
                                                </div>
                                            )}
                                            {!brAccused && brAccusedSearch.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                                                    {stakeholders
                                                        .filter(s =>
                                                            s.id !== user?.id &&
                                                            (s.username.toLowerCase().includes(brAccusedSearch.toLowerCase()) ||
                                                                s.email.toLowerCase().includes(brAccusedSearch.toLowerCase()))
                                                        )
                                                        .map(s => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                                                                onClick={() => {
                                                                    setBrAccused(s.id);
                                                                    setBrAccusedSearch(s.username);
                                                                }}
                                                            >
                                                                <span className="font-medium">{s.username}</span>
                                                                <span className="text-muted-foreground ml-2">{s.email}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {stakeholders.filter(s =>
                                                        s.id !== user?.id &&
                                                        (s.username.toLowerCase().includes(brAccusedSearch.toLowerCase()) ||
                                                            s.email.toLowerCase().includes(brAccusedSearch.toLowerCase()))
                                                    ).length === 0 && (
                                                            <div className="px-3 py-2 text-sm text-muted-foreground">No matching users found</div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Select violated clauses:</label>
                                        <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                                            {treaty.clauses.map((c) => (
                                                <label key={c.id} className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={brClauses.includes(c.id)}
                                                        onChange={e => setBrClauses(prev =>
                                                            e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id)
                                                        )}
                                                    />
                                                    §{c.orderIndex + 1}: {c.content}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <Button className="w-full" onClick={() => createBrMut.mutate()} disabled={!brTitle || !brAccused || brClauses.length === 0 || createBrMut.isPending}>
                                        File Case
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {breaches.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No breach cases.</p>
                    ) : (
                        breaches.map((bc: InterDeptBreachCase) => (
                            <Card key={bc.id} className="glass-card">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Gavel className="h-4 w-4" /> {bc.title}
                                        </CardTitle>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bc.status)}`}>{bc.status.replace(/_/g, ' ')}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-sm text-muted-foreground">
                                        <p>Filed by <strong>{bc.filer.username}</strong> against <strong>{bc.accusedUser.username}</strong></p>
                                        {bc.description && <p>{bc.description}</p>}
                                    </div>

                                    {/* Chat link */}
                                    {bc.chatRoom && (
                                        <Button variant="outline" size="sm" onClick={() => navigate(`/app/inter-dept-treaties/${id}/breaches/${bc.id}/chat`)}>
                                            <MessageSquare className="h-4 w-4 mr-1" /> Case Chat
                                        </Button>
                                    )}

                                    {/* Verdicts */}
                                    {bc.breachVerdicts && bc.breachVerdicts.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Verdicts</p>
                                            {bc.breachVerdicts.map((v: BreachVerdict) => (
                                                <div key={v.id} className={`border rounded-lg p-3 text-sm ${statusColor(v.status).replace('text-', 'border-').split(' ')[0]}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(v.status)}`}>{v.status}</span>
                                                            {' '}Against: {v.ruledAgainst} · Fine: {v.creditFine}cr · Social: -{v.socialPenalty}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{v.penaltyMode}</span>
                                                    </div>
                                                    {v.notes && <p className="text-muted-foreground mb-2">{v.notes}</p>}

                                                    {/* Votes */}
                                                    <div className="space-y-1 mb-2">
                                                        {v.votes.map(vote => (
                                                            <div key={vote.id} className="flex items-center gap-2 text-xs">
                                                                {vote.vote === 'ACCEPT' ?
                                                                    <ThumbsUp className="h-3 w-3 text-green-400" /> :
                                                                    <ThumbsDown className="h-3 w-3 text-red-400" />}
                                                                <span>{vote.voterUser.username} ({vote.voterDepartment.name})</span>
                                                                {vote.comment && <span className="text-muted-foreground">— {vote.comment}</span>}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* FM vote buttons */}
                                                    {v.status === BreachVerdictStatus.PROPOSED && isFM && (
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="outline" className="text-green-400 border-green-500/40"
                                                                onClick={() => voteVerdictMut.mutate({ verdictId: v.id, vote: 'ACCEPT' })}
                                                                disabled={voteVerdictMut.isPending}>
                                                                <ThumbsUp className="h-3 w-3 mr-1" /> Accept
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-red-400 border-red-500/40"
                                                                onClick={() => voteVerdictMut.mutate({ verdictId: v.id, vote: 'REJECT' })}
                                                                disabled={voteVerdictMut.isPending}>
                                                                <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Propose verdict (host FM only, breach IN_REVIEW) */}
                                    {isHostFM && bc.status === 'IN_REVIEW' && (
                                        <div>
                                            {verdictOpen === bc.id ? (
                                                <div className="border border-border rounded-lg p-3 space-y-2">
                                                    <p className="text-sm font-medium">Propose Verdict</p>
                                                    <Select value={vRuledAgainst} onValueChange={setVRuledAgainst}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ACCUSED">Against Accused</SelectItem>
                                                            <SelectItem value="ACCUSER">Against Accuser</SelectItem>
                                                            <SelectItem value="NONE">Dismiss</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value={vPenaltyMode} onValueChange={setVPenaltyMode}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="BOTH_MANDATORY">Both Mandatory</SelectItem>
                                                            <SelectItem value="EITHER_CHOICE">Criminal Chooses</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex gap-2">
                                                        <Input type="number" placeholder="Social penalty" value={vSocialPenalty} onChange={e => setVSocialPenalty(+e.target.value)} />
                                                        <Input type="number" placeholder="Credit fine" value={vCreditFine} onChange={e => setVCreditFine(+e.target.value)} />
                                                    </div>
                                                    <Textarea placeholder="Resolution note..." value={vNotes} onChange={e => setVNotes(e.target.value)} rows={2} />
                                                    <div className="flex gap-2">
                                                        <Button size="sm" onClick={() => proposeVerdictMut.mutate(bc.id)} disabled={proposeVerdictMut.isPending}>
                                                            Submit Verdict
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setVerdictOpen(null)}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => setVerdictOpen(bc.id)}>
                                                    <Shield className="h-3.5 w-3.5 mr-1" /> Propose Verdict
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
