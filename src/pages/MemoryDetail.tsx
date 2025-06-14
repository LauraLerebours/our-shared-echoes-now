import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Heart, MapPin, Trash2, Edit2, Calendar, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Memory } from '@/components/MemoryList';
import { getMemory, deleteMemory, toggleMemoryLike, updateMemoryDetails } from '@/lib/db';
import CommentSection from '@/components/CommentSection';
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
      
      if (result && result.success) {
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
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
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
                  <AlertDialogTitle>Delete Memory</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this memory? This action cannot be undone.
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
      
      <main className="flex-1">
        <div className="relative">
          {memory.isVideo ? (
            <video 
              src={memory.image} 
              className="w-full aspect-square object-cover" 
              controls
            />
          ) : (
            <img 
              src={memory.image} 
              alt={memory.caption || "Memory"} 
              className="w-full aspect-square object-cover" 
            />
          )}
        </div>
        
        {isEditing ? (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="caption" className="block text-sm font-medium text-muted-foreground">
                Caption
              </label>
              <Textarea
                id="caption"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Write something about this memory..."
                className="resize-none"
                rows={3}
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
            {memory.caption && (
              <p className="text-foreground mb-4">{memory.caption}</p>
            )}
            
            {memory.location && (
              <div className="flex items-center text-sm text-muted-foreground mb-4">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{memory.location}</span>
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
          <CommentSection memoryId={memory.id} accessCode={accessCode} />
        )}
      </main>
    </div>
  );
};

export default MemoryDetail;