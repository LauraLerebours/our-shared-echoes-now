
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Memory } from '@/components/MemoryList';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';

interface NoteFormValues {
  text: string;
  date: Date;
}

const AddNote = () => {
  const navigate = useNavigate();
  const form = useForm<NoteFormValues>({
    defaultValues: {
      text: '',
      date: new Date(),
    },
  });

  const onSubmit = (data: NoteFormValues) => {
    // Get existing memories from localStorage
    const existingMemoriesJson = localStorage.getItem('memories') || '[]';
    const existingMemories: Memory[] = JSON.parse(existingMemoriesJson);

    // Create a new note
    const newNote: Memory = {
      id: uuidv4(),
      image: '', // Notes don't have an image
      caption: data.text,
      date: data.date,
      likes: 0,
      isLiked: false,
      type: 'note',
    };

    // Add the new note to the existing memories
    const updatedMemories = [...existingMemories, newNote];
    
    // Save to localStorage
    localStorage.setItem('memories', JSON.stringify(updatedMemories));
    
    toast({
      title: "Note added",
      description: "Your note has been added successfully",
    });
    
    // Navigate back to the timeline
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <h1 className="text-2xl font-semibold mb-6">Add a Note</h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Write your note here..." 
                      className="min-h-[150px]" 
                      {...field}
                      required
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </FormItem>
              )}
            />
            
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
              
              <Button type="submit" className="w-full bg-memory-purple hover:bg-memory-purple/90">
                Save Note
              </Button>
            </div>
          </form>
        </Form>
      </main>
      
      <Footer />
    </div>
  );
};

export default AddNote;
