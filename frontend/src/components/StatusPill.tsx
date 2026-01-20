 import { TaskStatus } from '@/types';
 import { Badge } from '@/components/ui/badge';
 import { cn } from '@/lib/utils';
 
 interface StatusPillProps {
   status: TaskStatus;
   className?: string;
 }
 
 const statusConfig = {
   [TaskStatus.PENDING_APPROVAL]: {
     label: 'Pending Approval',
     className: 'bg-status-pending/20 text-status-pending border-status-pending/30',
   },
   [TaskStatus.ACTIVE]: {
     label: 'Active',
     className: 'bg-status-active/20 text-status-active border-status-active/30',
   },
   [TaskStatus.AWAITING_REVIEW]: {
     label: 'Awaiting Review',
     className: 'bg-status-review/20 text-status-review border-status-review/30',
   },
   [TaskStatus.COMPLETED]: {
     label: 'Completed',
     className: 'bg-status-completed/20 text-status-completed border-status-completed/30',
   },
 };
 
 export function StatusPill({ status, className }: StatusPillProps) {
   const config = statusConfig[status];
   
   return (
     <Badge variant="outline" className={cn(config.className, className)}>
       {config.label}
     </Badge>
   );
 }