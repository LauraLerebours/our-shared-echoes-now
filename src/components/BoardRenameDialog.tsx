import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { renameBoard } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';

interface BoardRenameDialogProps {
  boardId: string;
  currentName: string;
  onRename: (newName: string) => void;
  children: React.ReactNode;
}

const BoardRenameDialog: React.FC<BoardRenameDialogProps> = ({ 
  boardId, 
  currentName, 
  onRename, 
  children 
}) => {
  const [name, setName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to rename boards',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Board name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    if (name.trim() === currentName) {
      setOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const result = await renameBoard(boardId, name.trim(), user.id);
      
      if (result.success) {
        onRename(result.newName || name.trim());
        toast({
          title: 'Board renamed',
          description: 'Your board has been renamed successfully',
        });
        setOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error renaming board:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename board',
        variant: 'destructive',
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setName(currentName); // Reset to current name when opening
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Board</DialogTitle>
          <DialogDescription>
            Enter a new name for your board. This will be visible to all board members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="boardName">Board Name</Label>
              <Input
                id="boardName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter board name"
                disabled={isRenaming}
                maxLength={100}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isRenaming || !name.trim() || name.trim() === currentName}
              className="bg-memory-purple hover:bg-memory-purple/90"
            >
              {isRenaming ? 'Renaming...' : 'Rename Board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BoardRenameDialog;