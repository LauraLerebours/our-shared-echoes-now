import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const HelpButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  const showTutorial = () => {
    // Close the help dialog
    setOpen(false);
    
    // Call the global tutorial function with a small delay to ensure dialog is closed
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).showAppTutorial) {
        (window as any).showAppTutorial();
      }
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="fixed bottom-20 right-4 z-40 rounded-full bg-white shadow-md hover:bg-gray-100"
          title="Help & Tutorial"
        >
          <HelpCircle className="h-5 w-5 text-memory-purple" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help & Tutorial</DialogTitle>
          <DialogDescription>
            Learn how to use Amity and get the most out of your shared memories.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">App Tutorial</h3>
            <p className="text-sm text-muted-foreground">
              New to Amity? Take a guided tour to learn all the features.
            </p>
            <Button 
              onClick={showTutorial}
              className="w-full bg-memory-purple hover:bg-memory-purple/90"
            >
              Start Tutorial
            </Button>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Quick Help</h3>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm">Creating Memories</h4>
                <p className="text-xs text-muted-foreground">
                  Tap the "Add Memory" button on any board to create photos, videos, notes, or carousels.
                </p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm">Sharing Boards</h4>
                <p className="text-xs text-muted-foreground">
                  Go to the Share tab to get your board's share code or join someone else's board.
                </p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm">Saving Drafts</h4>
                <p className="text-xs text-muted-foreground">
                  When creating a memory, it's automatically saved as a draft. Access your drafts from the top right of the Add Memory screen.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Contact Support</h3>
            <p className="text-sm text-muted-foreground">
              Need more help? Contact us at <a href="mailto:lerebourslaura26@gmail.com" className="text-memory-purple">support@thisisus.space</a>
            </p>
          </div>
        </div>
        
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

export default HelpButton;