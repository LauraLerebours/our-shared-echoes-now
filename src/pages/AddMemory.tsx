
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ArrowLeft, Calendar as CalendarIcon, MapPin, Image } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const AddMemory = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the data to an API
    console.log({ date, caption, location, image: previewImage });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        
        <h1 className="text-lg font-medium">Add New Memory</h1>
        
        <Button 
          size="sm" 
          onClick={handleSubmit}
          disabled={!previewImage}
          className="bg-memory-purple hover:bg-memory-purple/90"
        >
          Save
        </Button>
      </header>
      
      <main className="flex-1 p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={cn(
            "border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-6 relative",
            previewImage ? "border-none p-0" : "border-memory-purple/30 bg-memory-lightpurple/20"
          )}>
            {previewImage ? (
              <div className="relative w-full">
                <img 
                  src={previewImage} 
                  alt="Memory preview" 
                  className="w-full aspect-[4/3] object-cover rounded-lg" 
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-4 right-4"
                  onClick={() => setPreviewImage(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Image className="h-12 w-12 text-memory-purple/50 mb-3" />
                <p className="text-muted-foreground mb-4 text-center">
                  Tap to add a photo for this memory
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="relative bg-white"
                >
                  Select Photo
                  <Input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImageChange}
                  />
                </Button>
              </>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="caption" className="block text-sm font-medium text-muted-foreground mb-1">
                Caption
              </label>
              <Textarea
                id="caption"
                placeholder="Write something about this memory..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-muted-foreground mb-1">
                Location (optional)
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="Add a location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AddMemory;
