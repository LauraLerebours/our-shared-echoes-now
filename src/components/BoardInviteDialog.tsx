import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';

interface BoardInviteDialogProps {
  boardId: string;
  boardName: string;
  shareCode: string;
  children: React.ReactNode;
}

const BoardInviteDialog: React.FC<BoardInviteDialogProps> = ({ 
  boardId, 
  boardName, 
  shareCode, 
  children 
}) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const inviteLink = `${window.location.origin}/shared/${shareCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaSystem = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my "${boardName}" board on Amity,
          text: `I've invited you to join my "${boardName}" board on Amity. Click the link to join!`,
          url: inviteLink,
        });
        toast({
          title: 'Shared!',
          description: 'Invite link shared successfully',
        });
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback to clipboard if sharing fails
        copyToClipboard();
      }
    } else {
      // Fallback to clipboard if Web Share API is not available
      copyToClipboard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to "{boardName}"</DialogTitle>
          <DialogDescription>
            Share this link with friends to invite them to your board.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mt-4">
          <div className="grid flex-1 gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              When someone clicks this link and signs in, they'll be added to your board automatically.
            </p>
          </div>
          <Button 
            type="button" 
            size="icon" 
            className="px-3"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex justify-center mt-4">
          <Button 
            onClick={shareViaSystem}
            className="bg-memory-purple hover:bg-memory-purple/90"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Invite Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BoardInviteDialog;