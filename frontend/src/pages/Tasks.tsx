  import { useState } from 'react';
  import { useQuery, useQueryClient } from '@tanstack/react-query';
 import { motion } from 'framer-motion';
 import { tasksApi } from '@/api/tasks';
 import { useAuth } from '@/contexts/AuthContext';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Input } from '@/components/ui/input';
 import { StatusPill } from '@/components/StatusPill';
 import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
 import { CompleteTaskModal } from '@/components/modals/CompleteTaskModal';
 import { TaskStatus, Task } from '@/types';
 import { Plus, Search, Calendar, User as UserIcon } from 'lucide-react';
 
 export default function Tasks() {
   const { user } = useAuth();
    const queryClient = useQueryClient();
   const [selectedTab, setSelectedTab] = useState<'all' | TaskStatus>('all');
   const [searchQuery, setSearchQuery] = useState('');
   const [myTasksOnly, setMyTasksOnly] = useState(false);
   const [createModalOpen, setCreateModalOpen] = useState(false);
   const [completeModalOpen, setCompleteModalOpen] = useState(false);
   const [selectedTask, setSelectedTask] = useState<Task | null>(null);
 
    const {
      data: tasks = [],
      isLoading,
      isError,
      error,
      refetch,
    } = useQuery({
     queryKey: ['tasks', selectedTab, myTasksOnly],
     queryFn: () => tasksApi.getTasks({
       status: selectedTab === 'all' ? undefined : selectedTab,
       myOnly: myTasksOnly,
     }),
   });
 
   const filteredTasks = tasks.filter(task =>
     task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     task.description?.toLowerCase().includes(searchQuery.toLowerCase())
   );
 
   const handleCompleteClick = (task: Task) => {
     setSelectedTask(task);
     setCompleteModalOpen(true);
   };
 
   return (
     <div className="min-h-screen p-8">
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         className="mx-auto max-w-6xl space-y-6"
       >
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-4xl font-bold mb-2">Tasks</h1>
             <p className="text-muted-foreground">Manage room tasks and responsibilities</p>
           </div>
           <Button onClick={() => setCreateModalOpen(true)}>
             <Plus className="mr-2 h-4 w-4" />
             Create Task
           </Button>
         </div>
 
         <div className="flex flex-col sm:flex-row gap-4">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search tasks..."
               className="pl-9"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>
           <Button
             variant={myTasksOnly ? 'default' : 'outline'}
             onClick={() => setMyTasksOnly(!myTasksOnly)}
           >
             <UserIcon className="mr-2 h-4 w-4" />
             My Tasks Only
           </Button>
         </div>
 
         <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
           <TabsList className="grid grid-cols-5 w-full">
             <TabsTrigger value="all">All</TabsTrigger>
             <TabsTrigger value={TaskStatus.PENDING_APPROVAL}>Pending</TabsTrigger>
             <TabsTrigger value={TaskStatus.ACTIVE}>Active</TabsTrigger>
             <TabsTrigger value={TaskStatus.AWAITING_REVIEW}>Review</TabsTrigger>
             <TabsTrigger value={TaskStatus.COMPLETED}>Completed</TabsTrigger>
           </TabsList>
 
           <TabsContent value={selectedTab} className="mt-6">
             {isLoading ? (
               <div className="flex justify-center py-12">
                 <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
               </div>
              ) : isError ? (
                <Card className="glass-card">
                  <CardContent className="py-10 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {error instanceof Error ? error.message : 'Failed to load tasks'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ['tasks'] });
                          refetch();
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  </CardContent>
                </Card>
             ) : filteredTasks.length === 0 ? (
               <Card className="glass-card">
                 <CardContent className="py-12 text-center text-muted-foreground">
                   No tasks found
                 </CardContent>
               </Card>
             ) : (
               <div className="space-y-4">
                 {filteredTasks.map((task) => (
                   <Card key={task.id} className="glass-card hover-lift">
                     <CardHeader>
                       <div className="flex items-start justify-between">
                         <div className="flex-1">
                           <CardTitle className="text-xl mb-2">{task.title}</CardTitle>
                           {task.description && (
                             <p className="text-sm text-muted-foreground">{task.description}</p>
                           )}
                         </div>
                         <StatusPill status={task.status} />
                       </div>
                     </CardHeader>
                     <CardContent className="space-y-3">
                       <div className="flex flex-wrap gap-4 text-sm">
                         <div className="flex items-center gap-1 text-muted-foreground">
                           <UserIcon className="h-3 w-3" />
                           Created by: <span className="font-medium text-foreground">{task.createdBy?.username}</span>
                         </div>
                         {task.assignedTo && (
                           <div className="flex items-center gap-1 text-muted-foreground">
                             Assigned to: <span className="font-medium text-foreground">{task.assignedTo.username}</span>
                           </div>
                         )}
                         <div className="flex items-center gap-1 text-muted-foreground">
                           <Calendar className="h-3 w-3" />
                           {new Date(task.createdAt).toLocaleDateString()}
                         </div>
                       </div>
 
                       {task.completionSummary && (
                         <div className="p-3 rounded-lg bg-muted/50">
                           <p className="text-sm font-medium mb-1">Completion Summary:</p>
                           <p className="text-sm text-muted-foreground">{task.completionSummary}</p>
                         </div>
                       )}
 
                       {task.mayorReviewNote && (
                         <div className="p-3 rounded-lg bg-primary/10">
                           <p className="text-sm font-medium mb-1">Mayor Review:</p>
                           <p className="text-sm text-muted-foreground">{task.mayorReviewNote}</p>
                         </div>
                       )}
 
                        {task.status === TaskStatus.ACTIVE && (task.assignedTo?.id ?? task.assignedToId) === user?.id && (
                         <Button onClick={() => handleCompleteClick(task)} className="w-full">
                           Mark as Complete
                         </Button>
                       )}
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           </TabsContent>
         </Tabs>
       </motion.div>
 
       <CreateTaskModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
       <CompleteTaskModal
         task={selectedTask}
         open={completeModalOpen}
         onClose={() => {
           setCompleteModalOpen(false);
           setSelectedTask(null);
         }}
       />
     </div>
   );
 }