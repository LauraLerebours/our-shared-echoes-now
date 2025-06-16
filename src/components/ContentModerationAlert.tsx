import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ContentModerationAlertProps {
  error: string;
  variant?: 'default' | 'destructive';
}

const ContentModerationAlert: React.FC<ContentModerationAlertProps> = ({ 
  error, 
  variant = 'destructive' 
}) => {
  // Customize the message based on the error content
  let title = 'Content Moderation Error';
  let icon = <AlertTriangle className="h-4 w-4" />;
  
  if (error.includes('File size')) {
    title = 'File Too Large';
    icon = <Info className="h-4 w-4" />;
  } else if (error.includes('File type')) {
    title = 'Unsupported File Type';
    icon = <Info className="h-4 w-4" />;
  } else if (error.includes('inappropriate')) {
    title = 'Inappropriate Content Detected';
  }

  return (
    <Alert variant={variant} className="mb-4">
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {error}
      </AlertDescription>
    </Alert>
  );
};

export default ContentModerationAlert;