import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { electionsApi } from '@/api/elections';
import { departmentsApi } from '@/api/departments';
import { Election, ElectionStatus, ElectionType, Department, ElectionCandidate } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
    Vote,
    Crown,
    Trophy,
    Clock,
    Users,
    AlertTriangle,
    CheckCircle2,
    Search,
} from 'lucide-react';

// ───────────────────────────────────────────────────────────────
// Helper Components
// ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ElectionStatus }) {
    const map: Record<ElectionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        ACTIVE: { label: 'Active', variant: 'default' },
        COMPLETED: { label: 'Completed', variant: 'secondary' },
        TIE_BREAKING: { label: 'Tie – Admin Decision Needed', variant: 'destructive' },
    };
    const info = map[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
}

function SearchableDropdown({
    items,
    value,
    onChange,
    placeholder,
    renderLabel,
    id,
}: {
    items: { value: string; label: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    renderLabel?: (item: { value: string; label: string }) => string;
    id?: string;
}) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(
        () =>
            items.filter((i) =>
                (renderLabel ? renderLabel(i) : i.label).toLowerCase().includes(search.toLowerCase()),
            ),
        [items, search, renderLabel],
    );

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    className="pl-9"
                    placeholder={`Search ${placeholder}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={id}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {filtered.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">No results</div>
                    )}
                    {filtered.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {renderLabel ? renderLabel(item) : item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function TimeLeft({ deadline }: { deadline: string }) {
    const [, setTick] = useState(0);
    // Re-render every second
    useState(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    });

    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return <span className="text-red-400 font-semibold">Deadline passed</span>;

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return (
        <span className="text-amber-400 font-mono">
            {hours > 0 && `${hours}h `}
            {minutes}m {seconds}s remaining
        </span>
    );
}

// ───────────────────────────────────────────────────────────────
// Main Page
// ───────────────────────────────────────────────────────────────

export default function ElectionPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const isAdmin = user?.role === 'ADMIN';

    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [deadline, setDeadline] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');

    // Data queries
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentsApi.getDepartments,
    });

    const { data: elections = [], isLoading: loadingElections } = useQuery({
        queryKey: ['elections', selectedDeptId, statusFilter],
        queryFn: () =>
            electionsApi.listElections({
                departmentId: selectedDeptId || undefined,
                status: statusFilter || undefined,
            }),
        refetchInterval: 10000, // poll every 10s
    });

    // Mutations
    const createRoomMut = useMutation({
        mutationFn: (data: { roomId: string; deadline: string }) =>
            electionsApi.createRoomElection(data),
        onSuccess: () => {
            toast({ title: 'Room election created!' });
            qc.invalidateQueries({ queryKey: ['elections'] });
            setDeadline('');
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    const createDeptMut = useMutation({
        mutationFn: (data: { departmentId: string; deadline: string }) =>
            electionsApi.createDeptElection(data),
        onSuccess: () => {
            toast({ title: 'Department election created!' });
            qc.invalidateQueries({ queryKey: ['elections'] });
            setDeadline('');
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    // Get rooms for selected dept
    const selectedDept = departments.find((d) => d.id === selectedDeptId);
    const rooms = (selectedDept as any)?.rooms || [];
    const roomItems = rooms.map((r: any) => ({ value: r.id, label: `Room ${r.roomNumber}` }));

    const deptItems = departments.map((d: Department) => ({ value: d.id, label: d.name }));

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Vote className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Elections</h1>
                    <p className="text-muted-foreground">
                        {isAdmin ? 'Create and manage elections across departments' : 'View and participate in elections'}
                    </p>
                </div>
            </div>

            {/* ── Admin: Create Election ──────────────────────────── */}
            {isAdmin && (
                <Card className="glass-card border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Crown className="h-5 w-5 text-amber-400" />
                            Create Election
                        </CardTitle>
                        <CardDescription>
                            Create a room election (mayor) or department election (PM)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <SearchableDropdown
                                    items={deptItems}
                                    value={selectedDeptId}
                                    onChange={(v) => {
                                        setSelectedDeptId(v);
                                        setSelectedRoomId('');
                                    }}
                                    placeholder="Select department"
                                    id="dept-select"
                                />
                            </div>

                            {selectedDeptId && (
                                <div className="space-y-2">
                                    <Label>Room (for mayor election)</Label>
                                    <SearchableDropdown
                                        items={roomItems}
                                        value={selectedRoomId}
                                        onChange={setSelectedRoomId}
                                        placeholder="Select room"
                                        id="room-select"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Deadline</Label>
                            <Input
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                disabled={!selectedRoomId || !deadline || createRoomMut.isPending}
                                onClick={() =>
                                    createRoomMut.mutate({
                                        roomId: selectedRoomId,
                                        deadline: new Date(deadline).toISOString(),
                                    })
                                }
                            >
                                <Vote className="mr-2 h-4 w-4" />
                                {createRoomMut.isPending ? 'Creating...' : 'Create Room Election (Mayor)'}
                            </Button>
                            <Button
                                variant="secondary"
                                disabled={!selectedDeptId || !deadline || createDeptMut.isPending}
                                onClick={() =>
                                    createDeptMut.mutate({
                                        departmentId: selectedDeptId,
                                        deadline: new Date(deadline).toISOString(),
                                    })
                                }
                            >
                                <Crown className="mr-2 h-4 w-4" />
                                {createDeptMut.isPending ? 'Creating...' : 'Create Department Election (PM)'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Filter ──────────────────────────────────────────── */}
            <Card className="glass-card">
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2 min-w-[200px]">
                            <Label>Filter by Department</Label>
                            <SearchableDropdown
                                items={[{ value: '__all__', label: 'All Departments' }, ...deptItems]}
                                value={selectedDeptId || '__all__'}
                                onChange={(v) => setSelectedDeptId(v === '__all__' ? '' : v)}
                                placeholder="Department"
                            />
                        </div>
                        <div className="space-y-2 min-w-[180px]">
                            <Label>Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="TIE_BREAKING">Tie Breaking</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Elections List ──────────────────────────────────── */}
            {loadingElections ? (
                <div className="text-center text-muted-foreground py-12">Loading elections...</div>
            ) : elections.length === 0 ? (
                <Card className="glass-card">
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Vote className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>No elections found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {elections.map((election) => (
                        <ElectionCard key={election.id} election={election} isAdmin={isAdmin} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ───────────────────────────────────────────────────────────────
// Election Card
// ───────────────────────────────────────────────────────────────

function ElectionCard({ election, isAdmin }: { election: Election; isAdmin: boolean }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedCandidate, setSelectedCandidate] = useState('');
    const [tieWinner, setTieWinner] = useState('');

    const hasVoted = election.votes.some((v) => v.voterId === user?.id);
    const isActive = election.status === ElectionStatus.ACTIVE;
    const isTie = election.status === ElectionStatus.TIE_BREAKING;
    const isCompleted = election.status === ElectionStatus.COMPLETED;

    // Check if user can vote
    const canVote = isActive && !hasVoted && user && !user.isJailed;

    // For room elections, user must be in the room
    // For dept elections, user must be a candidate (mayor)
    let isEligibleVoter = false;
    if (election.type === ElectionType.ROOM && user) {
        isEligibleVoter = (user.room?.id === election.roomId);
    } else if (election.type === ElectionType.DEPARTMENT && user) {
        isEligibleVoter = election.candidates.some((c) => c.userId === user.id);
    }

    const voteMut = useMutation({
        mutationFn: () => electionsApi.castVote(election.id, selectedCandidate),
        onSuccess: () => {
            toast({ title: 'Vote cast successfully!' });
            qc.invalidateQueries({ queryKey: ['elections'] });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    const resolveTieMut = useMutation({
        mutationFn: () => electionsApi.resolveTie(election.id, tieWinner),
        onSuccess: () => {
            toast({ title: 'Tie resolved!' });
            qc.invalidateQueries({ queryKey: ['elections'] });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    // Get tied candidates for tie-breaking
    const tiedCandidates = useMemo(() => {
        if (!isTie || election.candidates.length === 0) return [];
        const top = election.candidates[0].totalVotePower;
        return election.candidates.filter((c) => c.totalVotePower === top);
    }, [isTie, election.candidates]);

    // Eligible voters count
    const totalEligible =
        election.type === ElectionType.ROOM
            ? (election as any)?.room?.users?.length || election.candidates.length
            : election.candidates.length;

    const candidateItems = election.candidates.map((c) => ({
        value: c.id,
        label: `${c.user.username}${c.user.socialScore ? ` (Score: ${c.user.socialScore})` : ''}`,
    }));

    const tiedItems = tiedCandidates.map((c) => ({
        value: c.userId,
        label: `${c.user.username} (${c.totalVotePower} votes)`,
    }));

    const typeLabel = election.type === ElectionType.ROOM ? 'Mayor Election' : 'PM Election';
    const locationLabel =
        election.type === ElectionType.ROOM
            ? `Room ${election.room?.roomNumber || '?'} – ${election.room?.department?.name || ''}`
            : election.department?.name || '';

    return (
        <Card className="glass-card border-l-4 border-l-primary/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        {election.type === ElectionType.ROOM ? (
                            <Users className="h-5 w-5 text-blue-400" />
                        ) : (
                            <Crown className="h-5 w-5 text-amber-400" />
                        )}
                        <div>
                            <CardTitle className="text-lg">{typeLabel}</CardTitle>
                            <CardDescription>{locationLabel}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusBadge status={election.status} />
                        {isActive && (
                            <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-4 w-4" />
                                <TimeLeft deadline={election.deadline} />
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Vote Progress */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                        {election.votes.length} of {totalEligible} voted
                    </span>
                    {hasVoted && (
                        <Badge variant="outline" className="text-green-400 border-green-400/40">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            You voted
                        </Badge>
                    )}
                </div>

                {/* Candidates & Results */}
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Candidates</h4>
                    <div className="grid gap-2">
                        {election.candidates.map((c) => (
                            <CandidateRow
                                key={c.id}
                                candidate={c}
                                isWinner={election.winnerId === c.userId}
                                totalVotes={election.votes.reduce((a, v) => a + v.votePower, 0)}
                                showResults={isCompleted || isTie}
                            />
                        ))}
                    </div>
                </div>

                {/* Winner */}
                {isCompleted && election.winner && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Trophy className="h-5 w-5 text-amber-400" />
                        <span className="font-semibold text-amber-300">
                            Winner: {election.winner.username}
                        </span>
                    </div>
                )}

                {/* ── Voting Section ──────────────────────────────── */}
                {canVote && isEligibleVoter && (
                    <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <h4 className="font-semibold flex items-center gap-2">
                            <Vote className="h-4 w-4" />
                            Cast Your Vote
                        </h4>
                        <SearchableDropdown
                            items={candidateItems}
                            value={selectedCandidate}
                            onChange={setSelectedCandidate}
                            placeholder="Select a candidate"
                        />
                        <Button
                            disabled={!selectedCandidate || voteMut.isPending}
                            onClick={() => voteMut.mutate()}
                        >
                            {voteMut.isPending ? 'Voting...' : 'Submit Vote'}
                        </Button>
                    </div>
                )}

                {/* ── Tie Resolution (Admin) ──────────────────────── */}
                {isTie && isAdmin && (
                    <div className="space-y-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <h4 className="font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            Tie Resolution Required
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            The following candidates are tied. Select the winner:
                        </p>
                        <SearchableDropdown
                            items={tiedItems}
                            value={tieWinner}
                            onChange={setTieWinner}
                            placeholder="Select winner"
                        />
                        <Button
                            variant="destructive"
                            disabled={!tieWinner || resolveTieMut.isPending}
                            onClick={() => resolveTieMut.mutate()}
                        >
                            {resolveTieMut.isPending ? 'Resolving...' : 'Confirm Winner'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ───────────────────────────────────────────────────────────────
// Candidate Row
// ───────────────────────────────────────────────────────────────

function CandidateRow({
    candidate,
    isWinner,
    totalVotes,
    showResults,
}: {
    candidate: ElectionCandidate;
    isWinner: boolean;
    totalVotes: number;
    showResults: boolean;
}) {
    const pct = totalVotes > 0 ? Math.round((candidate.totalVotePower / totalVotes) * 100) : 0;

    return (
        <div
            className={`flex items-center justify-between p-2 rounded-md transition-colors ${isWinner
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-secondary/30 border border-transparent'
                }`}
        >
            <div className="flex items-center gap-2">
                {isWinner && <Trophy className="h-4 w-4 text-amber-400" />}
                <span className={isWinner ? 'font-semibold text-amber-300' : ''}>
                    {candidate.user.username}
                </span>
            </div>
            {showResults && (
                <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="text-sm text-muted-foreground w-16 text-right">
                        {candidate.totalVotePower} ({pct}%)
                    </span>
                </div>
            )}
        </div>
    );
}
