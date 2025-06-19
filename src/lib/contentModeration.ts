export interface ModerationResult {
  isAppropriate: boolean;
  confidence: number;
  categories: string[];
  reason?: string;
}

export interface ModerationResponse {
  success: boolean;
  result?: ModerationResult;
  error?: string;
}

// Content moderation using multiple approaches
export class ContentModerator {
  private static readonly INAPPROPRIATE_KEYWORDS = [
    // Violence
    'violence', 'kill', 'murder', 'death', 'blood', 'weapon', 'gun', 'knife', 'bomb',
    // Hate speech
    'hate', 'racist', 'nazi', 'terrorism', 'extremist',
    // Adult content
    'nude', 'naked', 'sex', 'porn', 'adult', 'explicit',
    // Drugs
    'drug', 'cocaine', 'heroin', 'marijuana', 'weed', 'meth',
    // Self-harm
    'suicide', 'self-harm', 'cutting', 'depression'
  ];

  private static readonly SPAM_PATTERNS = [
    /(.)\1{10,}/, // Repeated characters
    /https?:\/\/[^\s]+/gi, // URLs
    /\b\d{10,}\b/g, // Long numbers (phone numbers)
    /[A-Z]{5,}/g, // All caps words
  ];

  // Text content moderation
  static async moderateText(text: string): Promise<ModerationResult> {
    if (!text || text.trim().length === 0) {
      return {
        isAppropriate: true,
        confidence: 1.0,
        categories: []
      };
    }

    const normalizedText = text.toLowerCase().trim();
    const flaggedCategories: string[] = [];
    let confidence = 1.0;

    // Check for inappropriate keywords
    for (const keyword of this.INAPPROPRIATE_KEYWORDS) {
      if (normalizedText.includes(keyword)) {
        flaggedCategories.push('inappropriate_content');
        confidence = Math.min(confidence, 0.3);
      }
    }

    // Check for spam patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(text)) {
        flaggedCategories.push('spam');
        confidence = Math.min(confidence, 0.5);
      }
    }

    // Check text length (very long texts might be spam)
    if (text.length > 5000) {
      flaggedCategories.push('spam');
      confidence = Math.min(confidence, 0.6);
    }

    // Check for excessive profanity (basic check)
    const profanityCount = (normalizedText.match(/\b(damn|hell|crap|stupid|idiot)\b/g) || []).length;
    if (profanityCount > 3) {
      flaggedCategories.push('profanity');
      confidence = Math.min(confidence, 0.7);
    }

    const isAppropriate = flaggedCategories.length === 0;

    return {
      isAppropriate,
      confidence,
      categories: flaggedCategories,
      reason: !isAppropriate ? `Content flagged for: ${flaggedCategories.join(', ')}` : undefined
    };
  }

  // Image content moderation (client-side basic checks)
  static async moderateImage(file: File): Promise<ModerationResult> {
    try {
      // Basic file validation
      if (!file.type.startsWith('image/')) {
        return {
          isAppropriate: false,
          confidence: 1.0,
          categories: ['invalid_format'],
          reason: 'File is not a valid image format'
        };
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return {
          isAppropriate: false,
          confidence: 1.0,
          categories: ['file_too_large'],
          reason: 'Image file size exceeds 10MB limit'
        };
      }

      // Check for suspicious file names
      const suspiciousPatterns = [
        /virus/i, /malware/i, /hack/i, /exploit/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(file.name)) {
          return {
            isAppropriate: false,
            confidence: 0.8,
            categories: ['suspicious_filename'],
            reason: 'Suspicious filename detected'
          };
        }
      }

      // Basic image analysis using Canvas API
      const imageAnalysis = await this.analyzeImageBasic(file);
      
      return {
        isAppropriate: imageAnalysis.isAppropriate,
        confidence: imageAnalysis.confidence,
        categories: imageAnalysis.categories,
        reason: imageAnalysis.reason
      };

    } catch (error) {
      console.error('Error moderating image:', error);
      return {
        isAppropriate: false,
        confidence: 0.5,
        categories: ['analysis_error'],
        reason: 'Unable to analyze image content'
      };
    }
  }

  // Video content moderation (client-side basic checks)
  static async moderateVideo(file: File): Promise<ModerationResult> {
    try {
      // Basic file validation
      if (!file.type.startsWith('video/')) {
        return {
          isAppropriate: false,
          confidence: 1.0,
          categories: ['invalid_format'],
          reason: 'File is not a valid video format'
        };
      }

      // Check file size (max 50MB for videos)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        return {
          isAppropriate: false,
          confidence: 1.0,
          categories: ['file_too_large'],
          reason: 'Video file size exceeds 50MB limit'
        };
      }

      // Check video duration (max 5 minutes)
      const duration = await this.getVideoDuration(file);
      if (duration > 300) { // 5 minutes
        return {
          isAppropriate: false,
          confidence: 1.0,
          categories: ['duration_too_long'],
          reason: 'Video duration exceeds 5 minute limit'
        };
      }

      // Check for suspicious file names
      const suspiciousPatterns = [
        /virus/i, /malware/i, /hack/i, /exploit/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(file.name)) {
          return {
            isAppropriate: false,
            confidence: 0.8,
            categories: ['suspicious_filename'],
            reason: 'Suspicious filename detected'
          };
        }
      }

      return {
        isAppropriate: true,
        confidence: 0.8,
        categories: []
      };

    } catch (error) {
      console.error('Error moderating video:', error);
      return {
        isAppropriate: false,
        confidence: 0.5,
        categories: ['analysis_error'],
        reason: 'Unable to analyze video content'
      };
    }
  }

  // Basic image analysis using Canvas API
  private static async analyzeImageBasic(file: File): Promise<ModerationResult> {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
          // Set canvas size
          canvas.width = Math.min(img.width, 200);
          canvas.height = Math.min(img.height, 200);

          // Draw image to canvas
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Get image data
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          
          if (!imageData) {
            resolve({
              isAppropriate: false,
              confidence: 0.5,
              categories: ['analysis_error'],
              reason: 'Unable to analyze image data'
            });
            return;
          }

          // Basic analysis - check for predominantly dark images (might indicate inappropriate content)
          const pixels = imageData.data;
          let darkPixels = 0;
          let totalPixels = pixels.length / 4;

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const brightness = (r + g + b) / 3;
            
            if (brightness < 50) {
              darkPixels++;
            }
          }

          const darkRatio = darkPixels / totalPixels;

          // If image is more than 80% dark, flag for review
          if (darkRatio > 0.8) {
            resolve({
              isAppropriate: false,
              confidence: 0.6,
              categories: ['suspicious_content'],
              reason: 'Image appears to be predominantly dark or corrupted'
            });
            return;
          }

          resolve({
            isAppropriate: true,
            confidence: 0.7,
            categories: []
          });

        } catch (error) {
          resolve({
            isAppropriate: false,
            confidence: 0.5,
            categories: ['analysis_error'],
            reason: 'Error analyzing image content'
          });
        }
      };

      img.onerror = () => {
        resolve({
          isAppropriate: false,
          confidence: 1.0,
          categories: ['invalid_image'],
          reason: 'Unable to load image file'
        });
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Get video duration
  private static async getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        resolve(0);
        URL.revokeObjectURL(video.src);
      };

      video.src = URL.createObjectURL(file);
    });
  }

  // Comprehensive moderation for memory content
  static async moderateMemory(
    caption: string,
    file?: File,
    memoryType?: 'photo' | 'video' | 'note'
  ): Promise<ModerationResponse> {
    try {
      const results: ModerationResult[] = [];

      // Always moderate text content (caption)
      if (caption && caption.trim()) {
        const textResult = await this.moderateText(caption);
        results.push(textResult);
      }

      // Moderate file content based on type
      if (file && memoryType) {
        let fileResult: ModerationResult;
        
        if (memoryType === 'photo') {
          fileResult = await this.moderateImage(file);
        } else if (memoryType === 'video') {
          fileResult = await this.moderateVideo(file);
        } else {
          // For notes, no file moderation needed
          fileResult = { isAppropriate: true, confidence: 1.0, categories: [] };
        }
        
        results.push(fileResult);
      }

      // Combine results - content is appropriate only if ALL checks pass
      const isAppropriate = results.every(result => result.isAppropriate);
      const minConfidence = Math.min(...results.map(result => result.confidence));
      const allCategories = results.flatMap(result => result.categories);
      const reasons = results.filter(result => result.reason).map(result => result.reason);

      return {
        success: true,
        result: {
          isAppropriate,
          confidence: minConfidence,
          categories: [...new Set(allCategories)], // Remove duplicates
          reason: reasons.length > 0 ? reasons.join('; ') : undefined
        }
      };

    } catch (error) {
      console.error('Error in content moderation:', error);
      return {
        success: false,
        error: 'Content moderation failed'
      };
    }
  }
}

// Rate limiting for moderation requests
export class ModerationRateLimit {
  private static requests: Map<string, number[]> = new Map();
  private static readonly MAX_REQUESTS_PER_MINUTE = 10;

  static canMakeRequest(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove requests older than 1 minute
    const recentRequests = userRequests.filter(timestamp => now - timestamp < 60000);
    
    // Update the requests for this user
    this.requests.set(userId, recentRequests);
    
    return recentRequests.length < this.MAX_REQUESTS_PER_MINUTE;
  }

  static recordRequest(userId: string): void {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    userRequests.push(now);
    this.requests.set(userId, userRequests);
  }
}