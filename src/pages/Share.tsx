import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Share2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBoards, addUserToBoard, getBoardByShareCode } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Share = () => {
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [boards, setBoards] = useState<Array<{ id: string; name: string; share_code: string }>>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadBoards = async () => {
      if (!user?.id) return;
      const boardsData = await fetchBoards(user.id);
      setBoards(boardsData);
    };
    loadBoards();
  }, [user?.id]);

  const getShareCode = () => {
    if (!selectedBoard) {
      toast({
        title: 'Error',
        description: 'Please select a board to share.',
        variant: 'destructive',
      });
      return;
    }

    const selectedBoardData = boards.find(b => b.id === selectedBoard);
    
    if (!selectedBoardData) {
      toast({
        title: 'Error',
        description: 'Selected board not found.',
        variant: 'destructive',
      });
      return;
    }

    setShareCode(selectedBoardData.share_code);
    toast({
      title: 'Share code ready',
      description: 'Your board share code is ready to copy.',
    });
  };

  const copyToClipboard = () => {
    // Copy only the share code, not the full URL
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Share code copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinBoard = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to join a board.',
        variant: 'destructive',
      });
      return;
    }

    if (!joinCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a share code.',
        variant: 'destructive',
      });
      return;
    }

    setIsJoining(true);
    try {
      // First, get the board name using the share code
      const boardData = await getBoardByShareCode(joinCode.trim().toUpperCase());
      
      if (!boardData) {
        toast({
          variant: 'destructive',
          title: 'Invalid share code',
          description: 'This share code doesn\'t exist or has expired.',
        });
        setIsJoining(false);
        return;
      }

      const result = await addUserToBoard(joinCode.trim().toUpperCase(), user.id);
      
      if (result.success) {
        // Show welcome message with board name
        toast({
          title: `Welcome to "${boardData.name}"! 🎉`,
          description: result.message || 'You have successfully joined the board.',
        });
        setJoinCode('');
        
        // Refresh boards list
        const boardsData = await fetchBoards(user.id);
        setBoards(boardsData);
        
        // Navigate to boards page to see the newly added board
        navigate('/boards');
      } else {
        toast({
          variant: 'destructive',
          title: 'Could not join board',
          description: result.message || 'Failed to join board. Please check the share code and try again.',
        });
      }
    } catch (error) {
      console.error('Error joining board:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to join board. Please try again.',
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Share & Collaborate</h1>
            <p className="text-muted-foreground mt-2">
              Share your boards or join others' boards to collaborate
            </p>
          </div>
          
          {/* Share Your Board Section */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Share Your Board</h2>
            <p className="text-sm text-muted-foreground">
              Every board has a unique share code that never changes
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Board to Share</label>
              <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={getShareCode}
              className="w-full bg-memory-purple hover:bg-memory-purple/90"
              disabled={!selectedBoard}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Get Share Code
            </Button>
            
            {shareCode && (
              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted p-3 flex items-center justify-between">
                  <span className="font-mono text-lg">{shareCode}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={copyToClipboard}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="px-3 py-2 bg-blue-50 border-t">
                  <p className="text-xs text-blue-600">
                    Share this code with others so they can join your board
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Join a Board Section */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Join a Board</h2>
            <p className="text-sm text-muted-foreground">
              Enter a share code to join someone else's board and collaborate
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Share Code</label>
              <Input
                placeholder="Enter share code (e.g., ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
              />
            </div>

            <Button 
              onClick={handleJoinBoard}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isJoining || !joinCode.trim()}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isJoining ? 'Joining...' : 'Join Board'}
            </Button>
          </div>
        </div>
      </main>
      
      <Footer activeTab="share" />
    </div>
  );
};

export default Share;