
import React from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
  onLike: (id: string) => void;
  onViewDetail: (id: string) => void;
  onDelete?: (id: string) => void;
}

const MemoryCard = ({
  id,
  image,
  caption,
  date,
  location,
  likes,
  isLiked,
  onLike,
  onViewDetail,
  onDelete,
}: MemoryCardProps) => {
  return (
    <Card className="overflow-hidden mb-6 animate-fade-in border-none shadow-md">
      <div className="relative" onClick={() => onViewDetail(id)}>
        <img 
          src={image} 
          alt={caption || "Memory"} 
          className="w-full aspect-[4/3] object-cover" 
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <p className="text-white font-medium">{format(new Date(date), 'MMMM d, yyyy')}</p>
          {location && <p className="text-white/80 text-sm">{location}</p>}
        </div>
      </div>
      
      <CardContent className="py-3 px-4" onClick={() => onViewDetail(id)}>
        {caption && <p className="text-foreground/80">{caption}</p>}
      </CardContent>
      
      <CardFooter className="px-4 py-2 flex justify-between border-t">
        <div className="flex items-center">
          <Button 
            size="sm" 
            variant="ghost" 
            className="p-0 h-auto" 
            onClick={(e) => {
              e.stopPropagation();
              onLike(id);
            }}
          >
            <Heart className={cn(
              "h-5 w-5 mr-1", 
              isLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-sm", 
              isLiked ? "text-memory-pink" : "text-muted-foreground"
            )}>{likes}</span>
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
