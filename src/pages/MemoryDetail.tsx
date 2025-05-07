
import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Heart, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const MemoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // In a real app, this would be fetched from an API
  const memory = {
    id: '1',
    image: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb',
    caption: 'Our first stargazing night. I\'ll never forget the way the sky looked that evening.',
    date: new Date('2024-04-15'),
    location: 'Redwood National Park',
    likes: 2,
    isLiked: true
  };
  
  const [isLiked, setIsLiked] = React.useState(memory.isLiked);
  const [likes, setLikes] = React.useState(memory.likes);
  
  const toggleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
    setIsLiked(!isLiked);
  };
  
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
        
        <div className="w-8" />
      </header>
      
      <main className="flex-1">
        <div className="relative">
          <img 
            src={memory.image} 
            alt="Memory" 
            className="w-full aspect-square object-cover" 
          />
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
