import React, { useState, useEffect, useRef } from 'react';
import { Heart, Trash2, Video, User, FileText, Maximize, Minimize } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toggleMemoryLike } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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
  image?: string; // Optional for notes
  caption?: string;
  date: Date;
  location?: string;
  likes: number;
  isLiked: boolean;
  isVideo?: boolean;
  type?: 'memory' | 'note';
  memoryType?: 'photo' | 'video' | 'note';
  onLike: (id: string, newLikes: number, newIsLiked: boolean) => void;
  onViewDetail: (id: string) => void;
  onDelete?: (id: string) => void;
  createdBy?: string; // User ID who created this memory
  accessCode: string; // Add access code for like functionality
}

interface UserProfile {
  id: string;
  name: string;
  profile_picture_url?: string;
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
  memoryType,
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
  const [canDelete, setCanDelete] = useState(false);
  const [profileFetchAttempts, setProfileFetchAttempts] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine if this is a note
  const isNote = type === 'note' || memoryType === 'note';

  useEffect(() => {
    // Check if current user can delete this memory
    setCanDelete(user?.id === createdBy);
  }, [user?.id, createdBy]);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!createdBy) return;
      
      // Don't fetch if we're already fetching
      if (isFetchingProfile) return;
      
      // Limit retry attempts to prevent infinite loops
      if (profileFetchAttempts >= 2) {
        console.warn('Max profile fetch attempts reached for user:', createdBy);
        setProfileFetchError('Unable to load user profile');
        return;
      }

      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create a new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      setIsFetchingProfile(true);
      
      try {
        console.log(`Fetching creator profile for user ${createdBy} (attempt ${profileFetchAttempts + 1}/2)`);
        
        // Add a timeout to the fetch operation
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        }, 8000); // 8 second timeout

        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, name, profile_picture_url')
          .eq('id', createdBy)
          .abortSignal(abortControllerRef.current.signal)
          .single();

        clearTimeout(timeoutId);

        if (error) {
          console.error('Error fetching creator profile:', error);
          
          // Handle specific error types
          if (error.code === 'PGRST116') {
            // No rows returned - user profile doesn't exist
            console.warn('User profile not found for user:', createdBy);
            setProfileFetchError('User profile not found');
            return;
          }
          
          // For network errors or connection issues, retry with exponential backoff
          if (error.message?.includes('Failed to fetch') || 
              error.message?.includes('network') || 
              error.message?.includes('NetworkError') ||
              error.code === 'PGRST301' || // Connection timeout
              error.code === 'PGRST000') { // Generic connection error
            
            setProfileFetchAttempts(prev => prev + 1);
            const backoffDelay = Math.min(2000 * Math.pow(2, profileFetchAttempts), 8000);
            console.log(`Will retry profile fetch in ${backoffDelay}ms`);
            
            setTimeout(() => {
              setIsFetchingProfile(false);
              // The next fetch will be triggered by the useEffect dependency change
            }, backoffDelay);
            
            return;
          } else {
            // For other errors, don't retry
            setProfileFetchError('Error loading user profile');
          }
          return;
        }

        if (data) {
          setCreatorProfile(data);
          setProfileFetchAttempts(0); // Reset attempts on success
          setProfileFetchError(null); // Clear any previous errors
        }
      } catch (error) {
        console.error('Error fetching creator profile:', error);
        
        // Handle different types of errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            // AbortError is expected when requests are cancelled (e.g., component unmount)
            // Don't treat this as an error - just return silently
            return;
          } else if (error.message?.includes('Failed to fetch') || 
                     error.message?.includes('network') ||
                     error.message?.includes('NetworkError')) {
            // Retry on network errors with exponential backoff
            setProfileFetchAttempts(prev => prev + 1);
            const backoffDelay = Math.min(2000 * Math.pow(2, profileFetchAttempts), 8000);
            console.log(`Will retry profile fetch after network error in ${backoffDelay}ms`);
            
            setTimeout(() => {
              setIsFetchingProfile(false);
              // The next fetch will be triggered by the useEffect dependency change
            }, backoffDelay);
            
            return;
          } else {
            setProfileFetchError('Unexpected error loading profile');
          }
        } else {
          setProfileFetchError('Unknown error loading profile');
        }
      } finally {
        setIsFetchingProfile(false);
      }
    };

    if (createdBy && !creatorProfile && !isFetchingProfile) {
      fetchCreatorProfile();
    }
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [createdBy, profileFetchAttempts, creatorProfile, isFetchingProfile]);

  // Update local state when props change
  useEffect(() => {
    setCurrentLikes(likes);
    setCurrentIsLiked(isLiked);
  }, [likes, isLiked]);

  // Handle video loading and playback
  useEffect(() => {
    if (isVideo && videoRef.current && image) {
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
  }, [isVideo, image]);

  const handleLike = async () => {
    if (isLiking) return; // Prevent double-clicking

    setIsLiking(true);
    
    try {
      // Optimistically update UI first
      const newIsLiked = !currentIsLiked;
      const newLikes = newIsLiked ? currentLikes + 1 : currentLikes - 1;
      
      setCurrentIsLiked(newIsLiked);
      setCurrentLikes(newLikes);
      
      // Call API to update the like status
      const result = await toggleMemoryLike(id, accessCode);
      
      if (result && result.success) {
        // Update with actual server values
        setCurrentLikes(result.likes);
        setCurrentIsLiked(result.isLiked);
        onLike(id, result.likes, result.isLiked);
        
        toast({
          title: result.isLiked ? "Liked!" : "Unliked",
          description: result.isLiked ? "You liked this memory" : "You removed your like",
        });
      } else {
        // Revert to original values if API call fails
        setCurrentIsLiked(isLiked);
        setCurrentLikes(likes);
        
        toast({
          title: "Error",
          description: "Failed to update like. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert to original values
      setCurrentIsLiked(isLiked);
      setCurrentLikes(likes);
      
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!canDelete) {
      toast({
        title: "Permission Denied",
        description: "You can only delete memories that you created.",
        variant: "destructive",
      });
      return;
    }
    
    // If user can delete, the AlertDialog will handle the rest
  };

  const getCreatorInitials = () => {
    if (profileFetchError) return '?';
    if (!creatorProfile?.name) return 'U';
    return creatorProfile.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCreatorName = () => {
    if (profileFetchError) return 'Unknown User';
    if (isFetchingProfile && !creatorProfile) return 'Loading...';
    return creatorProfile?.name || 'Unknown User';
  };

  const toggleAspectRatio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullImage(!showFullImage);
  };

  // For notes, render as a simple text post
  if (isNote) {
    return (
      <Card className="overflow-hidden mb-6 animate-fade-in border-none shadow-md">
        <div className="p-6" onClick={() => onViewDetail(id)}>
          {/* Header with user info and date */}
          <div className="flex items-center gap-3 mb-4">
            {createdBy && (
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={creatorProfile?.profile_picture_url} 
                  alt={creatorProfile?.name || 'Profile'} 
                />
                <AvatarFallback className={cn(
                  "bg-memory-lightpurple text-memory-purple",
                  profileFetchError && "bg-gray-200 text-gray-500"
                )}>
                  {getCreatorInitials()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{getCreatorName()}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(date), 'MMM d, yyyy')}
                </span>
              </div>
              {location && (
                <p className="text-xs text-muted-foreground">{location}</p>
              )}
            </div>
          </div>

          {/* Note content */}
          <div className="mb-4">
            {caption ? (
              <p className="text-foreground leading-relaxed">{caption}</p>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mr-2" />
                <span>Empty note</span>
              </div>
            )}
          </div>
        </div>
        
        <CardFooter className="px-6 py-3 flex justify-between border-t">
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
            canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="p-1 h-auto text-destructive hover:bg-destructive/10"
                    onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(id);
                      }}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button 
                size="sm" 
                variant="ghost" 
                className="p-1 h-auto text-muted-foreground cursor-not-allowed opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(e);
                }}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )
          )}
        </CardFooter>
      </Card>
    );
  }

  // Regular memory card formatting
  return (
    <Card className="overflow-hidden mb-6 animate-fade-in border-none shadow-md">
      <div className="relative" onClick={() => onViewDetail(id)}>
        {isVideo && image ? (
          <div className="relative aspect-[4/3] overflow-hidden">
            {/* Blurred background for full view */}
            {showFullImage && (
              <div className="absolute inset-0 z-0">
                <video 
                  src={image}
                  className="w-full h-full object-cover scale-110 blur-md"
                  muted
                />
                <div className="absolute inset-0 bg-black/30"></div>
              </div>
            )}
            <video 
              ref={videoRef}
              src={image}
              className={cn(
                "w-full h-full relative z-10",
                showFullImage ? "object-contain" : "object-cover"
              )}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedData={() => setIsVideoLoaded(true)}
              onError={() => setIsVideoLoaded(false)}
            />
            {/* Video icon overlay - shows initially and fades out */}
            {showVideoIcon && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-1000 z-20">
                <Video className="h-12 w-12 text-white opacity-80" />
              </div>
            )}
            {/* Fallback for when video fails to load */}
            {!isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20">
                <Video className="h-12 w-12 text-gray-400" />
              </div>
            )}
            {/* Toggle aspect ratio button for videos */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 bg-black/30 hover:bg-black/50 text-white rounded-full h-8 w-8 p-0 z-30"
              onClick={toggleAspectRatio}
              title={showFullImage ? "Show cropped video" : "Show full video"}
            >
              {showFullImage ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : image ? (
          <div className="relative aspect-[4/3] overflow-hidden">
            {/* Blurred background for full view */}
            {showFullImage && (
              <div className="absolute inset-0 z-0">
                <img 
                  src={image} 
                  alt="" 
                  className="w-full h-full object-cover scale-110 blur-md"
                />
                <div className="absolute inset-0 bg-black/30"></div>
              </div>
            )}
            <img 
              src={image} 
              alt={caption || "Memory"} 
              className={cn(
                "w-full h-full relative z-10",
                showFullImage ? "object-contain" : "object-cover"
              )} 
            />
            {/* Toggle aspect ratio button */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 bg-black/30 hover:bg-black/50 text-white rounded-full h-8 w-8 p-0 z-30"
              onClick={toggleAspectRatio}
              title={showFullImage ? "Show cropped image" : "Show full image"}
            >
              {showFullImage ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          // Fallback for memories without images
          <div className="w-full aspect-[4/3] bg-gray-200 flex items-center justify-center">
            <FileText className="h-12 w-12 text-gray-400" />
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 z-20">
          <p className="text-white font-medium">{format(new Date(date), 'MMMM d, yyyy')}</p>
          {location && <p className="text-white/80 text-sm">{location}</p>}
          {createdBy && (
            <div className="flex items-center gap-2 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarImage 
                  src={creatorProfile?.profile_picture_url} 
                  alt={creatorProfile?.name || 'Profile'} 
                />
                <AvatarFallback className={cn(
                  "bg-white/20 text-white text-xs",
                  profileFetchError && "bg-white/10 text-white/60"
                )}>
                  {getCreatorInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="text-white/80 text-xs">by {getCreatorName()}</span>
            </div>
          )}
        </div>
      </div>
      
      <CardContent className="py-3 px-4" onClick={() => onViewDetail(id)}>
        {caption && !isNote && (
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
          canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="p-1 h-auto text-destructive hover:bg-destructive/10"
                  onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(id);
                    }}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button 
              size="sm" 
              variant="ghost" 
              className="p-1 h-auto text-muted-foreground cursor-not-allowed opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(e);
              }}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )
        )}
      </CardFooter>
    </Card>
  );
};

export default MemoryCard;