 import { useState } from 'react';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import { z } from 'zod';
 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { tasksApi } from '@/api/tasks';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 
 const schema = z.object({
   title: z.string().min(3, 'Title must be at least 3 characters'),
   description: z.string().optional(),
 });
 
 type FormData = z.infer<typeof schema>;
 
 interface CreateTaskModalProps {
   open: boolean;
   onClose: () => void;
 }
 
 export function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
     resolver: zodResolver(schema),
   });
 
   const createMutation = useMutation({
     mutationFn: tasksApi.createTask,
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tasks'] });
       toast({
         title: 'Task created',
         description: 'Your task is pending mayor approval',
       });
       reset();
       onClose();
     },
     onError: (error) => {
       toast({
         title: 'Failed to create task',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive',
       });
     },
   });
 
   const onSubmit = async (data: FormData) => {
     setIsSubmitting(true);
     try {
       await createMutation.mutateAsync({
         title: data.title,
         description: data.description,
       });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onClose}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>Create New Task</DialogTitle>
         </DialogHeader>
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="title">Title *</Label>
             <Input id="title" {...register('title')} placeholder="Task title" />
             {errors.title && (
               <p className="text-sm text-destructive">{errors.title.message}</p>
             )}
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="description">Description (optional)</Label>
             <Textarea
               id="description"
               {...register('description')}
               placeholder="Describe the task..."
               rows={4}
             />
           </div>
 
           <div className="flex gap-2 justify-end">
             <Button type="button" variant="outline" onClick={onClose}>
               Cancel
             </Button>
             <Button type="submit" disabled={isSubmitting}>
               {isSubmitting ? 'Creating...' : 'Create Task'}
             </Button>
           </div>
         </form>
       </DialogContent>
     </Dialog>
   );
 }