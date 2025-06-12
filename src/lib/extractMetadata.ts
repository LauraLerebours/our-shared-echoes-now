import { parse } from 'exifr';

export interface ImageMetadata {
  dateTaken?: Date;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  camera?: {
    make?: string;
    model?: string;
  };
}

export async function extractImageMetadata(file: File): Promise<ImageMetadata> {
  try {
    // Only process image files
    if (!file.type.startsWith('image/')) {
      return {};
    }

    // Parse EXIF data from the image
    const exifData = await parse(file, {
      // Specify which tags we want to extract
      pick: [
        'DateTimeOriginal',
        'DateTime', 
        'CreateDate',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'Make',
        'Model'
      ]
    });

    if (!exifData) {
      return {};
    }

    const metadata: ImageMetadata = {};

    // Extract date taken (try multiple date fields)
    const dateTaken = exifData.DateTimeOriginal || 
                     exifData.DateTime || 
                     exifData.CreateDate;
    
    if (dateTaken) {
      metadata.dateTaken = new Date(dateTaken);
    }

    // Extract GPS coordinates
    if (exifData.GPSLatitude && exifData.GPSLongitude) {
      let latitude = exifData.GPSLatitude;
      let longitude = exifData.GPSLongitude;

      // Handle GPS reference (N/S for latitude, E/W for longitude)
      if (exifData.GPSLatitudeRef === 'S') {
        latitude = -latitude;
      }
      if (exifData.GPSLongitudeRef === 'W') {
        longitude = -longitude;
      }

      metadata.location = {
        latitude,
        longitude
      };

      // Try to get address from coordinates using reverse geocoding
      try {
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          metadata.location.address = address;
        }
      } catch (error) {
        console.warn('Failed to get address from coordinates:', error);
      }
    }

    // Extract camera information
    if (exifData.Make || exifData.Model) {
      metadata.camera = {
        make: exifData.Make,
        model: exifData.Model
      };
    }

    return metadata;
  } catch (error) {
    console.warn('Failed to extract metadata from image:', error);
    return {};
  }
}

// Simple reverse geocoding using a free service
async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Using OpenStreetMap's Nominatim service (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ThisIsUs-MemoryApp/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    
    if (data && data.display_name) {
      // Extract a simplified address (city, state/country)
      const address = data.address;
      if (address) {
        const parts = [];
        
        if (address.city || address.town || address.village) {
          parts.push(address.city || address.town || address.village);
        }
        
        if (address.state) {
          parts.push(address.state);
        } else if (address.country) {
          parts.push(address.country);
        }
        
        return parts.join(', ');
      }
      
      // Fallback to display name, but truncate if too long
      return data.display_name.length > 50 
        ? data.display_name.substring(0, 50) + '...'
        : data.display_name;
    }

    return null;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}

// Extract metadata from video files (limited support)
export async function extractVideoMetadata(file: File): Promise<ImageMetadata> {
  try {
    // For video files, we can only extract basic file metadata
    // Most browsers don't support reading video EXIF data directly
    
    const metadata: ImageMetadata = {};
    
    // Use file's last modified date as fallback
    if (file.lastModified) {
      metadata.dateTaken = new Date(file.lastModified);
    }

    return metadata;
  } catch (error) {
    console.warn('Failed to extract metadata from video:', error);
    return {};
  }
}