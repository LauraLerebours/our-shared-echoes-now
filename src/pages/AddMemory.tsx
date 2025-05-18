
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ArrowLeft, CalendarIcon, MapPin, Image, Video } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createMemory } from '@/lib/db';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Memory } from '@/components/MemoryList';
import UploadMedia from './UploadMedia';

const AddMemory = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  
  const handleUploadSuccess = (publicUrl: string) => {
    setPreviewMedia(publicUrl);
    // Determine media type based on URL
    if (publicUrl.match(/\.(mp4|mov|avi|wmv)$/i)) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!previewMedia || !user) {
      toast({
        title: "Media required",
        description: "Please select an image or video for your memory",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    
    try {
      // Create a new memory object
      const newMemory: Memory = {
        id: uuidv4(),
        image: previewMedia,
        caption,
        date,
        location: location || undefined,
        likes: 0,
        isLiked: false,
        isVideo: mediaType === 'video',
        type: 'memory'
      };
      
      // Save to Supabase
      const savedMemory = await createMemory(newMemory, user.id);
      
      if (!savedMemory) {
        throw new Error('Failed to save memory');
      }
      
      // Show success notification
      toast({
        title: "Memory saved",
        description: "Your memory has been added successfully",
      });
      
      // Navigate back to the home page
      navigate('/');
      
    } catch (error) {
      console.error('Error saving memory:', error);
      toast({
        title: "Save failed",
        description: "Failed to save memory",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        
        <h1 className="text-lg font-medium">Add New Memory</h1>
        
        <Button 
          size="sm" 
          onClick={handleSubmit}
          disabled={!previewMedia || uploading}
          className="bg-memory-purple hover:bg-memory-purple/90"
        >
          {uploading ? 'Saving...' : 'Save'}
        </Button>
      </header>
      
      <main className="flex-1 p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="image" className="mb-4" onValueChange={(value) => setMediaType(value as 'image' | 'video')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="image" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Photo
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className={cn(
            "border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-6 relative",
            previewMedia ? "border-none p-0" : "border-memory-purple/30 bg-memory-lightpurple/20"
          )}>
            {uploading ? (
              <div className="flex flex-col items-center justify-center h-[200px]">
                <p>Uploading...</p>
              </div>
            ) : previewMedia ? (
              <div className="relative w-full">
                {mediaType === 'video' ? (
                  <video 
                    src={previewMedia} 
                    className="w-full aspect-[4/3] object-cover rounded-lg"
                    controls
                  />
                ) : (
                  <img 
                    src={previewMedia} 
                    alt="Memory preview" 
                    className="w-full aspect-[4/3] object-cover rounded-lg" 
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-4 right-4"
                  onClick={() => setPreviewMedia(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full">
                {mediaType === 'video' ? (
                  <Video className="h-12 w-12 text-memory-purple/50 mb-3" />
                ) : (
                  <Image className="h-12 w-12 text-memory-purple/50 mb-3" />
                )}
                <p className="text-muted-foreground mb-4 text-center">
                  Tap to add a {mediaType === 'video' ? 'video' : 'photo'} for this memory
                </p>
                
                {user && (
                  <UploadMedia 
                    userId={user.id}
                    mediaType={mediaType}
                    onUploadSuccess={handleUploadSuccess}
                    disabled={uploading}
                  />
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="caption" className="block text-sm font-medium text-muted-foreground mb-1">
                Caption
              </label>
              <Textarea
                id="caption"
                placeholder="Write something about this memory..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-muted-foreground mb-1">
                Location (optional)
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="Add a location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AddMemory;
