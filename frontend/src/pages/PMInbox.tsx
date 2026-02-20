import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    Banknote,
    Clock,
    DollarSign,
    Gavel,
    MessageSquare,
    Play,
    Scale,
    Send,
    Shield,
    ShieldCheck,
    ShieldX,
    Star,
    Timer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { violationsApi } from "@/api/violations";
import { financeApi } from "@/api/finance";
import { CloseEvaluationModal } from "@/components/modals/CloseEvaluationModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ViolationStatusEnum, type Violation, type SocialScorePurchaseRequest } from "@/types";

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof AlertTriangle }> = {
    ACTIVE: { label: "Active", color: "bg-red-500/15 text-red-400", Icon: AlertTriangle },
    APPEALED: { label: "Appealed", color: "bg-amber-500/15 text-amber-400", Icon: Gavel },
    IN_EVALUATION: { label: "In Evaluation", color: "bg-blue-500/15 text-blue-400", Icon: MessageSquare },
    CLOSED_UPHELD: { label: "Upheld", color: "bg-red-500/15 text-red-400", Icon: ShieldCheck },
    CLOSED_OVERTURNED: { label: "Overturned", color: "bg-green-500/15 text-green-400", Icon: ShieldX },
    EXPIRED: { label: "Expired", color: "bg-gray-500/15 text-gray-400", Icon: Timer },
};

const SS_STATUS_META: Record<string, { label: string; color: string }> = {
    REQUESTED: { label: "Pending", color: "bg-amber-500/15 text-amber-400" },
    OFFERED: { label: "Offered", color: "bg-blue-500/15 text-blue-400" },
    ACCEPTED: { label: "Accepted", color: "bg-green-500/15 text-green-400" },
    REJECTED: { label: "Rejected", color: "bg-red-500/15 text-red-400" },
    CANCELLED: { label: "Cancelled", color: "bg-gray-500/15 text-gray-400" },
};

