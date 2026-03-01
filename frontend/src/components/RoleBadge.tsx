import { Badge } from '@/components/ui/badge';
import { Shield, User, Crown, Building, Scale, Globe } from 'lucide-react';

interface RoleBadgeProps {
  role: string;
  isPrimeMinister?: boolean;
  isForeignMinister?: boolean;
  isMayor?: boolean;
  isFinanceMinister?: boolean;
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

export function RoleBadge({ role, isPrimeMinister, isForeignMinister, isMayor, isFinanceMinister }: RoleBadgeProps) {
  const config = roleConfig[role] ?? { icon: Shield, label: role, variant: 'secondary' as const };
  const Icon = config.icon;

  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      {isPrimeMinister && (
        <Badge variant="default" className="gap-1 bg-purple-600 hover:bg-purple-700">
          <Scale className="h-3 w-3" />
          Prime Minister
        </Badge>
      )}
      {isForeignMinister && (
        <Badge variant="default" className="gap-1 bg-teal-600 hover:bg-teal-700">
          <Globe className="h-3 w-3" />
          Foreign Minister
        </Badge>
      )}
      {isFinanceMinister && (
        <Badge variant="default" className="gap-1 bg-teal-600 hover:bg-teal-700">
          <Globe className="h-3 w-3" />
          Finance Minister
        </Badge>
      )}
      {isMayor && role !== 'MAYOR' && (
        <Badge variant="default" className="gap-1">
          <Crown className="h-3 w-3" />
          Mayor
        </Badge>
      )}

    </div>
  );
}