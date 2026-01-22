 import { useQuery } from '@tanstack/react-query';
 import { motion } from 'framer-motion';
 import { usersApi } from '@/api/users';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { RoleBadge } from '@/components/RoleBadge';
 import { StatusPill } from '@/components/StatusPill';
 import { Button } from '@/components/ui/button';
 import { User, Building2, Crown, Award, CheckCircle2 } from 'lucide-react';
 import { Link } from 'react-router-dom';
 
 export default function Dashboard() {
   const { data: user, isLoading } = useQuery({
     queryKey: ['profile'],
     queryFn: usersApi.getMe,
   });
 
   if (isLoading) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
       </div>
     );
   }
 
   if (!user) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <p className="text-muted-foreground">Failed to load profile</p>
       </div>
     );
   }
 
  const roomNumber = user?.room?.roomNumber ?? 'N/A';
  const departmentName = user?.room?.department?.name ?? 'N/A';
  const mayorName = user?.room?.mayor?.username ?? 'Not assigned';
  const roommates = user?.room?.users ?? [];
 
   return (
     <div className="min-h-screen p-8">
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         className="mx-auto max-w-6xl space-y-8"
       >
         <div>
           <h1 className="text-4xl font-bold mb-2">Welcome back, {user.username}</h1>
           <p className="text-muted-foreground">Your citizen dashboard</p>
         </div>
 
         <div className="grid gap-6 md:grid-cols-2">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <User className="h-5 w-5 text-primary" />
                 My Identity
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Username</span>
                 <span className="font-medium">{user.username}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Email</span>
                 <span className="font-medium">{user.email}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Role</span>
                 <RoleBadge role={user.role} />
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Department</span>
                  <span className="font-medium">{departmentName}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{roomNumber}</span>
               </div>
               <div className="flex justify-between items-center pt-3 border-t">
                 <span className="text-muted-foreground flex items-center gap-2">
                   <Award className="h-4 w-4" />
                   Social Score
                 </span>
                 <span className="text-2xl font-bold text-primary">{user.socialScore}</span>
               </div>
             </CardContent>
           </Card>
 
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Building2 className="h-5 w-5 text-primary" />
                 My Room
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <p className="text-sm text-muted-foreground mb-2">Mayor</p>
                  <p className="text-muted-foreground">{mayorName}</p>
               </div>
 
               <div>
                 <p className="text-sm text-muted-foreground mb-2">Roommates</p>
                  {roommates.length === 0 ? (
                    <p className="text-muted-foreground">No roommates found</p>
                  ) : (
                    <ul className="space-y-1">
                      {roommates.map((rm) => (
                        <li key={rm.id} className="text-muted-foreground">
                          {rm.username}
                        </li>
                      ))}
                    </ul>
                  )}
               </div>
             </CardContent>
           </Card>
         </div>
 
         <Card className="glass-card">
           <CardHeader className="flex flex-row items-center justify-between">
             <CardTitle className="flex items-center gap-2">
               <CheckCircle2 className="h-5 w-5 text-primary" />
               My Tasks
             </CardTitle>
             <Link to="/app/tasks">
               <Button variant="outline" size="sm">View All</Button>
             </Link>
           </CardHeader>
           <CardContent>
             <p className="text-center py-8 text-muted-foreground">
               Task data not available yet - navigate to Tasks page
             </p>
           </CardContent>
         </Card>
       </motion.div>
     </div>
   );
 }