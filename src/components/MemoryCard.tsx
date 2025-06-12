import React, { useState, useEffect, useRef } from 'react';
import { Heart, Trash2, Video, FileText, User } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toggleMemoryLike } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
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

export interface MemoryCardProps {
  id: string;
  image: string;
  caption?: string;
  date: Date;
  location?: string;
  likes: number;
  isLiked: boolean;
  isVideo?: boolean;
  type?: 'memory' | 'note';
  onLike: (id: string, newLikes: number, newIsLiked: boolean) => void;
  onViewDetail: (id: string) => void;
  onDelete?: (id: string) => void;
  createdBy?: string; // User ID who created this memory
  accessCode: string; // Add access code for like functionality
}

interface UserProfile {
  id: string;
  name: string;
}

const MemoryCard = ({
  id,
  image,
  caption,
  date,
  location,
  likes,
  isLiked,
  isVideo,
  type = 'memory',
  onLike,
  onViewDetail,
  onDelete,
  createdBy,
  accessCode,
}: MemoryCardProps) => {
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [currentIsLiked, setCurrentIsLiked] = useState(isLiked);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showVideoIcon, setShowVideoIcon] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isNote = type === 'note';

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!createdBy) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, name')
          .eq('id', createdBy)
          .single();

        if (error) {
          console.error('Error fetching creator profile:', error);
          return;
        }

        setCreatorProfile(data);
      } catch (error) {
        console.error('Error fetching creator profile:', error);
      }
    };

    fetchCreatorProfile();
  }, [createdBy]);

  // Update local state when props change
  useEffect(() => {
    setCurrentLikes(likes);
    setCurrentIsLiked(isLiked);
  }, [likes, isLiked]);

  // Handle video loading and playback
  useEffect(() => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      
      const handleLoadedData = () => {
        setIsVideoLoaded(true);
        // Hide the video icon after a short delay once video starts playing
        setTimeout(() => {
          setShowVideoIcon(false);
        }, 1000);
      };

      const handleError = () => {
        console.error('Video failed to load');
        setIsVideoLoaded(false);
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);

      // Start playing the video
      video.play().catch(error => {
        console.error('Video autoplay failed:', error);
      });

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      };
    }
  }, [isVideo]);

  const handleLike = async () => {
    if (isLiking) return; // Prevent double-clicking

    setIsLiking(true);
    
    try {
      const result = await toggleMemoryLike(id, accessCode);
      
      if (result && result.success) {
        setCurrentLikes(result.likes);
        setCurrentIsLiked(result.isLiked);
        onLike(id, result.likes, result.isLiked);
        
        toast({
          title: result.isLiked ? "Liked!" : "Unliked",
          description: result.isLiked ? "You liked this memory" : "You removed your like",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update like. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const getCreatorInitials = () => {
    if (!creatorProfile?.name) return 'U';
    return creatorProfile.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCreatorName = () => {
    return creatorProfile?.name || 'Unknown User';
  };

  if (isNote) {
    // Special formatting for notes
    return (
      <Card className="overflow-hidden mb-6 animate-fade-in border-l-4 border-l-memory-purple shadow-md bg-gradient-to-r from-memory-lightpurple/10 to-white">
        <CardContent className="p-4" onClick={() => onViewDetail(id)}>
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 bg-memory-purple/10 rounded-full flex items-center justify-center">
              <FileText className="h-5 w-5 text-memory-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-memory-purple">Note</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{format(new Date(date), 'MMM d, yyyy')}</span>
              </div>
              {caption && (
                <p className="text-foreground leading-relaxed line-clamp-4">{caption}</p>
              )}
              {creatorProfile && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xs">
                      {getCreatorInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">by {getCreatorName()}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="px-4 py-2 flex justify-between border-t bg-white/50">
          <div className="flex items-center">
            <Button 
              size="sm" 
              variant="ghost" 
              className="p-0 h-auto" 
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              disabled={isLiking}
            >
              <Heart className={cn(
                "h-5 w-5 mr-1", 
                currentIsLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm", 
                currentIsLiked ? "text-memory-pink" : "text-muted-foreground"
              )}>{currentLikes}</span>
            </Button>
          </div>
          
          {onDelete && (
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
                  <AlertDialogTitle>Delete Note</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this note? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(id)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Regular memory card formatting
  return (
    <Card className="overflow-hidden mb-6 animate-fade-in border-none shadow-md">
      <div className="relative" onClick={() => onViewDetail(id)}>
        {isVideo ? (
          <div className="relative">
            <video 
              ref={videoRef}
              src={image}
              className="w-full aspect-[4/3] object-cover" 
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedData={() => setIsVideoLoaded(true)}
              onError={() => setIsVideoLoaded(false)}
            />
            {/* Video icon overlay - shows initially and fades out */}
            {showVideoIcon && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-1000">
                <Video className="h-12 w-12 text-white opacity-80" />
              </div>
            )}
            {/* Fallback for when video fails to load */}
            {!isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <Video className="h-12 w-12 text-gray-400" />
              </div>
            )}
          </div>
        ) : (
          <img 
            src={image} 
            alt={caption || "Memory"} 
            className="w-full aspect-[4/3] object-cover" 
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <p className="text-white font-medium">{format(new Date(date), 'MMMM d, yyyy')}</p>
          {location && <p className="text-white/80 text-sm">{location}</p>}
          {creatorProfile && (
            <div className="flex items-center gap-2 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {getCreatorInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="text-white/80 text-xs">by {getCreatorName()}</span>
            </div>
          )}
        </div>
      </div>
      
      <CardContent className="py-3 px-4" onClick={() => onViewDetail(id)}>
        {caption && (
          <p className="text-foreground/80">{caption}</p>
        )}
      </CardContent>
      
      <CardFooter className="px-4 py-2 flex justify-between border-t">
        <div className="flex items-center">
          <Button 
            size="sm" 
            variant="ghost" 
            className="p-0 h-auto" 
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
            disabled={isLiking}
          >
            <Heart className={cn(
              "h-5 w-5 mr-1", 
              currentIsLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-sm", 
              currentIsLiked ? "text-memory-pink" : "text-muted-foreground"
            )}>{currentLikes}</span>
          </Button>
        </div>
        
        {onDelete && (
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
                  onClick={() => onDelete(id)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
};

export default MemoryCard;