import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { treatiesApi } from '@/api/treaties';
import { roomsAdminApi, type RoomListItem } from '@/api/rooms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import {
    TreatyStatus,
    TreatyType,
    Exchange,
    BreachCase,
    ExchangeType,
    ExchangeStatus,
    BreachCaseStatus,
    BreachRulingType,
    BreachPenaltyMode,
} from '@/types';
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    MessageSquare,
    Plus,
    Gavel,
    Trash2,
    ArrowRight,
    ShoppingCart,
    Package,
    ThumbsUp,
    ThumbsDown,
    LogOut,
    UserPlus,
    Home,
    ChevronsUpDown,
    Search,
} from 'lucide-react';

export default function TreatyDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // ─── State ─────────────────────────────────────────────────
    const [tab, setTab] = useState<'clauses' | 'participants' | 'exchanges' | 'breaches'>('clauses');
    const [clauseContent, setClauseContent] = useState('');
    const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    // Add participants
    const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
    const [userPopoverOpen, setUserPopoverOpen] = useState(false);

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
    const [brAccusedPopoverOpen, setBrAccusedPopoverOpen] = useState(false);
    const [brClauses, setBrClauses] = useState<string[]>([]);

    // Breach ruling (PM)
    const [rulingType, setRulingType] = useState<BreachRulingType>(BreachRulingType.AGAINST_ACCUSED);
    const [penaltyMode, setPenaltyMode] = useState<BreachPenaltyMode>(BreachPenaltyMode.BOTH_MANDATORY);
    const [socialPen, setSocialPen] = useState('');
    const [creditFine, setCreditFine] = useState('');
    const [rulingNote, setRulingNote] = useState('');

    // ─── Queries ───────────────────────────────────────────────
    const { data: treaty, isLoading } = useQuery({
        queryKey: ['treaty', id],
        queryFn: () => treatiesApi.get(id!),
        enabled: !!id,
    });

    const { data: exchanges = [] } = useQuery({
        queryKey: ['treaty-exchanges', id],
        queryFn: () => treatiesApi.listExchanges(id!),
        enabled: !!id && treaty?.type === TreatyType.EXCHANGE,
    });

    const { data: breaches = [] } = useQuery({
        queryKey: ['treaty-breaches', id],
        queryFn: () => treatiesApi.listBreaches(id!),
        enabled: !!id,
    });

    // Fetch all rooms & users for participant search (only when PM + NEGOTIATION)
    const isPMUser = user?.isPrimeMinister;
    const isNegotiation = treaty?.status === TreatyStatus.NEGOTIATION;
    const canSearch = !!isPMUser && !!isNegotiation;

    const { data: allRooms = [] } = useQuery({
        queryKey: ['all-rooms'],
        queryFn: () => roomsAdminApi.listRooms(),
        enabled: canSearch,
    });

    // A2: Use filtered candidates endpoint instead of listing all users
    const { data: candidateUsers = [] } = useQuery({
        queryKey: ['treaty-user-candidates', id],
        queryFn: () => treatiesApi.getUserCandidates(id!),
        enabled: !!id && canSearch,
    });

    // Filter out rooms already in treaty participants
    const existingRoomIds = useMemo(
        () => new Set(treaty?.participants.filter((p) => p.type === 'ROOM' && p.roomId).map((p) => p.roomId!)),
        [treaty?.participants],
    );
    const availableRooms = useMemo(() => allRooms.filter((r: RoomListItem) => !existingRoomIds.has(r.id)), [allRooms, existingRoomIds]);

    // Fetch treaty stakeholders for breach accused dropdown
    const isActive = treaty?.status === TreatyStatus.ACTIVE;
    const { data: stakeholders = [], isLoading: stakeholdersLoading } = useQuery({
        queryKey: ['treaty-stakeholders', id],
        queryFn: () => treatiesApi.listStakeholders(id!),
        enabled: !!id && !!isActive,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['treaty', id] });
        queryClient.invalidateQueries({ queryKey: ['treaty-exchanges', id] });
        queryClient.invalidateQueries({ queryKey: ['treaty-breaches', id] });
        queryClient.invalidateQueries({ queryKey: ['treaty-user-candidates', id] });
    };

    // B1: Breach compensation state
    const [compOpen, setCompOpen] = useState(false);
    const [compBid, setCompBid] = useState('');
    const [compEntries, setCompEntries] = useState<Array<{ userId: string; username: string; amount: number }>>([]);
    const [compNote, setCompNote] = useState('');

    const compensateBreachMut = useMutation({
        mutationFn: () => treatiesApi.createBreachCompensations(id!, compBid, {
            compensations: compEntries.filter(e => e.amount > 0).map(e => ({ userId: e.userId, amount: e.amount })),
            note: compNote || undefined,
        }),
        onSuccess: () => {
            invalidate();
            setCompOpen(false);
            setCompEntries([]);
            setCompNote('');
            toast({ title: 'Compensations sent' });
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });


    const advanceMut = useMutation({
        mutationFn: () => treatiesApi.advance(id!),
        onSuccess: () => { invalidate(); toast({ title: 'Clauses locked' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const addClauseMut = useMutation({
        mutationFn: () => treatiesApi.addClause(id!, clauseContent),
        onSuccess: () => { invalidate(); setClauseContent(''); toast({ title: 'Clause added' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const updateClauseMut = useMutation({
        mutationFn: ({ clauseId, content }: { clauseId: string; content: string }) =>
            treatiesApi.updateClause(id!, clauseId, content),
        onSuccess: () => { invalidate(); setEditingClauseId(null); toast({ title: 'Clause updated' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const deleteClauseMut = useMutation({
        mutationFn: (clauseId: string) => treatiesApi.deleteClause(id!, clauseId),
        onSuccess: () => { invalidate(); toast({ title: 'Clause removed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const acceptMut = useMutation({
        mutationFn: () => treatiesApi.accept(id!),
        onSuccess: () => { invalidate(); toast({ title: 'Accepted treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const rejectMut = useMutation({
        mutationFn: () => treatiesApi.reject(id!),
        onSuccess: () => { invalidate(); toast({ title: 'Rejected treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const leaveMut = useMutation({
        mutationFn: () => treatiesApi.leave(id!),
        onSuccess: () => { invalidate(); toast({ title: 'Left treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const leaveRoomMut = useMutation({
        mutationFn: (roomId: string) => treatiesApi.leaveRoom(id!, roomId),
        onSuccess: () => { invalidate(); toast({ title: 'Room left treaty' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Participant add/remove
    const addRoomMut = useMutation({
        mutationFn: (roomId: string) => treatiesApi.addRoom(id!, roomId),
        onSuccess: () => { invalidate(); setRoomPopoverOpen(false); toast({ title: 'Room added' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const addUserMut = useMutation({
        mutationFn: (userId: string) => treatiesApi.addUser(id!, userId),
        onSuccess: () => { invalidate(); setUserPopoverOpen(false); toast({ title: 'User added' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const removeRoomMut = useMutation({
        mutationFn: (roomId: string) => treatiesApi.removeRoom(id!, roomId),
        onSuccess: () => { invalidate(); toast({ title: 'Room removed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const removeUserMut = useMutation({
        mutationFn: (userId: string) => treatiesApi.removeUser(id!, userId),
        onSuccess: () => { invalidate(); toast({ title: 'User removed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

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

    const createBrMut = useMutation({
        mutationFn: () => treatiesApi.createBreach(id!, { accusedUserId: brAccused, clauseIds: brClauses, title: brTitle, description: brDesc || undefined }),
        onSuccess: () => { invalidate(); setBrOpen(false); setBrTitle(''); setBrDesc(''); setBrAccused(''); setBrClauses([]); toast({ title: 'Breach case filed' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const startEvalMut = useMutation({
        mutationFn: (bid: string) => treatiesApi.startBreachEvaluation(id!, bid),
        onSuccess: () => { invalidate(); toast({ title: 'Evaluation started' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const ruleBreachMut = useMutation({
        mutationFn: (bid: string) => treatiesApi.ruleBreachCase(id!, bid, {
            rulingType,
            penaltyMode: rulingType === BreachRulingType.NONE ? undefined : penaltyMode,
            socialPenalty: Number(socialPen) || 0,
            creditFine: Number(creditFine) || 0,
            resolutionNote: rulingNote || undefined,
        }),
        onSuccess: () => { invalidate(); setRulingNote(''); setSocialPen(''); setCreditFine(''); toast({ title: 'Ruling issued' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const choosePenaltyMut = useMutation({
        mutationFn: ({ bid, choice }: { bid: string; choice: string }) => treatiesApi.chooseBreachPenalty(id!, bid, choice),
        onSuccess: () => { invalidate(); toast({ title: 'Penalty accepted' }); },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    if (isLoading || !treaty) return <p className="p-6 text-muted-foreground">Loading...</p>;

    const isPM = user?.isPrimeMinister;
    const isMayor = user?.isMayor;
    const canEditClauses = (isPM || isMayor) && treaty.status === TreatyStatus.NEGOTIATION;
    const canAdvance = isPM && treaty.status === TreatyStatus.NEGOTIATION;
    const canManageParticipants = isPM && treaty.status === TreatyStatus.NEGOTIATION;

    // Accept/Reject: during LOCKED, if I have a PENDING participation
    const myPendingParticipant = treaty.participants.find(
        (p) =>
            p.status === 'PENDING' &&
            ((p.type === 'USER' && p.userId === user?.id) ||
                (p.type === 'ROOM' && p.room && user?.isMayor)),
    );
    const showAcceptReject = treaty.status === TreatyStatus.LOCKED && myPendingParticipant;

    // Leave: during LOCKED, if I have active (non-LEFT/REJECTED) participation
    const myActiveUserParticipant = treaty.participants.find(
        (p) => p.type === 'USER' && p.userId === user?.id && p.status !== 'REJECTED' && p.status !== 'LEFT',
    );
    const myActiveRoomParticipant = treaty.participants.find(
        (p) => p.type === 'ROOM' && p.room && user?.isMayor && p.status !== 'REJECTED' && p.status !== 'LEFT',
    );
    const canLeaveUser = treaty.status === TreatyStatus.LOCKED && myActiveUserParticipant;
    const canLeaveRoom = treaty.status === TreatyStatus.LOCKED && myActiveRoomParticipant;

    const statusColor = (s: string) => {
        const map: Record<string, string> = {
            NEGOTIATION: 'bg-blue-500/20 text-blue-300',
            LOCKED: 'bg-yellow-500/20 text-yellow-300',
            ACTIVE: 'bg-green-500/20 text-green-300',
            EXPIRED: 'bg-red-500/20 text-red-300',
            OPEN: 'bg-blue-500/20 text-blue-300',
            IN_REVIEW: 'bg-orange-500/20 text-orange-300',
            AWAITING_CRIMINAL_CHOICE: 'bg-amber-500/20 text-amber-300',
            ACCEPTED: 'bg-cyan-500/20 text-cyan-300',
            DELIVERED: 'bg-purple-500/20 text-purple-300',
            APPROVED: 'bg-green-500/20 text-green-300',
            REJECTED: 'bg-red-500/20 text-red-300',
            RESOLVED: 'bg-green-500/20 text-green-300',
            PENDING: 'bg-yellow-500/20 text-yellow-300',
            LEFT: 'bg-gray-500/20 text-gray-300',
        };
        return map[s] || 'bg-gray-500/20 text-gray-300';
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/app/treaties')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{treaty.title}</h1>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(treaty.status)}`}>
                            {treaty.status.replace('_', ' ')}
                        </span>
                        <span>{treaty.type === TreatyType.EXCHANGE ? 'Exchange' : 'Non-Exchange'}</span>
                        <span>Ends {new Date(treaty.endsAt).toLocaleString()}</span>
                        <span>By {treaty.createdBy.username}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {treaty.chatRoom && (
                        <Button variant="outline" onClick={() => navigate(`/app/treaties/${id}/chat`)}>
                            <MessageSquare className="h-4 w-4 mr-2" /> Treaty Chat
                        </Button>
                    )}
                    {canAdvance && (
                        <Button onClick={() => advanceMut.mutate()} disabled={advanceMut.isPending}>
                            <ArrowRight className="h-4 w-4 mr-2" /> Lock Clauses
                        </Button>
                    )}
                </div>
            </div>

            {/* Accept / Reject / Leave banner */}
            {showAcceptReject && (
                <Card className="glass-card border-orange-500/30">
                    <CardContent className="py-4 flex items-center justify-between">
                        <span className="font-medium">You have been invited to this treaty. Accept, reject, or leave?</span>
                        <div className="flex gap-2">
                            <Button variant="default" onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Accept
                            </Button>
                            <Button variant="destructive" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                                <XCircle className="h-4 w-4 mr-2" /> Reject
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Leave buttons (LOCKED only, separate from accept/reject) */}
            {treaty.status === TreatyStatus.LOCKED && (canLeaveUser || canLeaveRoom) && !showAcceptReject && (
                <Card className="glass-card border-yellow-500/30">
                    <CardContent className="py-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Treaty is locked. You can leave before it activates.</span>
                        <div className="flex gap-2">
                            {canLeaveUser && (
                                <Button variant="outline" size="sm" onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}>
                                    <LogOut className="h-3.5 w-3.5 mr-1" /> Leave (me)
                                </Button>
                            )}
                            {canLeaveRoom && myActiveRoomParticipant?.roomId && (
                                <Button variant="outline" size="sm" onClick={() => leaveRoomMut.mutate(myActiveRoomParticipant.roomId!)} disabled={leaveRoomMut.isPending}>
                                    <LogOut className="h-3.5 w-3.5 mr-1" /> Leave Room {myActiveRoomParticipant.room?.roomNumber}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b pb-2">
                {(['clauses', 'participants', ...(treaty.type === TreatyType.EXCHANGE ? ['exchanges'] as const : []), 'breaches'] as const).map((t) => (
                    <Button
                        key={t}
                        variant={tab === t ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTab(t as any)}
                        className="capitalize"
                    >
                        {t}
                    </Button>
                ))}
            </div>

            {/* ─── Clauses Tab ─────────────────────────────────────── */}
            {tab === 'clauses' && (
                <div className="space-y-3">
                    {treaty.clauses.length === 0 && (
                        <p className="text-muted-foreground text-sm">No clauses yet.</p>
                    )}
                    {treaty.clauses.map((c, i) => (
                        <Card key={c.id} className="glass-card">
                            <CardContent className="py-3">
                                {editingClauseId === c.id ? (
                                    <div className="flex gap-2">
                                        <Input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="flex-1" />
                                        <Button size="sm" onClick={() => updateClauseMut.mutate({ clauseId: c.id, content: editContent })}>Save</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingClauseId(null)}>Cancel</Button>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-xs text-muted-foreground mr-2">§{i + 1}</span>
                                            <span>{c.content}</span>
                                            <span className="text-xs text-muted-foreground ml-2">— {c.createdBy.username}</span>
                                        </div>
                                        {canEditClauses && (
                                            <div className="flex gap-1 shrink-0 ml-4">
                                                <Button size="sm" variant="ghost" onClick={() => { setEditingClauseId(c.id); setEditContent(c.content); }}>
                                                    Edit
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => deleteClauseMut.mutate(c.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                    {canEditClauses && (
                        <div className="flex gap-2">
                            <Input value={clauseContent} onChange={(e) => setClauseContent(e.target.value)} placeholder="New clause text..." className="flex-1" />
                            <Button onClick={() => addClauseMut.mutate()} disabled={!clauseContent || addClauseMut.isPending}>
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Participants Tab ────────────────────────────────── */}
            {tab === 'participants' && (
                <div className="space-y-4">
                    {/* PM add controls */}
                    {canManageParticipants && (
                        <Card className="glass-card border-primary/30">
                            <CardContent className="py-4 space-y-3">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <UserPlus className="h-4 w-4" /> Add Participants
                                </h3>

                                {/* ── Room combobox ── */}
                                <div className="flex items-center gap-2">
                                    <Popover open={roomPopoverOpen} onOpenChange={setRoomPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={roomPopoverOpen}
                                                className="flex-1 justify-between font-normal"
                                                disabled={addRoomMut.isPending}
                                            >
                                                <span className="flex items-center gap-2 text-muted-foreground">
                                                    <Home className="h-3.5 w-3.5" /> Search rooms…
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[340px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search by room number…" />
                                                <CommandList>
                                                    <CommandEmpty>No rooms found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {availableRooms.map((r: RoomListItem) => (
                                                            <CommandItem
                                                                key={r.id}
                                                                value={`${r.roomNumber} ${r.department.name}`}
                                                                onSelect={() => addRoomMut.mutate(r.id)}
                                                            >
                                                                <Home className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                                <span>Room {r.roomNumber}</span>
                                                                <span className="ml-auto text-xs text-muted-foreground">{r.department.name}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* ── User combobox ── */}
                                <div className="flex items-center gap-2">
                                    <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={userPopoverOpen}
                                                className="flex-1 justify-between font-normal"
                                                disabled={addUserMut.isPending}
                                            >
                                                <span className="flex items-center gap-2 text-muted-foreground">
                                                    <UserPlus className="h-3.5 w-3.5" /> Search users…
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[340px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search by username…" />
                                                <CommandList>
                                                    <CommandEmpty>No users found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {candidateUsers.map((u) => (
                                                            <CommandItem
                                                                key={u.id}
                                                                value={`${u.username} ${u.email}`}
                                                                onSelect={() => addUserMut.mutate(u.id)}
                                                            >
                                                                <UserPlus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                                <span>{u.username}</span>
                                                                <span className="ml-auto text-xs text-muted-foreground">{u.email}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Participant list */}
                    {treaty.participants.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No participants added yet. Add rooms or users above.</p>
                    ) : (
                        treaty.participants.map((p) => (
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
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => p.type === 'ROOM' && p.roomId
                                                    ? removeRoomMut.mutate(p.roomId)
                                                    : p.userId && removeUserMut.mutate(p.userId)
                                                }
                                            >
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

            {/* ─── Exchanges Tab ───────────────────────────────────── */}
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
                                    <Input placeholder="Title" value={exTitle} onChange={(e) => setExTitle(e.target.value)} />
                                    <Textarea placeholder="Description (optional)" value={exDesc} onChange={(e) => setExDesc(e.target.value)} />
                                    <Select value={exType} onValueChange={(v) => setExType(v as ExchangeType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ExchangeType.TASK_FOR_BOUNTY}>Task for Bounty</SelectItem>
                                            <SelectItem value={ExchangeType.NOTES_OR_RESOURCES_FOR_BOUNTY}>Notes/Resources for Bounty</SelectItem>
                                            <SelectItem value={ExchangeType.ITEMS_FOR_BOUNTY}>Items for Bounty</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Bounty (credits)" value={exBounty} onChange={(e) => setExBounty(e.target.value)} />
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
                                        {ex.status === ExchangeStatus.OPEN && ex.buyer.id !== user?.id && !user?.isJailed && (
                                            <Button size="sm" onClick={() => acceptExMut.mutate(ex.id)} disabled={acceptExMut.isPending}>
                                                <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Accept
                                            </Button>
                                        )}
                                        {ex.status === ExchangeStatus.OPEN && ex.buyer.id !== user?.id && user?.isJailed && (
                                            <span className="text-xs text-red-400">🔒 Jailed — cannot accept</span>
                                        )}
                                        {ex.status === ExchangeStatus.ACCEPTED && ex.seller?.id === user?.id && (
                                            <div className="flex gap-2 items-center">
                                                <Input placeholder="Delivery notes..." value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} className="w-56" />
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

            {/* ─── Breach Cases Tab ────────────────────────────────── */}
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
                                    <Input placeholder="Title" value={brTitle} onChange={(e) => setBrTitle(e.target.value)} />
                                    <Textarea placeholder="Description" value={brDesc} onChange={(e) => setBrDesc(e.target.value)} />
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Accused user:</label>
                                        <Popover open={brAccusedPopoverOpen} onOpenChange={setBrAccusedPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={brAccusedPopoverOpen}
                                                    className="w-full justify-between font-normal"
                                                >
                                                    {brAccused
                                                        ? (() => {
                                                            const u = stakeholders.find((uu) => uu.id === brAccused);
                                                            return u ? `👤 ${u.username}` : brAccused;
                                                        })()
                                                        : <span className="text-muted-foreground">Search accused user…</span>
                                                    }
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search by username…" />
                                                    <CommandList>
                                                        <CommandEmpty>{stakeholdersLoading ? 'Loading…' : 'No users found.'}</CommandEmpty>
                                                        <CommandGroup>
                                                            {stakeholders
                                                                .filter((u) => u.id !== user?.id)
                                                                .map((u) => (
                                                                    <CommandItem
                                                                        key={u.id}
                                                                        value={`${u.username} ${u.email}`}
                                                                        onSelect={() => {
                                                                            setBrAccused(u.id);
                                                                            setBrAccusedPopoverOpen(false);
                                                                        }}
                                                                    >
                                                                        <UserPlus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                                        <span>{u.username}</span>
                                                                        <span className="ml-auto text-xs text-muted-foreground">{u.email}</span>
                                                                    </CommandItem>
                                                                ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Select violated clauses:</label>
                                        <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                                            {treaty.clauses.map((c) => (
                                                <label key={c.id} className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={brClauses.includes(c.id)}
                                                        onChange={(e) => {
                                                            setBrClauses((prev) =>
                                                                e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                                                            );
                                                        }}
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
                        breaches.map((bc: BreachCase) => (
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
                                        <p>Violated: {bc.clauses.map((c) => c.clause.content).join('; ')}</p>
                                    </div>

                                    {/* Chat link */}
                                    {bc.chatRoom && (
                                        <Button variant="outline" size="sm" onClick={() => navigate(`/app/treaties/${id}/breaches/${bc.id}/chat`)}>
                                            <MessageSquare className="h-4 w-4 mr-1" /> Case Chat
                                        </Button>
                                    )}

                                    {/* PM: Start Evaluation (OPEN only) */}
                                    {isPM && bc.status === BreachCaseStatus.OPEN && (
                                        <Button size="sm" onClick={() => startEvalMut.mutate(bc.id)} disabled={startEvalMut.isPending}>
                                            Start Evaluation
                                        </Button>
                                    )}

                                    {/* PM: Ruling panel (IN_REVIEW only) */}
                                    {isPM && bc.status === BreachCaseStatus.IN_REVIEW && (
                                        <div className="border border-border rounded-lg p-3 space-y-2">
                                            <p className="text-sm font-medium">Issue Ruling</p>
                                            <Select value={rulingType} onValueChange={(v) => setRulingType(v as BreachRulingType)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="AGAINST_ACCUSED">Against Accused ({bc.accusedUser.username})</SelectItem>
                                                    <SelectItem value="AGAINST_ACCUSER">Against Accuser ({bc.filer.username})</SelectItem>
                                                    <SelectItem value="NONE">Dismiss</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {rulingType !== BreachRulingType.NONE && (
                                                <>
                                                    <Select value={penaltyMode} onValueChange={(v) => setPenaltyMode(v as BreachPenaltyMode)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="BOTH_MANDATORY">Both Mandatory</SelectItem>
                                                            <SelectItem value="EITHER_CHOICE">Criminal Chooses</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex gap-2">
                                                        <Input type="number" placeholder="Social penalty" value={socialPen} onChange={(e) => setSocialPen(e.target.value)} />
                                                        <Input type="number" placeholder="Credit fine" value={creditFine} onChange={(e) => setCreditFine(e.target.value)} />
                                                    </div>
                                                </>
                                            )}
                                            <Textarea placeholder="Resolution note..." value={rulingNote} onChange={(e) => setRulingNote(e.target.value)} rows={2} />
                                            <Button size="sm" onClick={() => ruleBreachMut.mutate(bc.id)} disabled={ruleBreachMut.isPending}>
                                                Submit Ruling
                                            </Button>
                                        </div>
                                    )}

                                    {/* Criminal chooses penalty */}
                                    {bc.status === BreachCaseStatus.AWAITING_CRIMINAL_CHOICE && bc.rulingTargetUserId === user?.id && (
                                        <div className="border border-amber-500/30 rounded-lg p-3 space-y-2">
                                            <p className="text-sm font-medium text-amber-300">Choose your penalty:</p>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => choosePenaltyMut.mutate({ bid: bc.id, choice: 'SOCIAL' })} disabled={choosePenaltyMut.isPending}>
                                                    Social Credit: -{bc.socialPenalty}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => choosePenaltyMut.mutate({ bid: bc.id, choice: 'CREDITS' })} disabled={choosePenaltyMut.isPending}>
                                                    Credits Fine: -{bc.creditFine}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* B1: PM compensation button */}
                                    {isPM && (bc.status === BreachCaseStatus.IN_REVIEW || bc.status === BreachCaseStatus.RESOLVED) && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                                            onClick={async () => {
                                                setCompBid(bc.id);
                                                try {
                                                    const members = await treatiesApi.getBreachChatMembers(id!, bc.id);
                                                    setCompEntries(
                                                        members
                                                            .filter((m: any) => m.userId !== user?.id)
                                                            .map((m: any) => ({ userId: m.userId, username: m.user?.username ?? m.userId, amount: 0 }))
                                                    );
                                                } catch {
                                                    setCompEntries([]);
                                                }
                                                setCompNote('');
                                                setCompOpen(true);
                                            }}
                                        >
                                            💰 Compensate Members
                                        </Button>
                                    )}


                                    {/* Resolved summary */}
                                    {bc.status === BreachCaseStatus.RESOLVED && bc.rulingType && (
                                        <div className="text-sm text-muted-foreground border-t border-border pt-2 mt-2">
                                            <p><strong>Ruling:</strong> {bc.rulingType.replace(/_/g, ' ')}{bc.rulingTarget ? ` (${bc.rulingTarget.username})` : ''}</p>
                                            {bc.penaltyMode && bc.penaltyMode !== 'NONE' && (
                                                <p className="text-xs">
                                                    Penalty: {bc.penaltyMode.replace(/_/g, ' ')}
                                                    {bc.socialPenalty ? ` | Social: -${bc.socialPenalty}` : ''}
                                                    {bc.creditFine ? ` | Credits: -${bc.creditFine}` : ''}
                                                    {bc.criminalChoice ? ` | Chose: ${bc.criminalChoice}` : ''}
                                                </p>
                                            )}
                                            {bc.resolutionNote && <p><strong>Note:</strong> {bc.resolutionNote}</p>}
                                            {bc.resolvedBy && <p className="text-xs">Resolved by {bc.resolvedBy.username}</p>}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* B1: Compensation Dialog */}
            <Dialog open={compOpen} onOpenChange={setCompOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Compensate Breach Members</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                        {compEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No eligible members found.</p>
                        ) : (
                            compEntries.map((entry, idx) => (
                                <div key={entry.userId} className="flex items-center gap-3">
                                    <span className="text-sm font-medium flex-1">👤 {entry.username}</span>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="Amount"
                                        className="w-28"
                                        value={entry.amount || ''}
                                        onChange={(e) => {
                                            const val = Math.max(0, Number(e.target.value));
                                            setCompEntries(prev => prev.map((en, i) => i === idx ? { ...en, amount: val } : en));
                                        }}
                                    />
                                </div>
                            ))
                        )}
                        <Input
                            placeholder="Note (optional)"
                            value={compNote}
                            onChange={(e) => setCompNote(e.target.value)}
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Total: {compEntries.reduce((s, e) => s + e.amount, 0)} credits from dept treasury
                            </span>
                            <Button
                                size="sm"
                                onClick={() => compensateBreachMut.mutate()}
                                disabled={compensateBreachMut.isPending || compEntries.every(e => e.amount <= 0)}
                            >
                                {compensateBreachMut.isPending ? 'Sending...' : 'Send Compensations'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
