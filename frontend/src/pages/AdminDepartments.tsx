import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, Crown, Search, ShieldAlert, Star, Banknote } from "lucide-react";

import { departmentsAdminApi } from "@/api/departments";
import { AssignDepartmentLeadersModal } from "@/components/modals/AssignDepartmentLeadersModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { DepartmentListItem } from "@/types";

export default function AdminDepartments() {
    const [search, setSearch] = useState("");
    const [noLeaderOnly, setNoLeaderOnly] = useState(false);
    const [selectedDept, setSelectedDept] = useState<DepartmentListItem | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const {
        data: departments = [],
        isLoading,
        refetch,
        error,
    } = useQuery({
        queryKey: ["admin", "departments"],
        queryFn: departmentsAdminApi.listDepartments,
    });

    const filteredDepts = useMemo(() => {
        const q = search.trim().toLowerCase();
        return departments
            .filter((d) => {
                const matchesSearch = !q ? true : d.name.toLowerCase().includes(q);
                const matchesNoLeader = noLeaderOnly
                    ? !d.primeMinister || !d.foreignMinister
                    : true;
                return matchesSearch && matchesNoLeader;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [departments, search, noLeaderOnly]);

    const openAssign = (dept: DepartmentListItem) => {
        setSelectedDept(dept);
        setModalOpen(true);
    };

    const handleSuccess = async () => {
        await refetch();
    };

    const errorMessage = error instanceof Error ? error.message : "";
    const noPermission = /forbidden|403/i.test(errorMessage);

    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-6xl space-y-6"
            >
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Assign Ministers</h1>
                        <p className="text-muted-foreground">
                            Admin-only: assign or change a department's Prime Minister &amp;
                            Foreign Minister.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            toast({
                                title: "Refreshing",
                                description: "Reloading departments list...",
                            });
                            refetch();
                        }}
                    >
                        Refresh
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by department name..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button
                        variant={noLeaderOnly ? "default" : "outline"}
                        onClick={() => setNoLeaderOnly((v) => !v)}
                    >
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Missing Leaders
                    </Button>
                </div>

                {noPermission ? (
                    <Card className="glass-card">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">
                                No permission — ADMIN role required.
                            </p>
                        </CardContent>
                    </Card>
                ) : isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : filteredDepts.length === 0 ? (
                    <Card className="glass-card">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            No departments found
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredDepts.map((dept) => (
                            <Card key={dept.id} className="glass-card hover-lift">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between gap-3">
                                        <span className="truncate">{dept.name}</span>
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {dept.rooms.length} room{dept.rooms.length !== 1 ? "s" : ""}
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Crown className="h-4 w-4" />
                                            Prime Minister
                                        </span>
                                        <span className="text-sm font-medium">
                                            {dept.primeMinister?.username ?? "Unassigned"}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Star className="h-4 w-4" />
                                            Foreign Minister
                                        </span>
                                        <span className="text-sm font-medium">
                                            {dept.foreignMinister?.username ?? "Unassigned"}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Banknote className="h-4 w-4" />
                                            Finance Minister
                                        </span>
                                        <span className="text-sm font-medium">
                                            {dept.financeMinister?.username ?? "Unassigned"}
                                        </span>
                                    </div>

                                    <Button
                                        className="w-full"
                                        onClick={() => openAssign(dept)}
                                    >
                                        Assign / Change
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <AssignDepartmentLeadersModal
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    department={selectedDept}
                    onSuccess={handleSuccess}
                />
            </motion.div>
        </div>
    );
}
