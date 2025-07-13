import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Heart, MapPin, Trash2, Edit2, Calendar, Save, X, FileText, Maximize, Minimize, User, Images, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Memory, MediaItem } from '@/lib/types';
import { getMemory, deleteMemory, toggleMemoryLike, updateMemoryDetails } from '@/lib/db';
import CommentSection from '@/components/CommentSection';
import CarouselMemory from '@/components/CarouselMemory';
import SEOHelmet from '@/components/SEOHelmet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MemoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [showFullImage, setShowFullImage] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<{name: string, profile_picture_url?: string} | null>(null);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  
  const accessCode = location.state?.accessCode;
  
  useEffect(() => {
    const loadMemory = async () => {
      if (!id || !accessCode) {
        toast({
          title: "Error",
          description: "Missing required information to load memory",
          variant: "destructive",
        });
        navigate('/boards');
        return;
      }
      
      try {
        setLoading(true);
        const memoryData = await getMemory(id, accessCode);
        
        if (!memoryData) {
          toast({
            title: "Error",
            description: "Memory not found",
            variant: "destructive",
          });
          navigate('/boards');
          return;
        }
        
        setMemory(memoryData);
        setIsLiked(memoryData.isLiked);
        setLikes(memoryData.likes);
        setEditCaption(memoryData.caption || '');
        setEditLocation(memoryData.location || '');
        setEditDate(memoryData.date);
        
        // Check if current user can delete/edit this memory
        setCanDelete(user?.id === memoryData.createdBy);
        
        // Fetch creator profile if available
        if (memoryData.createdBy) {
          try {
            const { data, error } = await supabase
              .from('user_profiles')
              .select('name, profile_picture_url')
              .eq('id', memoryData.createdBy)
              .single();
              
            if (!error && data) {
              setCreatorProfile(data);
            }
          } catch (error) {
            console.error('Error fetching creator profile:', error);
          }
        }
      } catch (error) {
        console.error('Error loading memory:', error);
        toast({
          title: "Error",
          description: "Could not load memory details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadMemory();
  }, [id, accessCode, navigate, user?.id]);

  const handleLike = async () => {
    if (!memory || !accessCode || isLiking) return;

    setIsLiking(true);
    
    try {
      // Optimistically update UI
      const newIsLiked = !isLiked;
      const newLikes = newIsLiked ? likes + 1 : likes - 1;
      
      setIsLiked(newIsLiked);
      setLikes(newLikes);
      
      const result = await toggleMemoryLike(memory.id, accessCode);
      
      if (result && result.success && result.likes !== undefined && result.isLiked !== undefined) {
        // Update with actual server values
        setLikes(result.likes);
        setIsLiked(result.isLiked);
        
        toast({
          title: result.isLiked ? "Liked!" : "Unliked",
          description: result.isLiked ? "You liked this memory" : "You removed your like",
        });
      } else {
        // Revert to original values if API call fails
        setIsLiked(memory.isLiked);
        setLikes(memory.likes);
        
        toast({
          title: "Error",
          description: "Failed to update like. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert to original values
      setIsLiked(memory?.isLiked || false);
      setLikes(memory?.likes || 0);
      
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!memory || !accessCode) return;
    
    // Double-check permission before attempting to delete
    if (!canDelete) {
      toast({
        title: "Permission Denied",
        description: "You can only delete memories that you created.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const success = await deleteMemory(memory.id, accessCode);
      
      if (success) {
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
        navigate('/boards', { replace: true });
      } else {
        throw new Error('Failed to delete memory');
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      toast({
        title: "Error",
        description: "Could not delete memory",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!memory || !accessCode || !canDelete) return;
    
    setIsSaving(true);
    try {
      const updatedMemory = await updateMemoryDetails(memory.id, accessCode, {
        caption: editCaption,
        location: editLocation,
        date: editDate
      });
      
      if (updatedMemory) {
        setMemory(updatedMemory);
        setIsEditing(false);
        
        toast({
          title: "Memory updated",
          description: "Your memory has been updated successfully",
        });
      } else {
        throw new Error('Failed to update memory');
      }
    } catch (error) {
      console.error('Error updating memory:', error);
      toast({
        title: "Error",
        description: "Could not update memory",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset edit fields to current memory values
    if (memory) {
      setEditCaption(memory.caption || '');
      setEditLocation(memory.location || '');
      setEditDate(memory.date);
    }
    setIsEditing(false);
  };

  const toggleAspectRatio = () => {
    setShowFullImage(!showFullImage);
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!memory) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p>Memory not found</p>
        <Button asChild className="mt-4">
          <Link to="/boards">Back to boards</Link>
        </Button>
      </div>
    );
  }

  const isNote = memory.type === 'note' || memory.memoryType === 'note';
  const isCarousel = memory.memoryType === 'carousel';
  
  // Generate SEO title and description
  const seoTitle = memory.caption 
    ? `${memory.caption.substring(0, 50)}${memory.caption.length > 50 ? '...' : ''} | Memory`
    : `Memory from ${format(memory.date, 'MMMM d, yyyy')}`;
  
  const seoDescription = memory.caption 
    ? memory.caption.substring(0, 150) + (memory.caption.length > 150 ? '...' : '') 
    : `A ${memory.memoryType || 'photo'} memory from ${format(memory.date, 'MMMM d, yyyy')}${memory.location ? ` at ${memory.location}` : ''}`;
  
  return (
    <>
      <SEOHelmet 
        title={seoTitle}
        description={seoDescription}
        type="article"
        articlePublishedTime={memory.date.toISOString()}
      />
      
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b fixed top-0 left-0 right-0 bg-white z-50">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <h1 className="text-lg font-medium">
            {format(memory.date, 'MMMM d, yyyy')}
          </h1>
          
          <div className="flex gap-2">
            {canDelete && !isEditing && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="p-1 h-auto text-memory-purple hover:bg-memory-lightpurple"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-5 w-5" />
              </Button>
            )}
            
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="p-1 h-auto text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {isNote ? 'Note' : 'Memory'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this {isNote ? 'note' : 'memory'}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </header>
        
        <main className="flex-1 pt-16">
          {isNote ? (
            // Note display as simple text content
            <div className="p-6">
              <div className="max-w-2xl mx-auto">
                {/* Creator info for notes */}
                {creatorProfile && (
                  <div className="flex items-center gap-3 mb-6">
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={creatorProfile.profile_picture_url} 
                        alt={creatorProfile.name || 'Profile'} 
                      />
                      <AvatarFallback className="bg-memory-lightpurple text-memory-purple">
                        {creatorProfile.name ? getInitials(creatorProfile.name) : <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{creatorProfile.name || 'Unknown User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(memory.date, 'MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Location for notes */}
                {memory.location && (
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{memory.location}</span>
                  </div>
                )}
                
                {/* Note content */}
                {memory.caption ? (
                  <div className="prose prose-lg max-w-none">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {memory.caption}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-16 w-16 mb-4" />
                    <p className="text-lg">Empty note</p>
                  </div>
                )}
              </div>
            </div>
          ) : isCarousel && memory.mediaItems && memory.mediaItems.length > 0 ? (
            // Carousel memory display
            <div className="relative">
              <CarouselMemory 
                mediaItems={memory.mediaItems}
                onMediaItemClick={(index) => setCurrentCarouselIndex(index)}
                showControls={true}
                className="aspect-square"
              />
            </div>
          ) : (
            // Regular photo/video memory display
            <div className="relative">
              {memory.isVideo && memory.image ? (
                <div className="bg-black relative aspect-square">
                  {/* Blurred background for full view */}
                  {showFullImage && (
                    <div className="absolute inset-0 z-0">
                      <video 
                        src={memory.image} 
                        className="w-full h-full object-cover scale-110 blur-md"
                        muted
                      />
                      <div className="absolute inset-0 bg-black/30"></div>
                    </div>
                  )}
                  <video 
                    src={memory.image} 
                    className={cn(
                      "w-full h-full relative z-10",
                      showFullImage ? "object-contain" : "object-cover"
                    )}
                    controls
                  />
                  {/* Toggle aspect ratio button for videos */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white rounded-full h-10 w-10 p-0 z-20"
                    onClick={toggleAspectRatio}
                    title={showFullImage ? "Show cropped video" : "Show full video"}
                  >
                    {showFullImage ? (
                      <Minimize className="h-5 w-5" />
                    ) : (
                      <Maximize className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : memory.image ? (
                <div className="bg-black relative aspect-square">
                  {/* Blurred background for full view */}
                  {showFullImage && (
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={memory.image} 
                        alt="" 
                        className="w-full h-full object-cover scale-110 blur-md"
                      />
                      <div className="absolute inset-0 bg-black/30"></div>
                    </div>
                  )}
                  <img 
                    src={memory.image} 
                    alt={memory.caption || "Memory"} 
                    className={cn(
                      "w-full h-full relative z-10",
                      showFullImage ? "object-contain" : "object-cover"
                    )} 
                  />
                  {/* Toggle aspect ratio button */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white rounded-full h-10 w-10 p-0 z-20"
                    onClick={toggleAspectRatio}
                    title={showFullImage ? "Show cropped image" : "Show full image"}
                  >
                    {showFullImage ? (
                      <Minimize className="h-5 w-5" />
                    ) : (
                      <Maximize className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="w-full aspect-square bg-gray-200 flex items-center justify-center">
                  <FileText className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>
          )}
          
          {isEditing ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="caption" className="block text-sm font-medium text-muted-foreground">
                  {isNote ? 'Note Content' : 'Caption'}
                </label>
                <Textarea
                  id="caption"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder={isNote ? "Write your note..." : "Write something about this memory..."}
                  className="resize-none"
                  rows={isNote ? 8 : 3}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="location" className="block text-sm font-medium text-muted-foreground">
                  Location (optional)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Add a location"
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {editDate ? format(editDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editDate}
                      onSelect={(date) => date && setEditDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="bg-memory-purple hover:bg-memory-purple/90"
                >
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {!isNote && memory.caption && (
                <p className="text-foreground mb-4">{memory.caption}</p>
              )}
              
              {memory.location && (
                <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{memory.location}</span>
                </div>
              )}
              
              {creatorProfile && !isNote && (
                <div className="flex items-center gap-2 mb-4">
                  <Avatar className="h-6 w-6">
                    <AvatarImage 
                      src={creatorProfile.profile_picture_url} 
                      alt={creatorProfile.name || 'Profile'} 
                    />
                    <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xs">
                      {creatorProfile.name ? getInitials(creatorProfile.name) : <User className="h-3 w-3" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    Posted by {creatorProfile.name || 'Unknown User'}
                  </span>
                </div>
              )}
              
              <div className="flex items-center border-t py-3 mb-6">
                <Button 
                  variant="ghost" 
                  className="p-2 h-auto"
                  onClick={handleLike}
                  disabled={isLiking}
                >
                  <Heart className={cn(
                    "h-6 w-6 mr-1.5", 
                    isLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium", 
                    isLiked ? "text-memory-pink" : "text-muted-foreground"
                  )}>{likes}</span>
                </Button>
              </div>
            </div>
          )}
          
          {/* Comments Section - only show when not editing */}
          {!isEditing && (
            <CommentSection 
              memoryId={memory.id} 
              accessCode={accessCode} 
              onCommentsLoaded={(count) => setCommentCount(count)}
            />
          )}
        </main>
      </div>
    </>
  );
};

export default MemoryDetail;