import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { treatiesApi } from '@/api/treaties';
import { interDeptTreatiesApi } from '@/api/interDeptTreaties';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Treaty, TreatyStatus, TreatyType, InterDeptTreaty, TreatyDepartmentStatus } from '@/types';
import { Handshake, Plus, Clock, Users, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TreatyList() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // ─── Dept-scope treaty create modal ─────────────────────────
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [type, setType] = useState<TreatyType>(TreatyType.NON_EXCHANGE);
    const [endsAt, setEndsAt] = useState('');

    // ─── Inter-dept treaty create modal ─────────────────────────
    const [idOpen, setIdOpen] = useState(false);
    const [idTitle, setIdTitle] = useState('');
    const [idType, setIdType] = useState<TreatyType>(TreatyType.NON_EXCHANGE);
    const [idEndsAt, setIdEndsAt] = useState('');
    const [idSelectedDepts, setIdSelectedDepts] = useState<string[]>([]);

    const { data: treaties = [], isLoading } = useQuery({
        queryKey: ['treaties'],
        queryFn: () => treatiesApi.list(),
    });

    const { data: interDeptTreaties = [], isLoading: idLoading } = useQuery({
        queryKey: ['inter-dept-treaties'],
        queryFn: () => interDeptTreatiesApi.list(),
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['inter-dept-departments'],
        queryFn: () => interDeptTreatiesApi.listDepartments(),
        enabled: idOpen,
    });

    const createMutation = useMutation({
        mutationFn: () => treatiesApi.create({ title, type, endsAt }),
        onSuccess: (t) => {
            queryClient.invalidateQueries({ queryKey: ['treaties'] });
            toast({ title: 'Treaty created', description: `"${t.title}" is now in NEGOTIATION.` });
            setOpen(false);
            setTitle('');
            setEndsAt('');
            navigate(`/app/treaties/${t.id}`);
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const createIdMutation = useMutation({
        mutationFn: () => interDeptTreatiesApi.create({ title: idTitle, type: idType, endsAt: idEndsAt, departmentIds: idSelectedDepts }),
        onSuccess: (t) => {
            queryClient.invalidateQueries({ queryKey: ['inter-dept-treaties'] });
            toast({ title: 'Inter-Dept Treaty created', description: `"${t.title}" is now in NEGOTIATION.` });
            setIdOpen(false);
            setIdTitle('');
            setIdEndsAt('');
            setIdSelectedDepts([]);
            navigate(`/app/inter-dept-treaties/${t.id}`);
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const statusColor = (s: TreatyStatus) => {
        switch (s) {
            case TreatyStatus.NEGOTIATION: return 'bg-blue-500/20 text-blue-300';
            case TreatyStatus.LOCKED: return 'bg-yellow-500/20 text-yellow-300';
            case TreatyStatus.ACTIVE: return 'bg-green-500/20 text-green-300';
            case TreatyStatus.EXPIRED: return 'bg-red-500/20 text-red-300';
        }
    };

    const toggleDeptSelection = (deptId: string) => {
        setIdSelectedDepts(prev =>
            prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION A: DEPARTMENT TREATIES                     */}
            {/* ═══════════════════════════════════════════════════ */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Handshake className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold">Department Treaties</h1>
                    </div>
                    {user?.isPrimeMinister && (
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" /> New Treaty
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Treaty</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <label className="text-sm font-medium">Title</label>
                                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Treaty title" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Type</label>
                                        <Select value={type} onValueChange={(v) => setType(v as TreatyType)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={TreatyType.NON_EXCHANGE}>Non-Exchange</SelectItem>
                                                <SelectItem value={TreatyType.EXCHANGE}>Exchange</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Ends At</label>
                                        <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                                    </div>
                                    <Button
                                        className="w-full"
                                        onClick={() => createMutation.mutate()}
                                        disabled={!title || !endsAt || createMutation.isPending}
                                    >
                                        {createMutation.isPending ? 'Creating...' : 'Create Treaty'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {isLoading ? (
                    <p className="text-muted-foreground">Loading treaties...</p>
                ) : treaties.length === 0 ? (
                    <Card className="glass-card">
                        <CardContent className="py-8 text-center">
                            <Handshake className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No department treaties yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {treaties.map((t: Treaty) => (
                            <Card
                                key={t.id}
                                className="glass-card cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => navigate(`/app/treaties/${t.id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{t.title}</CardTitle>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                                            {t.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5" />
                                            {t.participants.filter((p) => p.status !== 'REJECTED' && p.status !== 'LEFT').length} participants
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            Ends {new Date(t.endsAt).toLocaleDateString()}
                                        </span>
                                        <span>Type: {t.type === TreatyType.EXCHANGE ? 'Exchange' : 'Non-Exchange'}</span>
                                        <span>By {t.createdBy.username}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION B: INTER-DEPARTMENT TREATIES               */}
            {/* ═══════════════════════════════════════════════════ */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Globe className="h-7 w-7 text-emerald-400" />
                        <h1 className="text-2xl font-bold">Inter-Department Treaties</h1>
                    </div>
                    {user?.isForeignMinister && (
                        <Dialog open={idOpen} onOpenChange={setIdOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                                    <Plus className="h-4 w-4 mr-2" /> New Inter-Dept Treaty
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Create Inter-Department Treaty</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <label className="text-sm font-medium">Title</label>
                                        <Input value={idTitle} onChange={(e) => setIdTitle(e.target.value)} placeholder="Treaty title" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Type</label>
                                        <Select value={idType} onValueChange={(v) => setIdType(v as TreatyType)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={TreatyType.NON_EXCHANGE}>Non-Exchange</SelectItem>
                                                <SelectItem value={TreatyType.EXCHANGE}>Exchange</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Ends At</label>
                                        <Input type="datetime-local" value={idEndsAt} onChange={(e) => setIdEndsAt(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Invite Departments</label>
                                        <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                                            {departments.map((d) => (
                                                <label key={d.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={idSelectedDepts.includes(d.id)}
                                                        onChange={() => toggleDeptSelection(d.id)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm">{d.name}</span>
                                                    {d.foreignMinister && (
                                                        <span className="text-xs text-muted-foreground ml-auto">FM: {d.foreignMinister.username}</span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full"
                                        onClick={() => createIdMutation.mutate()}
                                        disabled={!idTitle || !idEndsAt || idSelectedDepts.length === 0 || createIdMutation.isPending}
                                    >
                                        {createIdMutation.isPending ? 'Creating...' : 'Create Inter-Dept Treaty'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {idLoading ? (
                    <p className="text-muted-foreground">Loading inter-dept treaties...</p>
                ) : interDeptTreaties.length === 0 ? (
                    <Card className="glass-card">
                        <CardContent className="py-8 text-center">
                            <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No inter-department treaties yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {interDeptTreaties.map((t: InterDeptTreaty) => (
                            <Card
                                key={t.id}
                                className="glass-card cursor-pointer hover:border-emerald-500/50 transition-colors border-l-2 border-l-emerald-500/40"
                                onClick={() => navigate(`/app/inter-dept-treaties/${t.id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-emerald-400" />
                                            <CardTitle className="text-lg">{t.title}</CardTitle>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                                            {t.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5" />
                                            {t.treatyDepartments.filter(d => d.status === TreatyDepartmentStatus.ACCEPTED).length} depts
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            Ends {new Date(t.endsAt).toLocaleDateString()}
                                        </span>
                                        <span>Host: {t.department.name}</span>
                                        <span>By {t.createdBy.username}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
