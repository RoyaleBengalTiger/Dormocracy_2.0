 import { useState } from 'react';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import { z } from 'zod';
 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { tasksApi } from '@/api/tasks';
 import { Task } from '@/types';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 
 const schema = z.object({
   completionSummary: z.string().min(5, 'Summary must be at least 5 characters'),
 });
 
 type FormData = z.infer<typeof schema>;
 
 interface CompleteTaskModalProps {
   task: Task | null;
   open: boolean;
   onClose: () => void;
 }
 
 export function CompleteTaskModal({ task, open, onClose }: CompleteTaskModalProps) {
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
     resolver: zodResolver(schema),
   });
 
   const completeMutation = useMutation({
     mutationFn: ({ id, data }: { id: string; data: FormData }) =>
       tasksApi.completeTask(id, { completionSummary: data.completionSummary }),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tasks'] });
       queryClient.invalidateQueries({ queryKey: ['profile'] });
       toast({
         title: 'Task completed',
         description: 'Awaiting mayor review',
       });
       reset();
       onClose();
     },
     onError: (error) => {
       toast({
         title: 'Failed to complete task',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive',
       });
     },
   });
 
   const onSubmit = async (data: FormData) => {
     if (!task) return;
     setIsSubmitting(true);
     try {
       await completeMutation.mutateAsync({ id: task.id, data });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onClose}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>Complete Task: {task?.title}</DialogTitle>
         </DialogHeader>
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="completionSummary">Completion Summary *</Label>
             <Textarea
               id="completionSummary"
               {...register('completionSummary')}
               placeholder="Describe how you completed this task..."
               rows={5}
             />
             {errors.completionSummary && (
               <p className="text-sm text-destructive">{errors.completionSummary.message}</p>
             )}
           </div>
 
           <div className="flex gap-2 justify-end">
             <Button type="button" variant="outline" onClick={onClose}>
               Cancel
             </Button>
             <Button type="submit" disabled={isSubmitting}>
               {isSubmitting ? 'Submitting...' : 'Submit for Review'}
             </Button>
           </div>
         </form>
       </DialogContent>
     </Dialog>
   );
 }