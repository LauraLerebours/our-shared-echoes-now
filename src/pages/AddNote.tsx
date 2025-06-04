
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Image } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { createMemory } from '@/lib/db';
import { Memory } from '@/components/MemoryList';
import UploadMedia from './UploadMedia';

interface NoteFormValues {
  text: string;
  date: Date;
}

const AddNote = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const form = useForm<NoteFormValues>({
    defaultValues: {
      text: '',
      date: new Date(),
    },
  });

  const handleUploadSuccess = (publicUrl: string) => {
    setMediaUrl(publicUrl);
    toast({
      title: "Image uploaded",
      description: "Your image has been added to the note",
    });
  };

  const onSubmit = async (data: NoteFormValues) => {
    const {
      data: { user: user },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Not logged in",
        description: "Please log in to add a note",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setUploading(true);
      
      // Create a new note
      const newNote: Memory = {
        id: uuidv4(),
        image: mediaUrl || '', // Include image if available
        caption: data.text,
        date: data.date,
        likes: 0,
        isVideo: false,
        isLiked: false,
        type: 'note' as 'memory' | 'note'
      };

      // Save to Supabase
      const savedNote = await createMemory(newNote, user.id);
      
      if (!savedNote) {
        throw new Error('Failed to save note');
      }
      
      toast({
        title: "Note added",
        description: "Your note has been added successfully",
      });
      
      // Navigate back to the timeline
      navigate('/');
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Save failed",
        description: "Failed to save note",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
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
            
            {/* Add image upload option */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Add Image (optional)</label>
              <div className="flex flex-col space-y-4">
                {mediaUrl ? (
                  <div className="relative">
                    <img 
                      src={mediaUrl} 
                      alt="Note attachment" 
                      className="w-full max-h-[200px] object-cover rounded-md" 
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => setMediaUrl(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  user && (
                    <div className="flex flex-col items-start">
                      <div className="flex items-center">
                        <Image className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Add an image to your note (optional)</span>
                      </div>
                      <div className="mt-2">
                        <UploadMedia
                          userId={user.id}
                          mediaType="image"
                          onUploadSuccess={handleUploadSuccess}
                          disabled={uploading}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
            
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
              
              <Button 
                type="submit" 
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
                disabled={uploading}
              >
                {uploading ? 'Saving...' : 'Save Note'}
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
