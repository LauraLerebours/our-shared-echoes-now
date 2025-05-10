
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createSharedBoard } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Share = () => {
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const generateShareCode = async () => {
    if (!user) {
      toast({
        title: 'Not logged in',
        description: 'Please log in to share your memories.',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingCode(true);
    const result = await createSharedBoard(user.id);
    setGeneratingCode(false);

    if (result) {
      setShareCode(result.share_code);
      toast({
        title: 'Share code generated',
        description: 'Your memories can now be shared with this code.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to generate share code. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Share code copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewShared = () => {
    const code = window.prompt('Enter the share code:');
    if (code) {
      navigate(`/shared/${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Share Your Memories</h1>
            <p className="text-muted-foreground mt-2">
              Create a share code to let others view your memory timeline
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <Button 
              onClick={generateShareCode}
              className="w-full bg-memory-purple hover:bg-memory-purple/90"
              disabled={generatingCode}
            >
              <Share2 className="h-4 w-4 mr-2" />
              {generatingCode ? 'Generating...' : 'Generate Share Code'}
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
              <h2 className="font-medium mb-2">Already have a share code?</h2>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleViewShared}
              >
                <Link className="h-4 w-4 mr-2" />
                View Shared Memories
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Share;
