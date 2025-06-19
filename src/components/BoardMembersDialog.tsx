import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface BoardMember {
  id: string;
  name: string;
  profile_picture_url?: string;
  isOwner: boolean;
}

interface BoardMembersDialogProps {
  boardId: string;
  boardName: string;
  children: React.ReactNode;
}

const BoardMembersDialog: React.FC<BoardMembersDialogProps> = ({ 
  boardId, 
  boardName, 
  children 
}) => {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadBoardMembers = async () => {
    if (!boardId) return;

    setLoading(true);
    try {
      // Get the board with member_ids and owner_id
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('member_ids, owner_id')
        .eq('id', boardId)
        .single();

      if (boardError) throw boardError;

      if (!boardData.member_ids || boardData.member_ids.length === 0) {
        setMembers([]);
        return;
      }

      // Get user profiles for all members
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name, profile_picture_url')
        .in('id', boardData.member_ids);

      if (profilesError) throw profilesError;

      // Map profiles to members with owner status
      const membersWithOwnership = profilesData.map(profile => ({
        id: profile.id,
        name: profile.name,
        profile_picture_url: profile.profile_picture_url,
        isOwner: profile.id === boardData.owner_id
      }));

      // Sort so owner appears first
      membersWithOwnership.sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        return a.name.localeCompare(b.name);
      });

      setMembers(membersWithOwnership);
    } catch (error) {
      console.error('Error loading board members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load board members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadBoardMembers();
    }
  }, [open, boardId]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Board Members
          </DialogTitle>
          <DialogDescription>
            Members of "{boardName}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <p className="text-muted-foreground">Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex justify-center py-4">
              <p className="text-muted-foreground">No members found</p>
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={member.profile_picture_url} 
                    alt={member.name} 
                  />
                  <AvatarFallback className="bg-memory-lightpurple text-memory-purple">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.name}</span>
                    {member.isOwner && (
                      <Crown className="h-4 w-4 text-yellow-500" title="Board Owner" />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {member.isOwner ? 'Owner' : 'Member'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BoardMembersDialog;