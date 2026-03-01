import { useEffect, useMemo, useState } from "react";

import { departmentsAdminApi } from "@/api/departments";
import { DepartmentListItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
    department: DepartmentListItem | null;
    onSuccess: () => void;
};

/** Sentinel value for the "Unassign" option in Select. */
const NONE_VALUE = "__none__";

export function AssignDepartmentLeadersModal({
    open,
    onOpenChange,
    department,
    onSuccess,
}: Props) {
    const [pmId, setPmId] = useState<string>("");
    const [fmId, setFmId] = useState<string>("");
    const [finId, setFinId] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset selections when the modal opens with a new department
    useEffect(() => {
        if (!open || !department) return;
        setPmId(department.primeMinister?.id ?? NONE_VALUE);
        setFmId(department.foreignMinister?.id ?? NONE_VALUE);
        setFinId(department.financeMinister?.id ?? NONE_VALUE);
    }, [open, department?.id]);

    /** Flatten all users from all rooms in this department. */
    const candidates = useMemo(() => {
        if (!department) return [];
        const seen = new Set<string>();
        const users: Array<{ id: string; username: string; email: string }> = [];
        for (const room of department.rooms) {
            for (const u of room.users) {
                if (!seen.has(u.id)) {
                    seen.add(u.id);
                    users.push(u);
                }
            }
        }
        return users.sort((a, b) => a.username.localeCompare(b.username));
    }, [department]);

    const handleSubmit = async () => {
        if (!department) return;

        const body: { primeMinisterId?: string | null; foreignMinisterId?: string | null; financeMinisterId?: string | null } = {};

        const resolvedPm = pmId === NONE_VALUE ? null : pmId || null;
        const resolvedFm = fmId === NONE_VALUE ? null : fmId || null;
        const resolvedFin = finId === NONE_VALUE ? null : finId || null;

        // Only send fields that actually changed
        if (resolvedPm !== (department.primeMinister?.id ?? null)) {
            body.primeMinisterId = resolvedPm;
        }
        if (resolvedFm !== (department.foreignMinister?.id ?? null)) {
            body.foreignMinisterId = resolvedFm;
        }
        if (resolvedFin !== (department.financeMinister?.id ?? null)) {
            body.financeMinisterId = resolvedFin;
        }

        if (Object.keys(body).length === 0) {
            toast({ title: "No changes", description: "Nothing was modified." });
            return;
        }

        try {
            setIsSubmitting(true);
            await departmentsAdminApi.updateLeadership(department.id, body);
            toast({
                title: "Leadership updated",
                description: `Department "${department.name}" leadership saved.`,
            });
            onSuccess();
            onOpenChange(false);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to update leadership";
            const noPermission = /forbidden|403/i.test(message);
            toast({
                title: noPermission ? "No permission" : "Update failed",
                description: noPermission
                    ? "You must be an ADMIN to assign department leaders."
                    : message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign Department Leaders</DialogTitle>
                    <DialogDescription>
                        {department
                            ? `Department: ${department.name}`
                            : "Select leaders for this department."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Prime Minister */}
                    <div className="grid gap-2">
                        <Label htmlFor="pm-select">Prime Minister</Label>
                        <Select value={pmId} onValueChange={setPmId}>
                            <SelectTrigger id="pm-select">
                                <SelectValue placeholder="Choose a department member" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>— Unassign —</SelectItem>
                                {candidates.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.username} ({u.email})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Foreign Minister */}
                    <div className="grid gap-2">
                        <Label htmlFor="fm-select">Foreign Minister</Label>
                        <Select value={fmId} onValueChange={setFmId}>
                            <SelectTrigger id="fm-select">
                                <SelectValue placeholder="Choose a department member" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>— Unassign —</SelectItem>
                                {candidates.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.username} ({u.email})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Finance Minister */}
                    <div className="grid gap-2">
                        <Label htmlFor="fin-select">Finance Minister</Label>
                        <Select value={finId} onValueChange={setFinId}>
                            <SelectTrigger id="fin-select">
                                <SelectValue placeholder="Choose a department member" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>— Unassign —</SelectItem>
                                {candidates.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.username} ({u.email})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {candidates.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No eligible members found in this department.
                        </p>
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
                    <Button onClick={handleSubmit} disabled={isSubmitting || !department}>
                        {isSubmitting ? "Saving..." : "Confirm"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
