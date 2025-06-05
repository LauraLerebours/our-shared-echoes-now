import React from 'react';
import MemoryCard, { MemoryCardProps } from './MemoryCard';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export interface Memory {
  id: string;
  image: string;
  caption?: string;
  date: Date;
  location?: string;
  likes: number;
  isLiked: boolean;
  isVideo?: boolean;
  type: 'memory' | 'note';
  accessCode: string;
}

interface MemoryListProps {
  memories: Memory[];
  onDeleteMemory?: (id: string) => void;
}

const MemoryList: React.FC<MemoryListProps> = ({ memories, onDeleteMemory }) => {
  const navigate = useNavigate();
  
  const handleLike = (id: string) => {
    console.log(`Liked memory ${id}`);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/memory/${id}`);
  };

  const handleDelete = (id: string) => {
    if (onDeleteMemory) {
      onDeleteMemory(id);
      toast({
        title: "Memory deleted",
        description: "Your memory has been deleted successfully",
      });
    }
  };

  const sortedMemories = [...memories].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="px-4 pt-4 pb-20">
      {sortedMemories.map((memory) => (
        <MemoryCard
          key={memory.id}
          {...memory}
          onLike={handleLike}
          onViewDetail={handleViewDetail}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default MemoryList;