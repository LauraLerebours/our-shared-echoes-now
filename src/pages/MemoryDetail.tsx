
import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Heart, MessageCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const MemoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // In a real app, this would be fetched from an API
  const memory = {
    id: '1',
    image: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb',
    caption: 'Our first stargazing night. I'll never forget the way the sky looked that evening.',
    date: new Date('2024-04-15'),
    location: 'Redwood National Park',
    likes: 2,
    isLiked: true,
    comments: [
      {
        id: 'c1',
        author: 'Sarah',
        text: 'Such a magical night! We should go back there soon. ✨',
        createdAt: new Date('2024-04-16')
      }
    ]
  };
  
  const [isLiked, setIsLiked] = React.useState(memory.isLiked);
  const [likes, setLikes] = React.useState(memory.likes);
  const [commentText, setCommentText] = React.useState('');
  
  const toggleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
    setIsLiked(!isLiked);
  };
  
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    // In a real app, this would send the comment to an API
    console.log('Adding comment:', commentText);
    setCommentText('');
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
    <div className="min-h-screen bg-background flex flex-col pb-16">
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
          
          <div className="flex items-center justify-between border-t border-b py-3 mb-6">
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
            
            <div className="flex items-center text-muted-foreground">
              <MessageCircle className="h-5 w-5 mr-1" />
              <span>{memory.comments.length}</span>
            </div>
          </div>
          
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-medium">Comments</h2>
            
            {memory.comments.length > 0 ? (
              <div className="space-y-4">
                {memory.comments.map((comment) => (
                  <div key={comment.id} className="flex">
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xs">
                        {comment.author.charAt(0)}
                      </AvatarFallback>
                      <AvatarImage src="/placeholder.svg" />
                    </Avatar>
                    <div>
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="font-medium text-sm mb-1">{comment.author}</p>
                        <p className="text-sm">{comment.text}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(comment.createdAt, 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">No comments yet</p>
            )}
          </div>
        </div>
      </main>
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
        <form onSubmit={handleAddComment} className="flex items-center">
          <Avatar className="h-8 w-8 mr-3">
            <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xs">
              ME
            </AvatarFallback>
            <AvatarImage src="/placeholder.svg" />
          </Avatar>
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 border rounded-full py-2 px-4 text-sm"
          />
          <Button 
            type="submit"
            size="sm"
            variant="ghost"
            disabled={!commentText.trim()}
            className="ml-2 text-memory-purple disabled:text-muted-foreground"
          >
            Post
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MemoryDetail;