function StatusBadge({ status }: { status: string }) {
    const m = STATUS_META[status] ?? { label: status, color: "bg-gray-500/15 text-gray-400", Icon: Shield };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.color}`}>
            <m.Icon className="h-3 w-3" />
            {m.label}
        </span>
    );
}

const ALL_FILTER = "__all__";

export default function PMInbox() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [closeModalId, setCloseModalId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState(ALL_FILTER);

    // ── Offer form state
    const [offeringId, setOfferingId] = useState<string | null>(null);
    const [offerPrice, setOfferPrice] = useState("");
    const [offerScore, setOfferScore] = useState("");

    const {
        data: appeals = [],
        isLoading,
        refetch,
        error,
    } = useQuery({
        queryKey: ["violations", "appeals"],
        queryFn: violationsApi.getAppeals,
    });

    const {
        data: ssRequests = [],
        isLoading: ssLoading,
        error: ssError,
    } = useQuery({
        queryKey: ["finance", "social-score-requests"],
        queryFn: () => financeApi.getSocialScoreRequests(),
    });

    const offerMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: { offeredPriceCredits: number; offeredSocialScore: number } }) =>
            financeApi.offerSocialScore(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["finance", "social-score-requests"] });
            toast({ title: "Offer sent", description: "The citizen can now accept or reject." });
            setOfferingId(null);
            setOfferPrice("");
            setOfferScore("");
        },
        onError: (e) => {
            toast({ title: "Failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
        },
    });

    const handleOffer = (requestId: string) => {
        const price = parseInt(offerPrice, 10);
        const score = parseInt(offerScore, 10);
        if (!price || price <= 0 || !score || score <= 0) {
            toast({ title: "Invalid input", description: "Both price and score must be positive integers.", variant: "destructive" });
            return;
        }
        offerMutation.mutate({ id: requestId, data: { offeredPriceCredits: price, offeredSocialScore: score } });
    };

    const filtered = statusFilter === ALL_FILTER
        ? appeals
        : appeals.filter((v) => v.status === statusFilter);

    const handleStartEvaluation = async (id: string) => {
        try {
            await violationsApi.startEvaluation(id);
            toast({ title: "Evaluation started", description: "Case chat created with offender and issuing mayor." });
            refetch();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to start evaluation";
            toast({ title: "Error", description: msg });
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const errorMessage = error instanceof Error ? error.message : "";
    const ssErrorMsg = ssError instanceof Error ? ssError.message : "";
    const showSsSection = !ssErrorMsg || !/forbidden|403/i.test(ssErrorMsg);

    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-5xl space-y-6"
            >
                {/* ── Header ────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">PM Inbox</h1>
                        <p className="text-muted-foreground">
                            Appealed &amp; in-evaluation violations from your department.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => refetch()}>
                        Refresh
                    </Button>
                </div>

                {/* ── Filter ────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-64">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                                <SelectItem value={ViolationStatusEnum.APPEALED}>Appealed</SelectItem>
                                <SelectItem value={ViolationStatusEnum.IN_EVALUATION}>In Evaluation</SelectItem>
                                <SelectItem value={ViolationStatusEnum.CLOSED_UPHELD}>Upheld</SelectItem>
                                <SelectItem value={ViolationStatusEnum.CLOSED_OVERTURNED}>Overturned</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ── Violations Content ────────────────────────── */}
                {errorMessage ? (
                    <Card className="glass-card">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {/forbidden|403/i.test(errorMessage)
                                ? "You are not a Prime Minister of any department."
                                : `Error: ${errorMessage}`}
                        </CardContent>
                    </Card>
                ) : isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : filtered.length === 0 ? (
                    <Card className="glass-card">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            No cases to review.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((v: Violation) => {
                            const isClosed = v.status.startsWith("CLOSED_") || v.status === "EXPIRED";
                            return (
                                <Card key={v.id} className="glass-card hover-lift">
                                    <CardContent className="py-4 space-y-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                                <span className="font-semibold">{v.title}</span>
                                                <StatusBadge status={v.status} />
                                            </div>
                                            <span className="text-sm font-bold text-destructive whitespace-nowrap">
                                                −{v.points} pts
                                            </span>
                                        </div>
                                        {v.description && (
                                            <p className="text-sm text-muted-foreground pl-6">{v.description}</p>
                                        )}
                                        {v.appealNote && (
                                            <div className="pl-6 text-sm">
                                                <span className="font-medium">Appeal note: </span>
                                                <span className="text-muted-foreground italic">"{v.appealNote}"</span>
                                            </div>
                                        )}
                                        {v.verdict && (
                                            <div className="pl-6 text-sm">
                                                <span className="font-medium">Verdict: </span>
                                                <span className={v.verdict === "UPHELD" ? "text-red-400" : v.verdict === "OVERTURNED" ? "text-green-400" : "text-amber-400"}>
                                                    {v.verdict.replace(/_/g, " ")}
                                                </span>
                                                {v.verdictNote && <span className="text-muted-foreground"> — {v.verdictNote}</span>}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground pl-6">
                                            <span>Offender: <span className="font-medium text-foreground">{v.offender.username}</span></span>
                                            <span>Issued by: <span className="font-medium text-foreground">{v.createdBy.username}</span></span>
                                            {v.appealedAt && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Appealed {formatDate(v.appealedAt)}
                                                </span>
                                            )}
                                            {v.pointsRefunded > 0 && <span className="text-green-400">+{v.pointsRefunded} pts refunded</span>}
                                        </div>
                                        <div className="flex gap-2 pl-6 pt-1">
                                            {v.status === ViolationStatusEnum.APPEALED && (
                                                <Button size="sm" onClick={() => handleStartEvaluation(v.id)}>
                                                    <Play className="mr-1 h-3 w-3" /> Start Evaluation
                                                </Button>
                                            )}
                                            {v.status === ViolationStatusEnum.IN_EVALUATION && v.chatRoom && (
                                                <Button size="sm" variant="secondary" onClick={() => navigate(`/app/pm/violations/${v.id}`)}>
                                                    <MessageSquare className="mr-1 h-3 w-3" /> Enter
                                                </Button>
                                            )}
                                            {v.status === ViolationStatusEnum.IN_EVALUATION && (
                                                <Button size="sm" variant="destructive" onClick={() => setCloseModalId(v.id)}>
                                                    <Scale className="mr-1 h-3 w-3" /> Close &amp; Verdict
                                                </Button>
                                            )}
                                            {isClosed && v.chatRoom && (
                                                <Button size="sm" variant="outline" onClick={() => navigate(`/app/pm/violations/${v.id}`)}>
                                                    <MessageSquare className="mr-1 h-3 w-3" /> View Case
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* ── Social Score Purchase Requests ────────────── */}
                {showSsSection && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center gap-3">
                            <Banknote className="h-5 w-5 text-primary" />
                            <h2 className="text-2xl font-bold">Social Score Purchase Requests</h2>
                        </div>

                        {ssLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            </div>
                        ) : ssRequests.length === 0 ? (
                            <Card className="glass-card">
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    No social score purchase requests.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {ssRequests.map((req: SocialScorePurchaseRequest) => (
                                    <Card key={req.id} className="glass-card hover-lift">
                                        <CardContent className="py-4 space-y-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Star className="h-4 w-4 text-amber-400" />
                                                    <span className="font-semibold">{req.user?.username ?? "Unknown"}</span>
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SS_STATUS_META[req.status]?.color ?? ""}`}>
                                                        {SS_STATUS_META[req.status]?.label ?? req.status}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            {req.user && (
                                                <div className="flex gap-4 text-sm text-muted-foreground pl-6">
                                                    <span>Credits: <span className="font-medium text-foreground">{req.user.credits}</span></span>
                                                    <span>Social Score: <span className="font-medium text-foreground">{req.user.socialScore}</span></span>
                                                </div>
                                            )}
                                            {req.requestNote && <p className="text-sm text-muted-foreground pl-6 italic">"{req.requestNote}"</p>}
                                            {req.status === "OFFERED" && (
                                                <div className="pl-6 text-sm">
                                                    <span className="font-medium">Offer: </span>
                                                    <span className="text-green-400">{req.offeredSocialScore} social score</span> for{" "}
                                                    <span className="text-amber-400">{req.offeredPriceCredits} credits</span>
                                                    <span className="text-muted-foreground"> — awaiting citizen response</span>
                                                </div>
                                            )}
                                            {req.status === "ACCEPTED" && (
                                                <div className="pl-6 text-sm text-green-400">✓ Accepted: {req.offeredSocialScore} score for {req.offeredPriceCredits} credits</div>
                                            )}
                                            {req.status === "REJECTED" && (
                                                <div className="pl-6 text-sm text-red-400">✗ Rejected by citizen</div>
                                            )}
                                            {req.status === "REQUESTED" && (
                                                <div className="pl-6">
                                                    {offeringId === req.id ? (
                                                        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="grid gap-1">
                                                                    <Label className="text-xs">Price (credits)</Label>
                                                                    <Input type="number" min={1} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="e.g. 50" />
                                                                </div>
                                                                <div className="grid gap-1">
                                                                    <Label className="text-xs">Social Score</Label>
                                                                    <Input type="number" min={1} value={offerScore} onChange={(e) => setOfferScore(e.target.value)} placeholder="e.g. 5" />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button size="sm" onClick={() => handleOffer(req.id)} disabled={offerMutation.isPending}>
                                                                    <Send className="mr-1 h-3 w-3" /> {offerMutation.isPending ? "Sending..." : "Send Offer"}
                                                                </Button>
                                                                <Button size="sm" variant="outline" onClick={() => setOfferingId(null)}>Cancel</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Button size="sm" onClick={() => setOfferingId(req.id)}>
                                                            <DollarSign className="mr-1 h-3 w-3" /> Make Offer
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Close Evaluation Modal ─────────────────── */}
                {closeModalId && (
                    <CloseEvaluationModal
                        open={!!closeModalId}
                        onOpenChange={(open) => {
                            if (!open) setCloseModalId(null);
                        }}
                        violationId={closeModalId}
                        onSuccess={() => {
                            setCloseModalId(null);
                            refetch();
                        }}
                    />
                )}
            </motion.div>
        </div>
    );
}
