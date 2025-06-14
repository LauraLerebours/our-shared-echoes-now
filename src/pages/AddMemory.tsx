import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ArrowLeft, CalendarIcon, MapPin, Image, Video, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createMemory, fetchBoards, createBoard } from '@/lib/db';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Memory } from '@/components/MemoryList';
import { uploadMediaToStorage } from '@/lib/uploadMediaToStorage';

const AddMemory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [date, setDate] = useState<Date>(new Date());
  const [caption, setCaption] = useState('');
  const [location_, setLocation] = useState('');
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [selectedAccessCode, setSelectedAccessCode] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<{id: string, name: string} | null>(null);
  const { user, userProfile } = useAuth();
  
  useEffect(() => {
    const initializeBoard = async () => {
      if (!user) return;

      try {
        // Get all boards
        const boards = await fetchBoards(user.id);
        
        // If we have a boardId in location state, find that board's access code
        const boardId = location.state?.boardId;
        if (boardId) {
          const board = boards.find(b => b.id === boardId);
          if (board) {
            setSelectedAccessCode(board.access_code);
            setSelectedBoard({id: board.id, name: board.name});
            return;
          }
        }
        
        // If no specific board or board not found, use first available board or create new one
        if (boards.length > 0) {
          setSelectedAccessCode(boards[0].access_code);
          setSelectedBoard({id: boards[0].id, name: boards[0].name});
        } else {
          // Create a default board if none exist
          const newBoard = await createBoard('My Memories', user.id);
          if (newBoard) {
            setSelectedAccessCode(newBoard.access_code);
            setSelectedBoard({id: newBoard.id, name: newBoard.name});
          } else {
            throw new Error('Failed to create default board');
          }
        }
      } catch (error) {
        console.error('Error initializing board:', error);
        toast({
          title: "Error",
          description: "Failed to initialize board",
          variant: "destructive",
        });
      }
    };

    initializeBoard();
  }, [user, location.state]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      const publicUrl = await uploadMediaToStorage(file, user.id);

      if (publicUrl) {
        setPreviewMedia(publicUrl);
        
        // Determine media type based on file type
        if (file.type.startsWith('video/')) {
          setMediaType('video');
        } else {
          setMediaType('image');
        }
        
        toast({
          title: "Upload successful",
          description: `Your ${file.type.startsWith('video/') ? 'video' : 'image'} has been uploaded successfully.`,
        });
      } else {
        toast({
          title: "Upload failed",
          description: "Could not upload file to storage. Please check if you're logged in and try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "An error occurred during upload. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const sendNotification = async (memoryId: string, boardId: string, caption: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hhcoeuedfeoudgxtttgn.supabase.co';
      const apiUrl = `${supabaseUrl}/functions/v1/send-memory-notification`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          memory_id: memoryId,
          board_id: boardId,
          creator_name: userProfile?.name || 'A user',
          memory_caption: caption,
          board_name: selectedBoard?.name || 'Shared Board'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send notification:', errorText);
        return false;
      }
      
      const result = await response.json();
      console.log('Notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!previewMedia) {
      toast({
        title: "Error",
        description: "Please select an image or video for your memory",
        variant: "destructive",
      });
      return;
    }

    if (!caption.trim()) {
      toast({
        title: "Error",
        description: "Please add a caption for your memory",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAccessCode || !selectedBoard) {
      toast({
        title: "Error",
        description: "No board selected",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    
    try {
      // Create a new memory object
      const memoryId = uuidv4();
      const newMemory: Memory = {
        id: memoryId,
        image: previewMedia,
        caption,
        date,
        location: location_ || undefined,
        likes: 0,
        isLiked: false,
        isVideo: mediaType === 'video',
        type: 'memory',
        accessCode: selectedAccessCode,
        createdBy: user?.id
      };
      
      // Save to Supabase
      const savedMemory = await createMemory(newMemory);
      
      if (!savedMemory) {
        throw new Error('Failed to save memory');
      }
      
      // Show success notification
      toast({
        title: "Memory saved",
        description: "Your memory has been added successfully",
      });
      
      // Send notification to board members
      sendNotification(memoryId, selectedBoard.id, caption)
        .then(success => {
          if (success) {
            console.log('Notification sent to board members');
          } else {
            console.warn('Failed to send notification to board members');
          }
        })
        .catch(error => {
          console.error('Error sending notification:', error);
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
          disabled={!caption.trim() || uploading || !selectedAccessCode || !previewMedia}
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
                
                <div className="relative inline-block">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => document.getElementById('file-input')?.click()}
                    className="flex items-center px-4 py-2 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <span className="flex items-center">
                        <span className="animate-spin mr-2">⏳</span>
                        Uploading...
                      </span>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Select {mediaType === 'video' ? 'Video' : 'Photo'}
                      </>
                    )}
                  </button>
                  <input
                    id="file-input"
                    type="file"
                    accept={mediaType === 'video' ? 'video/*' : 'image/*'}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                    onChange={handleFileChange}
                    disabled={uploading}
                    autoComplete="off"
                  />
                </div>
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
                required
                autoComplete="off"
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
                  value={location_}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
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