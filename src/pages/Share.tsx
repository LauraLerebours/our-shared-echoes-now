import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBoards, getBoardByShareCode } from '@/lib/db';
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
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadBoards = async () => {
      if (!user) return;
      const boardsData = await fetchBoards();
      setBoards(boardsData);
    };
    loadBoards();
  }, [user]);

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
    const shareUrl = `${window.location.origin}/shared/${shareCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Share link copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewShared = async () => {
    const code = window.prompt('Enter the share code:');
    if (code) {
      // Validate the share code exists before navigating
      const board = await getBoardByShareCode(code);
      if (board) {
        navigate(`/shared/${code}`);
      } else {
        toast({
          title: 'Invalid code',
          description: 'The share code you entered does not exist.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Share Your Board</h1>
            <p className="text-muted-foreground mt-2">
              Every board has a unique share code that never changes
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
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
              </div>
            )}
            
            <div className="pt-4 border-t">
              <h2 className="font-medium mb-2">Have a share code?</h2>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleViewShared}
              >
                <Link className="h-4 w-4 mr-2" />
                View Shared Board
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer activeTab="share" />
    </div>
  );
};

export default Share;