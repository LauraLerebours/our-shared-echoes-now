import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ArrowLeft, CalendarIcon, MapPin, Image, Video, Upload, FileText, Shield, AlertTriangle, Images, X, Plus, Save, FileEdit } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Memory, MediaItem, Draft } from '@/lib/types';
import { uploadMediaToStorage } from '@/lib/uploadMediaToStorage';
import { extractPhotoMetadata } from '@/lib/extractMetadata';
import { ContentModerator, ModerationRateLimit } from '@/lib/contentModeration';
import { saveDraft, getDraftById, deleteDraft } from '@/lib/draftsStorage';
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchBoards, createBoard, createMemory } from '@/lib/db';
import DraftsDialog from '@/components/DraftsDialog';
import SEOHelmet from '@/components/SEOHelmet';

const AddMemory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [date, setDate] = useState<Date>(new Date());
  const [caption, setCaption] = useState('');
  const [location_, setLocation] = useState('');
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [memoryType, setMemoryType] = useState<'photo' | 'video' | 'note' | 'carousel'>('photo');
  const [uploading, setUploading] = useState(false);
  const [selectedAccessCode, setSelectedAccessCode] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<{id: string, name: string} | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [moderating, setModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [carouselItems, setCarouselItems] = useState<{file?: File, preview: string, isVideo: boolean, uploading: boolean, url?: string, order: number}[]>([]);
  const { user, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const hasContentRef = useRef(false);
  
  // Check if there's content to save
  const shouldSaveDraft = () => {
    // Don't save if user is not logged in
    if (!user) return false;
    
    // Don't save if no board is selected
    if (!selectedBoard) return false;
    
    // Save if there's a caption
    if (caption.trim()) return true;
    
    // Save if there's a location
    if (location_.trim()) return true;
    
    // Save if there's media
    if (previewMedia) return true;
    
    // Save if there are carousel items
    if (carouselItems.length > 0) return true;
    
    // Otherwise, don't save
    return false;
  };
  
  // Update hasContentRef whenever relevant state changes
  useEffect(() => {
    hasContentRef.current = shouldSaveDraft();
  }, [caption, location_, previewMedia, carouselItems, selectedBoard]);
  
  // Save draft when navigating away if there's content
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasContentRef.current) {
        handleSaveDraft();
      }
    };
    
    // Add event listener for page navigation
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Clean up
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Save draft when component unmounts if there's content
      if (hasContentRef.current) {
        handleSaveDraft();
      }
    };
  }, []);
  
  // Handle saving draft
  const handleSaveDraft = () => {
    if (!user || !selectedBoard) return;
    
    // Create a unique ID for this draft if it doesn't exist
    const currentDraftId = draftId || uuidv4();
    
    // Create the draft object
    const draft: Draft = {
      id: currentDraftId,
      memory: {
        caption: caption.trim() || undefined,
        date,
        location: location_.trim() || undefined,
        image: previewMedia || undefined,
        memoryType,
        isVideo: memoryType === 'video',
        type: memoryType === 'note' ? 'note' : 'memory',
        accessCode: selectedAccessCode || '',
        createdBy: user.id,
        isDraft: true
      },
      lastUpdated: new Date(),
      board_id: selectedBoard.id,
      mediaItems: memoryType === 'carousel' ? carouselItems.map((item, index) => ({
        preview: item.preview,
        isVideo: item.isVideo,
        uploading: item.uploading,
        url: item.url,
        order: index,
      })) : undefined
    };
    
    // Save the draft
    saveDraft(draft);
    
    // Update state
    setDraftId(currentDraftId);
    setLastSaved(new Date());
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('draftsUpdated'));
  };
  
  useEffect(() => {
    const initializeBoard = async () => {
      if (!user) return;

      try {
        // Get all boards
        const boards = await fetchBoards(user.id);
        
        // Check if we have a draft ID from location state
        const draftIdFromState = location.state?.draftId;
        if (draftIdFromState) {
          // Load the draft
          const draft = getDraftById(draftIdFromState);
          if (draft) {
            // Set draft ID
            setDraftId(draftIdFromState);
            
            // Set form values from draft
            if (draft.memory.caption) setCaption(draft.memory.caption);
            if (draft.memory.location) setLocation(draft.memory.location);
            if (draft.memory.date) setDate(draft.memory.date);
            if (draft.memory.image) setPreviewMedia(draft.memory.image);
            if (draft.memory.memoryType) setMemoryType(draft.memory.memoryType);
            
            // Set carousel items if applicable
            if (draft.memory.memoryType === 'carousel' && draft.mediaItems) {
              setCarouselItems(draft.mediaItems.map(item => ({
                file: undefined,
                preview: item.preview,
                isVideo: item.isVideo,
                uploading: item.uploading,
                url: item.url,
                order: item.order
              })));
            }
            
            // Set board if it exists in the draft
            if (draft.board_id) {
              const board = boards.find(b => b.id === draft.board_id);
              if (board) {
                setSelectedAccessCode(board.access_code);
                setSelectedBoard({id: board.id, name: board.name});
                return;
              }
            }
          }
        }
        
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

    // Clear any previous errors
    setUploadError(null);
    setModerationError(null);
    setUploading(true);
    
    try {
      // Check rate limiting
      if (!ModerationRateLimit.canMakeRequest(user.id)) {
        throw new Error('Too many moderation requests. Please wait a moment before trying again.');
      }

      // Record the moderation request
      ModerationRateLimit.recordRequest(user.id);

      // Moderate the file content
      setModerating(true);
      const moderationResult = await ContentModerator.moderateMemory(
        caption, 
        file, 
        memoryType === 'carousel' ? 'photo' : memoryType
      );

      if (!moderationResult.success) {
        throw new Error(moderationResult.error || 'Content moderation failed');
      }

      if (!moderationResult.result?.isAppropriate) {
        setModerationError(
          moderationResult.result?.reason || 
          'This content was flagged by our moderation system and cannot be uploaded.'
        );
        setModerating(false);
        setUploading(false);
        return;
      }

      setModerating(false);

      // Extract metadata from the file
      if (file.type.startsWith('image/')) {
        const metadata = await extractPhotoMetadata(file);
        
        // Set date from metadata if available
        if (metadata.date) {
          setDate(metadata.date);
          toast({
            title: "Date extracted",
            description: `Date automatically set to ${format(metadata.date, 'PPP')}`,
          });
        }
        
        // Set location from metadata if available
        if (metadata.location) {
          setLocation(metadata.location);
          toast({
            title: "Location extracted",
            description: `Location automatically set to ${metadata.location}`,
          });
        }
      } else if (file.type.startsWith('video/')) {
        // For videos, try to extract creation date from the file object
        if (file.lastModified) {
          const fileDate = new Date(file.lastModified);
          setDate(fileDate);
          toast({
            title: "Date extracted",
            description: `Date automatically set to ${format(fileDate, 'PPP')}`,
          });
        }
      }

      // Store the file for later upload
      setSelectedFile(file);

      // For carousel type, add to carousel items
      if (memoryType === 'carousel') {
        const isVideoFile = file.type.startsWith('video/');
        const preview = URL.createObjectURL(file);
        
        setCarouselItems(prev => [
          ...prev, 
          { 
            file, 
            preview, 
            isVideo: isVideoFile,
            uploading: true,
            order: prev.length
          }
        ]);
        
        // Upload the file
        const publicUrl = await uploadMediaToStorage(file, user.id);
        
        if (publicUrl) {
          // Update the carousel item with the uploaded URL
          setCarouselItems(prev => 
            prev.map(item => 
              item.preview === preview 
                ? { ...item, uploading: false, url: publicUrl } 
                : item
            )
          );
          
          toast({
            title: "Upload successful",
            description: `Your ${isVideoFile ? 'video' : 'image'} has been added to the carousel.`,
          });
        } else {
          // Remove the item if upload failed
          setCarouselItems(prev => prev.filter(item => item.preview !== preview));
          
          toast({
            title: "Upload failed",
            description: "Could not upload file to storage. Please try again.",
            variant: "destructive"
          });
        }
      } else {
        // For single photo/video, upload and set preview
        const publicUrl = await uploadMediaToStorage(file, user.id);

        if (publicUrl) {
          setPreviewMedia(publicUrl);
          
          // Determine memory type based on file type
          if (file.type.startsWith('video/')) {
            setMemoryType('video');
          } else {
            setMemoryType('photo');
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
      }
    } catch (error) {
      console.error("Upload error:", error);
      
      // Set the error message for display
      setUploadError(error instanceof Error ? error.message : "An unknown error occurred during upload");
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setModerating(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeCarouselItem = (index: number) => {
    setCarouselItems(prev => prev.filter((_, i) => i !== index));
  };

  const sendNotification = async (memoryId: string, boardId: string, caption: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hhcoeuedfeoudgxtttgn.supabase.co';
      const apiUrl = `${supabaseUrl}/functions/v1/send-memory-notification`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-client-info': 'amity-app'
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
        console.error('Failed to send notification:', response.status, errorText);
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

    // For notes, we don't need media
    if (memoryType !== 'note' && memoryType !== 'carousel' && !previewMedia) {
      toast({
        title: "Error",
        description: "Please select an image or video for your memory",
        variant: "destructive",
      });
      return;
    }

    // For carousel, we need at least one item
    if (memoryType === 'carousel' && carouselItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one image or video to your carousel",
        variant: "destructive",
      });
      return;
    }

    // Check if any carousel items are still uploading
    if (memoryType === 'carousel' && carouselItems.some(item => item.uploading)) {
      toast({
        title: "Please wait",
        description: "Some items are still uploading. Please wait for all uploads to complete.",
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

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create memories",
        variant: "destructive",
      });
      return;
    }

    // Check rate limiting
    if (!ModerationRateLimit.canMakeRequest(user.id)) {
      toast({
        title: "Rate Limited",
        description: "Too many requests. Please wait a moment before trying again.",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    setModerationError(null);
    
    try {
      // Record the moderation request
      ModerationRateLimit.recordRequest(user.id);

      // Moderate the content before saving
      setModerating(true);
      const moderationResult = await ContentModerator.moderateMemory(
        caption, 
        selectedFile || undefined,
        memoryType === 'carousel' ? 'photo' : memoryType
      );

      setModerating(false);

      if (!moderationResult.success) {
        throw new Error(moderationResult.error || 'Content moderation failed');
      }

      if (!moderationResult.result?.isAppropriate) {
        setModerationError(
          moderationResult.result?.reason || 
          'This content was flagged by our moderation system and cannot be saved.'
        );
        setUploading(false);
        return;
      }

      // Create a new memory object
      const memoryId = uuidv4();
      
      // Prepare media items for carousel
      const mediaItems = memoryType === 'carousel' 
        ? carouselItems.map((item, index) => ({
            id: uuidv4(),
            url: item.url || item.preview,
            isVideo: item.isVideo,
            memoryId,
            order: index,
            createdAt: new Date().toISOString()
          }))
        : undefined;
      
      const newMemory: Memory = {
        id: memoryId,
        image: memoryType === 'note' ? undefined : (memoryType === 'carousel' ? undefined : previewMedia),
        caption,
        date,
        location: location_ || undefined,
        likes: 0,
        isLiked: false,
        isVideo: memoryType === 'video',
        type: memoryType === 'note' ? 'note' : 'memory',
        memoryType: memoryType,
        accessCode: selectedAccessCode,
        createdBy: user?.id,
        mediaItems
      };
      
      // Save to Supabase
      const savedMemory = await createMemory(newMemory);
      
      if (!savedMemory) {
        throw new Error('Failed to save memory');
      }
      
      // Show success notification
      toast({
        title: "Memory saved",
        description: `Your ${memoryType} has been added successfully`,
      });
      
      // Send notification to board members
      sendNotification(memoryId, selectedBoard.id, caption)
        .then(success => {
          console.log(success ? 'Notification sent to board members' : 'Failed to send notification to board members');
        })
        .catch(error => {
          console.error('Error sending notification:', error);
        });
      
      // Delete the draft if it exists
      if (draftId) {
        await deleteDraft(draftId);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('draftsUpdated'));
      }
      
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
      setModerating(false);
    }
  };
  
  return (
    <>
      <SEOHelmet 
        title="Add New Memory | This Is Us"
        description="Create a new memory by adding photos, videos, or notes to your shared boards."
      />
      
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b fixed top-0 left-0 right-0 bg-white z-50">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          
          <h1 className="text-lg font-medium">
            {draftId ? 'Edit Draft' : 'Add New Memory'}
          </h1>
          
          <div className="flex gap-2">
            <DraftsDialog>
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-1"
              >
                <FileEdit className="h-4 w-4" />
                Drafts
              </Button>
            </DraftsDialog>
            
            <Button 
              size="sm" 
              onClick={handleSubmit}
              disabled={
                !caption.trim() || 
                uploading || 
                moderating || 
                !selectedAccessCode || 
                (memoryType === 'photo' && !previewMedia) || 
                (memoryType === 'video' && !previewMedia) || 
                (memoryType === 'carousel' && carouselItems.length === 0) ||
                (memoryType === 'carousel' && carouselItems.some(item => item.uploading))
              }
              className="bg-memory-purple hover:bg-memory-purple/90"
            >
              {uploading ? 'Saving...' : moderating ? 'Checking...' : 'Save'}
            </Button>
          </div>
        </header>
        
        <main className="flex-1 p-4 pt-16 max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="photo" className="mb-4" onValueChange={(value) => setMemoryType(value as 'photo' | 'video' | 'note' | 'carousel')}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="photo" className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Photo
                </TabsTrigger>
                <TabsTrigger value="video" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="note" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Note
                </TabsTrigger>
                <TabsTrigger value="carousel" className="flex items-center gap-2">
                  <Images className="h-4 w-4" />
                  Carousel
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Content Moderation Info */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                All content is automatically checked for appropriateness before being saved. 
                Please ensure your content follows community guidelines.
              </AlertDescription>
            </Alert>

            {/* Moderation Error Display */}
            {moderationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Content Blocked:</strong> {moderationError}
                </AlertDescription>
              </Alert>
            )}
            
            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <div className="text-red-600 font-medium">Upload Error</div>
                </div>
                <div className="text-red-600 text-sm mt-1">{uploadError}</div>
              </div>
            )}
            
            {/* Media upload section - only show for photo/video */}
            {memoryType === 'photo' || memoryType === 'video' ? (
              <div className={cn(
                "border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-6 relative",
                previewMedia ? "border-none p-0" : "border-memory-purple/30 bg-memory-lightpurple/20"
              )}>
                {uploading || moderating ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-memory-purple"></div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      {moderating ? 'Checking content...' : 'Uploading...'}
                    </p>
                  </div>
                ) : previewMedia ? (
                  <div className="relative w-full">
                    {memoryType === 'video' ? (
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
                      onClick={() => {
                        setPreviewMedia(null);
                        setUploadError(null);
                        setModerationError(null);
                        setSelectedFile(null);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full">
                    {memoryType === 'video' ? (
                      <Video className="h-12 w-12 text-memory-purple/50 mb-3" />
                    ) : (
                      <Image className="h-12 w-12 text-memory-purple/50 mb-3" />
                    )}
                    <p className="text-muted-foreground mb-4 text-center">
                      Tap to add a {memoryType === 'video' ? 'video' : 'photo'} for this memory
                    </p>
                    
                    <div className="relative inline-block">
                      <button
                        type="button"
                        disabled={uploading || moderating}
                        onClick={() => document.getElementById('file-input')?.click()}
                        className="flex items-center px-4 py-2 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading || moderating ? (
                          <span className="flex items-center">
                            <span className="animate-spin mr-2">⏳</span>
                            {moderating ? 'Checking...' : 'Uploading...'}
                          </span>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Select {memoryType === 'video' ? 'Video' : 'Photo'}
                          </>
                        )}
                      </button>
                      <input
                        id="file-input"
                        type="file"
                        accept={memoryType === 'video' ? 'video/*' : 'image/*'}
                        className="absolute inset-0 opacity-0 pointer-events-none"
                        onChange={handleFileChange}
                        disabled={uploading || moderating}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Note preview section - only show for notes */}
            {memoryType === 'note' && (
              <div className="border-2 border-dashed border-memory-purple/30 bg-memory-lightpurple/20 rounded-lg p-6">
                <div className="flex flex-col items-center justify-center">
                  <FileText className="h-12 w-12 text-memory-purple/50 mb-3" />
                  <p className="text-muted-foreground text-center">
                    This will be a text-only note without any media
                  </p>
                </div>
              </div>
            )}

            {/* Carousel upload section */}
            {memoryType === 'carousel' && (
              <div className="space-y-4">
                {/* Carousel items preview */}
                {carouselItems.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {carouselItems.map((item, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                        {item.isVideo ? (
                          <video 
                            src={item.preview} 
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <img 
                            src={item.preview} 
                            alt={`Carousel item ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        )}
                        
                        {/* Loading overlay */}
                        {item.uploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          </div>
                        )}
                        
                        {/* Remove button */}
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full p-0"
                          onClick={() => removeCarouselItem(index)}
                          disabled={item.uploading}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        
                        {/* Item type indicator */}
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                          {item.isVideo ? 'Video' : 'Photo'}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add more button */}
                    <div 
                      className="aspect-square rounded-lg border-2 border-dashed border-memory-purple/30 flex flex-col items-center justify-center cursor-pointer hover:bg-memory-lightpurple/10"
                      onClick={() => document.getElementById('carousel-file-input')?.click()}
                    >
                      <Plus className="h-8 w-8 text-memory-purple/50 mb-2" />
                      <p className="text-sm text-memory-purple/70">Add More</p>
                      <input
                        id="carousel-file-input"
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploading || moderating}
                        ref={fileInputRef}
                      />
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-memory-purple/30 bg-memory-lightpurple/20 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-memory-lightpurple/30"
                    onClick={() => document.getElementById('carousel-file-input')?.click()}
                  >
                    <Images className="h-12 w-12 text-memory-purple/50 mb-3" />
                    <p className="text-muted-foreground mb-4 text-center">
                      Tap to add photos and videos to your carousel
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      You can add multiple photos and videos that users can swipe through
                    </p>
                    <input
                      id="carousel-file-input"
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={uploading || moderating}
                      ref={fileInputRef}
                    />
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="caption" className="block text-sm font-medium text-muted-foreground mb-1">
                  {memoryType === 'note' ? 'Note Content' : 'Caption'}
                </label>
                <Textarea
                  id="caption"
                  placeholder={memoryType === 'note' ? "Write your note..." : "Write something about this memory..."}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="resize-none"
                  rows={memoryType === 'note' ? 6 : 3}
                  required
                  autoComplete="off"
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {caption.length}/5000 characters
                </p>
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
                      onSelect={(newDate) => {
                        if (newDate) {
                          setDate(newDate);
                        }
                      }}
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
                    maxLength={200}
                  />
                </div>
              </div>
              
              {/* Manual save draft button */}
              {shouldSaveDraft() && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDraft}
                    className="flex items-center gap-1 text-memory-purple border-memory-purple/30"
                  >
                    <Save className="h-4 w-4" />
                    Save as Draft
                  </Button>
                </div>
              )}
              
              {/* Last saved indicator */}
              {lastSaved && (
                <div className="text-xs text-muted-foreground text-right">
                  Last saved: {format(lastSaved, 'h:mm a')}
                </div>
              )}
            </div>
          </form>
        </main>
      </div>
    </>
  );
};

export default AddMemory;