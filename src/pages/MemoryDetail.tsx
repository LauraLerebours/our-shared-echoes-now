import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, MapPin, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Memory } from '@/components/MemoryList';
import { deleteMemory } from '@/lib/db';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadMemory = async () => {
      if (!id || !user) return;
      
      try {
        const { data, error } = await supabase
          .from('memories')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          const memoryData: Memory = {
            id: data.id,
            image: data.media_url || '',
            caption: data.caption,
            date: new Date(data.created_at),
            location: data.location,
            likes: data.likes || 0,
            isLiked: false,
            isVideo: data.is_video,
            type: 'memory'
          };
          
          setMemory(memoryData);
          setIsLiked(false); // Reset like state
          setLikes(data.likes || 0);
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
  }, [id, user]);
  
  const toggleLike = async () => {
    if (!memory || !user) return;
    
    try {
      const newLikes = isLiked ? likes - 1 : likes + 1;
      
      const { error } = await supabase
        .from('memories')
        .update({ likes: newLikes })
        .eq('id', memory.id)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      setLikes(newLikes);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Error updating likes:', error);
      toast({
        title: "Error",
        description: "Could not update likes",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!memory || !user) return;
    
    try {
      const success = await deleteMemory(memory.id, user.id);
      
      if (success) {
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
        navigate('/', { replace: true });
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
          <Link to="/">Back to timeline</Link>
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
        
        <h1 className="text-lg font-medium">{format(memory.date, 'MMMM d, yyyy')}</h1>
        
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
              onClick={toggleLike}
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
      </main>
    </div>
  );
};

export default MemoryDetail;