import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle, BookOpen, MessageSquare, Heart, Users, Camera, FileText, Images, Share2, Grid, List } from 'lucide-react';
import SEOHelmet from '@/components/SEOHelmet';

const Help = () => {
  const showTutorial = () => {
    if (typeof window !== 'undefined' && (window as any).showAppTutorial) {
      (window as any).showAppTutorial();
    }
  };

  return (
    <>
      <SEOHelmet 
        title="Help & Tutorial | Amity"
        description="Learn how to use Amity with our comprehensive help guide and interactive tutorial."
      />
      
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b fixed top-0 left-0 right-0 bg-white z-50">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          
          <h1 className="text-lg font-medium">Help & Tutorial</h1>
          
          <div className="w-8"></div>
        </header>
        
        <main className="flex-1 p-4 pt-16 max-w-3xl mx-auto">
          <div className="space-y-8">
            {/* Interactive Tutorial Section */}
            <section className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-memory-lightpurple p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-memory-purple" />
                </div>
                <h2 className="text-xl font-semibold">Interactive Tutorial</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                New to Amity? Take our guided tour to learn all the features and get the most out of your experience.
              </p>
              
              <Button 
                onClick={showTutorial}
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Start Interactive Tutorial
              </Button>
            </section>
            
            {/* Feature Guides Section */}
            <section className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-memory-lightpurple p-3 rounded-full">
                  <Heart className="h-6 w-6 text-memory-purple" />
                </div>
                <h2 className="text-xl font-semibold">Feature Guides</h2>
              </div>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="h-5 w-5 text-memory-pink" />
                    <h3 className="font-medium">Adding Memories</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Create new memories by tapping the "Add Memory" button on any board. You can add photos, videos, text notes, or create carousels with multiple media items.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Photos: Upload images from your device</li>
                    <li>Videos: Upload short video clips</li>
                    <li>Notes: Create text-only memories</li>
                    <li>Carousels: Combine multiple photos and videos</li>
                  </ul>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Grid className="h-5 w-5 text-memory-purple" />
                    <h3 className="font-medium">Managing Boards</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Boards help you organize memories by theme, event, or relationship. Create private boards for close friends or public boards anyone can join.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Create new boards from the Boards tab</li>
                    <li>Rename boards by clicking the edit icon</li>
                    <li>View board members to see who can contribute</li>
                    <li>Leave boards you no longer want to be part of</li>
                  </ul>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="h-5 w-5 text-memory-pink" />
                    <h3 className="font-medium">Sharing & Collaboration</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Share your boards with friends and family so they can join and contribute memories.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Get your board's share code from the Share tab</li>
                    <li>Send the code or direct link to friends</li>
                    <li>Join others' boards by entering their share code</li>
                    <li>Everyone can add photos, like, and comment</li>
                  </ul>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <List className="h-5 w-5 text-memory-purple" />
                    <h3 className="font-medium">Viewing Memories</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    View your memories in different ways to suit your preference.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Timeline view: See detailed memories in chronological order</li>
                    <li>Grid view: Get a visual overview of all memories</li>
                    <li>Tap any memory to see full details and comments</li>
                    <li>Like memories to show appreciation</li>
                  </ul>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-memory-pink" />
                    <h3 className="font-medium">Working with Drafts</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Save your work in progress and come back to it later.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Drafts are automatically saved as you work</li>
                    <li>Access drafts from the top right of the Add Memory screen</li>
                    <li>Continue editing any draft when you're ready</li>
                    <li>Drafts sync across your devices</li>
                  </ul>
                </div>
              </div>
            </section>
            
            {/* FAQ Section */}
            <section className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-memory-lightpurple p-3 rounded-full">
                  <MessageSquare className="h-6 w-6 text-memory-purple" />
                </div>
                <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
              </div>
              
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="font-medium mb-1">Who can see my memories?</h3>
                  <p className="text-sm text-muted-foreground">
                    Only people who are members of your board can see the memories in that board. For private boards, you control who joins. For public boards, anyone can join but they still need to have the link or find the board.
                  </p>
                </div>
                
                <div className="border-b pb-3">
                  <h3 className="font-medium mb-1">What happens if I leave a board?</h3>
                  <p className="text-sm text-muted-foreground">
                    If you leave a board, you'll no longer have access to its memories. If you're the last person to leave a board, the board and all its memories will be permanently deleted.
                  </p>
                </div>
                
                <div className="border-b pb-3">
                  <h3 className="font-medium mb-1">Can I edit or delete memories after posting?</h3>
                  <p className="text-sm text-muted-foreground">
                    Yes, you can edit or delete memories that you created. Just open the memory and use the edit or delete buttons in the top right corner.
                  </p>
                </div>
                
                <div className="border-b pb-3">
                  <h3 className="font-medium mb-1">What file types are supported?</h3>
                  <p className="text-sm text-muted-foreground">
                    For photos: JPG, PNG, GIF, and WebP. For videos: MP4, AVI, and WebM. There's a 10MB size limit for photos and 50MB for videos.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-1">Is my data secure?</h3>
                  <p className="text-sm text-muted-foreground">
                    Yes, we use industry-standard security practices to protect your data. All content is stored securely and only accessible to board members you've invited.
                  </p>
                </div>
              </div>
            </section>
            
            {/* Contact Support Section */}
            <section className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-memory-lightpurple p-3 rounded-full">
                  <MessageSquare className="h-6 w-6 text-memory-purple" />
                </div>
                <h2 className="text-xl font-semibold">Need More Help?</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
              If you have any questions or need assistance, our support team is here to help.
              </p>
              
              <Button 
                asChild
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
              >
                <a href="mailto:support@amity.space">
                  Contact Support
                </a>
              </Button>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default Help;