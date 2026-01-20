 import { Badge } from '@/components/ui/badge';
 import { Shield, User, Crown, Building } from 'lucide-react';
 
 interface RoleBadgeProps {
  role: string;
 }
 
const roleConfig: Record<
  string,
  { icon: typeof Shield; label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  CITIZEN: { icon: User, label: 'Citizen', variant: 'secondary' },
  MAYOR: { icon: Crown, label: 'Mayor', variant: 'default' },
  MINISTER: { icon: Building, label: 'Minister', variant: 'default' },
  PM: { icon: Shield, label: 'PM', variant: 'default' },
  ADMIN: { icon: Shield, label: 'Admin', variant: 'destructive' },
};
 
 export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role] ?? { icon: Shield, label: role, variant: 'secondary' as const };
   const Icon = config.icon;
   
   return (
     <Badge variant={config.variant} className="gap-1">
       <Icon className="h-3 w-3" />
       {config.label}
     </Badge>
   );
 }