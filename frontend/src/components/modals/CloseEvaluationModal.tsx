import { useState } from "react";
import { ViolationVerdictEnum } from "@/types";
import { violationsApi } from "@/api/violations";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    violationId: string;
    onSuccess: () => void;
};

export function CloseEvaluationModal({
    open,
    onOpenChange,
    violationId,
    onSuccess,
}: Props) {
    const [verdict, setVerdict] = useState<ViolationVerdictEnum | "">("");
    const [verdictNote, setVerdictNote] = useState("");
    const [mayorPenaltyPoints, setMayorPenaltyPoints] = useState<number>(5);
    const [mayorPenaltyTitle, setMayorPenaltyTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!verdict) {
            toast({ title: "Select verdict", description: "Choose a verdict." });
            return;
        }

        if (
            verdict === ViolationVerdictEnum.PUNISH_MAYOR &&
            (!mayorPenaltyPoints || mayorPenaltyPoints < 1)
        ) {
            toast({ title: "Invalid penalty", description: "Mayor penalty points must be >= 1." });
            return;
        }

        try {
            setIsSubmitting(true);
            await violationsApi.closeEvaluation(violationId, {
                verdict,
                verdictNote: verdictNote.trim() || undefined,
                ...(verdict === ViolationVerdictEnum.PUNISH_MAYOR
                    ? {
                        mayorPenaltyPoints,
                        mayorPenaltyTitle: mayorPenaltyTitle.trim() || undefined,
                    }
                    : {}),
            });
            toast({ title: "Evaluation closed", description: `Verdict: ${verdict}` });
            onSuccess();
            onOpenChange(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed";
            toast({ title: "Error", description: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Close Evaluation — Verdict</DialogTitle>
                    <DialogDescription>
                        Issue your verdict on this appealed violation. This action is final.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Verdict</Label>
                        <Select
                            value={verdict}
                            onValueChange={(v) => setVerdict(v as ViolationVerdictEnum)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose verdict" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ViolationVerdictEnum.UPHELD}>
                                    Uphold — violation stands
                                </SelectItem>
                                <SelectItem value={ViolationVerdictEnum.OVERTURNED}>
                                    Overturn — refund points to offender
                                </SelectItem>
                                <SelectItem value={ViolationVerdictEnum.PUNISH_MAYOR}>
                                    Punish Mayor — overturn + penalize the issuing mayor
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Note (optional)</Label>
                        <Textarea
                            placeholder="Reasoning for this verdict..."
                            value={verdictNote}
                            onChange={(e) => setVerdictNote(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {verdict === ViolationVerdictEnum.PUNISH_MAYOR && (
                        <>
                            <div className="grid gap-2">
                                <Label>Mayor penalty points</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={mayorPenaltyPoints}
                                    onChange={(e) => setMayorPenaltyPoints(Number(e.target.value))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Mayor violation title (optional)</Label>
                                <Input
                                    placeholder="PM ruling: ..."
                                    value={mayorPenaltyTitle}
                                    onChange={(e) => setMayorPenaltyTitle(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} variant="destructive">
                        {isSubmitting ? "Closing..." : "Close Evaluation"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
