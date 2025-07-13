import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Reply, Edit2, Trash2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

interface Comment {
  id: string;
  memory_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    name: string;
    profile_picture_url?: string;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  memoryId: string;
  accessCode: string;
  onCommentsLoaded?: (count: number) => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ memoryId, accessCode, onCommentsLoaded }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user, userProfile } = useAuth();

  // Load comments for this memory
  useEffect(() => {
    loadComments();
  }, [memoryId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user_profiles(name, profile_picture_url)
        `)
        .eq('memory_id', memoryId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Organize comments into threads
      const commentCount = data.length;
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      // First pass: create comment objects
      data.forEach(comment => {
        const commentObj: Comment = {
          ...comment,
          replies: []
        };
        commentMap.set(comment.id, commentObj);
      });

      // Second pass: organize into threads
      data.forEach(comment => {
        const commentObj = commentMap.get(comment.id)!;
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies!.push(commentObj);
          }
        } else {
          rootComments.push(commentObj);
        }
      });

      setComments(rootComments);
      
      // Notify parent component about comment count
      if (onCommentsLoaded) {
        onCommentsLoaded(commentCount);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      console.log('🔄 Submitting new comment');
      const { error } = await supabase
        .from('comments')
        .insert([{
          memory_id: memoryId,
          user_id: user.id,
          content: newComment.trim(),
          parent_id: null
        }]);

      if (error) throw error;

      setNewComment('');
      await loadComments();
      
      // Send notification to memory owner
      try {
        console.log('🔄 Sending comment notification');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hhcoeuedfeoudgxtttgn.supabase.co';
        const apiUrl = `${supabaseUrl}/functions/v1/send-comment-notification`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'x-client-info': 'amity-app-comment-notification'
          },
          body: JSON.stringify({
            memory_id: memoryId,
            comment_id: 'new', // We don't have the ID yet as we just inserted
            commenter_name: userProfile?.name || 'A user',
            comment_content: newComment.trim(),
            memory_caption: '' // We don't have the caption here
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Comment notification sent:', result.success ? 'Success' : 'Failed');
        } else {
          console.warn('⚠️ Failed to send comment notification:', response.status, await response.text());
        }
      } catch (notificationError) {
        // Don't fail the comment submission if notification fails
        console.error('❌ Error sending comment notification:', notificationError);
      }
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !user) return;

    setSubmitting(true);
    try {
      console.log('🔄 Submitting reply to comment:', parentId);
      const { error } = await supabase
        .from('comments')
        .insert([{
          memory_id: memoryId,
          user_id: user.id,
          content: replyContent.trim(),
          parent_id: parentId
        }]);

      if (error) throw error;

      setReplyContent('');
      setReplyingTo(null);
      await loadComments();
      
      // Send notification for reply
      try {
        console.log('🔄 Sending reply notification');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hhcoeuedfeoudgxtttgn.supabase.co';
        const apiUrl = `${supabaseUrl}/functions/v1/send-comment-notification`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'x-client-info': 'amity-app-reply-notification'
          },
          body: JSON.stringify({
            memory_id: memoryId,
            comment_id: parentId,
            commenter_name: userProfile?.name || 'A user',
            comment_content: `Reply: ${replyContent.trim()}`,
            memory_caption: '' // We don't have the caption here
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Reply notification sent:', result.success ? 'Success' : 'Failed');
        } else {
          console.warn('⚠️ Failed to send reply notification:', response.status, await response.text());
        }
      } catch (notificationError) {
        // Don't fail the reply submission if notification fails
        console.error('❌ Error sending reply notification:', notificationError);
      }
      
      toast({
        title: 'Reply added',
        description: 'Your reply has been posted successfully',
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to add reply',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditContent('');
      setEditingComment(null);
      await loadComments();
      
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated successfully',
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      await loadComments();
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCurrentUserInitials = () => {
    if (userProfile?.name) {
      return getInitials(userProfile.name);
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwner = user?.id === comment.user_id;
    const isEditing = editingComment === comment.id;

    return (
      <div key={comment.id} className={`${isReply ? 'ml-8 mt-3' : 'mb-4'}`}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage 
              src={comment.user_profiles?.profile_picture_url} 
              alt={comment.user_profiles?.name || 'Profile'} 
            />
            <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xs">
              {getInitials(comment.user_profiles?.name || 'User')}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{comment.user_profiles?.name || 'User'}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.created_at), 'MMM d, yyyy • h:mm a')}
              </span>
              {comment.updated_at !== comment.created_at && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Edit your comment..."
                  className="min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleEditComment(comment.id)}
                    disabled={submitting || !editContent.trim()}
                    className="bg-memory-purple hover:bg-memory-purple/90"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingComment(null);
                      setEditContent('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReplyingTo(comment.id)}
                    className="text-xs h-6 px-2"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                  
                  {isOwner && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingComment(comment.id);
                          setEditContent(comment.content);
                        }}
                        className="text-xs h-6 px-2"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-6 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this comment? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteComment(comment.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </>
            )}
            
            {/* Reply form */}
            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={submitting || !replyContent.trim()}
                    className="bg-memory-purple hover:bg-memory-purple/90"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {/* Render replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3">
                {comment.replies.map(reply => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5 text-memory-purple" />
          <span className="font-medium">Comments</span>
        </div>
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-t">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-memory-purple" />
        <span className="font-medium">Comments ({comments.length})</span>
      </div>
      
      {/* Add new comment */}
      {user && (
        <div className="mb-6">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage 
                src={userProfile?.profile_picture_url} 
                alt={userProfile?.name || 'Profile'} 
              />
              <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xs">
                {getCurrentUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="min-h-[60px]"
              />
              <Button
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
                className="bg-memory-purple hover:bg-memory-purple/90"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => renderComment(comment))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;