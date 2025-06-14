// Centralized type definitions
export interface Memory {
  id: string;
  image: string;
  caption?: string;
  date: Date;
  location?: string;
  likes: number;
  isLiked: boolean;
  isVideo?: boolean;
  type: 'memory';
  accessCode: string;
  createdBy?: string;
}

export interface Board {
  id: string;
  name: string;
  created_at: string;
  access_code: string;
  owner_id?: string;
  share_code: string;
  member_ids?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Comment {
  id: string;
  memory_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    name: string;
  };
  replies?: Comment[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LikeResponse {
  success: boolean;
  likes: number;
  isLiked: boolean;
}

export interface BoardOperationResponse {
  success: boolean;
  message: string;
  newName?: string;
  board?: Board;
}