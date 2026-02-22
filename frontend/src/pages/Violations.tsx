import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    Clock,
    Gavel,
    MessageSquare,
    Plus,
    Shield,
    ShieldCheck,
    ShieldX,
    Timer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { violationsApi } from "@/api/violations";
import { useAuth } from "@/contexts/AuthContext";
import { CreateViolationModal } from "@/components/modals/CreateViolationModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ViolationStatusEnum, ViolationPenaltyMode, type Violation } from "@/types";

const ALL_VALUE = "__all__";
const ALL_STATUS = "__all_status__";

function statusBadge(status: ViolationStatusEnum | string) {
    const map: Record<string, { label: string; color: string; Icon: typeof AlertTriangle }> = {
        ACTIVE: { label: "Active", color: "bg-red-500/15 text-red-400", Icon: AlertTriangle },
        APPEALED: { label: "Appealed", color: "bg-amber-500/15 text-amber-400", Icon: Gavel },
        IN_EVALUATION: { label: "Evaluating", color: "bg-blue-500/15 text-blue-400", Icon: MessageSquare },
        CLOSED_UPHELD: { label: "Upheld", color: "bg-red-500/15 text-red-400", Icon: ShieldCheck },
        CLOSED_OVERTURNED: { label: "Overturned", color: "bg-green-500/15 text-green-400", Icon: ShieldX },
        EXPIRED: { label: "Expired", color: "bg-gray-500/15 text-gray-400", Icon: Timer },
    };
    const m = map[status as string] ?? { label: status, color: "bg-gray-500/15 text-gray-400", Icon: Shield };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.color}`}>
            <m.Icon className="h-3 w-3" />
            {m.label}
        </span>
    );
}

export default function Violations() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filterUser, setFilterUser] = useState(ALL_VALUE);
    const [filterStatus, setFilterStatus] = useState(ALL_STATUS);
    const [modalOpen, setModalOpen] = useState(false);

    const isMayor = user?.role === "MAYOR" || user?.role === "ADMIN";

    const {
        data: violations = [],
        isLoading,
        refetch,
        error,
    } = useQuery({
        queryKey: [
            "violations",
            filterUser === ALL_VALUE ? undefined : filterUser,
            filterStatus === ALL_STATUS ? undefined : filterStatus,
        ],
        queryFn: () =>
            violationsApi.list(
                filterUser === ALL_VALUE ? undefined : filterUser,
                filterStatus === ALL_STATUS ? undefined : filterStatus,
            ),
    });

    const {
        data: invitedCases = [],
        isLoading: isLoadingInvited,
    } = useQuery({
        queryKey: ["violations", "invited"],
        queryFn: () => violationsApi.getInvited(),
    });

    const appealMutation = useMutation({
        mutationFn: (id: string) => violationsApi.appeal(id),
        onSuccess: () => {
            toast({ title: "Appealed", description: "Violation appealed. The PM will review it." });
            refetch();
        },
        onError: (e) => {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed" });
        },
    });

    const choosePenaltyMutation = useMutation({
        mutationFn: ({ id, choice }: { id: string; choice: 'CREDITS' | 'SOCIAL_SCORE' }) =>
            violationsApi.choosePenalty(id, choice),
        onSuccess: () => {
            toast({ title: "Penalty applied", description: "Your chosen penalty has been applied." });
            refetch();
        },
        onError: (e) => {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed" });
        },
    });

    const roommates = useMemo(() => {
        if (!user?.room?.users) return [];
        return user.room.users
            .filter((u) => u.id !== user.id)
            .sort((a, b) => a.username.localeCompare(b.username));
    }, [user]);

    const allRoommates = useMemo(() => {
        if (!user?.room?.users) return [];
        return [...user.room.users].sort((a, b) => a.username.localeCompare(b.username));
    }, [user]);

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const errorMessage = error instanceof Error ? error.message : "";

    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-5xl space-y-6"
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Violations</h1>
                        <p className="text-muted-foreground">View violations in your room.</p>
                    </div>
                    <div className="flex gap-2">
                        {isMayor && (
                            <Button onClick={() => setModalOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Violation
                            </Button>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="room" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="room">Room Violations</TabsTrigger>
                        <TabsTrigger value="invited">Invited Cases</TabsTrigger>
                    </TabsList>

                    <TabsContent value="room" className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="w-full sm:w-64">
                                <Select value={filterUser} onValueChange={setFilterUser}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by roommate" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL_VALUE}>All roommates</SelectItem>
                                        {allRoommates.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full sm:w-64">
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
                                        {Object.values(ViolationStatusEnum).map((s) => (
                                            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Content */}
                        {errorMessage ? (
                            <Card className="glass-card">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    Error: {errorMessage}
                                </CardContent>
                            </Card>
                        ) : isLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            </div>
                        ) : violations.length === 0 ? (
                            <Card className="glass-card">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    No violations found.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {violations.map((v: Violation) => (
                                    <Card key={v.id} className="glass-card hover-lift">
                                        <CardContent className="py-4 space-y-2">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                                    <span className="font-semibold">{v.title}</span>
                                                    {statusBadge(v.status)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-destructive">−{v.points} pts</span>
                                                    {v.creditFine > 0 && (
                                                        <span className="text-sm font-bold text-amber-400">−{v.creditFine} cr</span>
                                                    )}
                                                    {v.penaltyMode === ViolationPenaltyMode.EITHER_CHOICE && (
                                                        <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                                                            Choice
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {v.description && (
                                                <p className="text-sm text-muted-foreground pl-6">{v.description}</p>
                                            )}

                                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pl-6">
                                                <span>Offender: <span className="font-medium text-foreground">{v.offender.username}</span></span>
                                                <span>Issued by: <span className="font-medium text-foreground">{v.createdBy.username}</span></span>
                                                <span>{formatDate(v.createdAt)}</span>
                                                {v.expiresAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Expires: {formatDate(v.expiresAt)}
                                                    </span>
                                                )}
                                                {v.pointsRefunded > 0 && (
                                                    <span className="text-green-400">+{v.pointsRefunded} pts refunded</span>
                                                )}
                                                {v.creditsRefunded > 0 && (
                                                    <span className="text-green-400">+{v.creditsRefunded} cr refunded</span>
                                                )}
                                                {v.creditsDeducted > 0 && !v.creditsRefunded && (
                                                    <span className="text-amber-400">−{v.creditsDeducted} cr deducted</span>
                                                )}
                                                {v.offenderChoice && (
                                                    <span className="text-indigo-400">
                                                        Chose: {v.offenderChoice === 'CREDITS' ? 'Credits' : 'Social Score'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Verdict info */}
                                            {v.verdict && (
                                                <div className="pl-6 text-sm">
                                                    <span className="font-medium">Verdict: </span>
                                                    <span className={v.verdict === "UPHELD" ? "text-red-400" : "text-green-400"}>
                                                        {v.verdict.replace(/_/g, " ")}
                                                    </span>
                                                    {v.verdictNote && <span className="text-muted-foreground"> — {v.verdictNote}</span>}
                                                </div>
                                            )}

                                            {/* Defence/Action section */}
                                            <div className="flex gap-2 pl-6 pt-1">
                                                {/* Appeal button: only for offender, only when ACTIVE */}
                                                {v.status === "ACTIVE" && v.offender.id === user?.id && v.penaltyMode !== ViolationPenaltyMode.EITHER_CHOICE && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => appealMutation.mutate(v.id)}
                                                        disabled={appealMutation.isPending}
                                                    >
                                                        <Gavel className="mr-1 h-3 w-3" />
                                                        Appeal
                                                    </Button>
                                                )}

                                                {/* D2: Choose penalty for EITHER_CHOICE violations */}
                                                {v.status === "ACTIVE" && v.offender.id === user?.id &&
                                                    v.penaltyMode === ViolationPenaltyMode.EITHER_CHOICE && !v.offenderChoice && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => choosePenaltyMutation.mutate({ id: v.id, choice: 'SOCIAL_SCORE' })}
                                                                disabled={choosePenaltyMutation.isPending}
                                                            >
                                                                Pay {v.points} pts
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                                                onClick={() => choosePenaltyMutation.mutate({ id: v.id, choice: 'CREDITS' })}
                                                                disabled={choosePenaltyMutation.isPending}
                                                            >
                                                                Pay {v.creditFine} cr
                                                            </Button>
                                                        </>
                                                    )}

                                                {/* Enter case chat: when evaluation exists */}
                                                {v.chatRoom && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => navigate(`/app/violations/${v.id}/chat`)}
                                                    >
                                                        <MessageSquare className="mr-1 h-3 w-3" />
                                                        {v.chatRoom.closedAt ? "View Chat" : "Enter Chat"}
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="invited" className="space-y-6">
                        {isLoadingInvited ? (
                            <div className="flex justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            </div>
                        ) : invitedCases.length === 0 ? (
                            <Card className="glass-card">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    No invited cases found.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {invitedCases.map((v: any) => (
                                    <Card key={v.id} className="glass-card hover-lift">
                                        <CardContent className="py-4 space-y-2">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                                    <span className="font-semibold">{v.title}</span>
                                                    {statusBadge(v.status)}
                                                </div>
                                                <span className="text-sm font-bold text-destructive">−{v.points} pts</span>
                                            </div>

                                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pl-6">
                                                <span>Offender: <span className="font-medium text-foreground">{v.offender.username}</span></span>
                                                <span>Department/Room: <span className="font-medium text-foreground">{v.room?.department?.name} / Room {v.room?.roomNumber}</span></span>
                                                {v.evaluationStartedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Evaluating since: {formatDate(v.evaluationStartedAt)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex gap-2 pl-6 pt-1">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => navigate(`/app/violations/${v.id}/chat`)}
                                                >
                                                    <MessageSquare className="mr-1 h-3 w-3" />
                                                    Enter Chat
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {isMayor && (
                    <CreateViolationModal
                        open={modalOpen}
                        onOpenChange={setModalOpen}
                        roommates={roommates}
                        onSuccess={() => refetch()}
                    />
                )}
            </motion.div>
        </div>
    );
}
