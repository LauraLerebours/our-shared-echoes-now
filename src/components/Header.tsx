
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from 'lucide-react';

const Header = () => {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
      <Avatar className="h-9 w-9 border-2 border-memory-purple">
        <AvatarFallback className="bg-memory-lightpurple text-memory-purple">US</AvatarFallback>
        <AvatarImage src="/placeholder.svg" />
      </Avatar>
      
      <h1 className="text-xl font-semibold text-center bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent">
        Our Story
      </h1>
      
      <Button variant="ghost" size="icon" asChild className="text-memory-purple hover:text-memory-pink hover:bg-memory-lightpurple">
        <Link to="/add">
          <Plus className="h-5 w-5" />
        </Link>
      </Button>
    </header>
  );
};

export default Header;
