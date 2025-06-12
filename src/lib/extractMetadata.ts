import exifr from 'exifr';

export interface PhotoMetadata {
  date?: Date;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export async function extractPhotoMetadata(file: File): Promise<PhotoMetadata> {
  try {
    // Extract EXIF data from the image
    const exifData = await exifr.parse(file, {
      gps: true,
      pick: ['DateTimeOriginal', 'DateTime', 'CreateDate', 'latitude', 'longitude']
    });

    if (!exifData) {
      return {};
    }

    const metadata: PhotoMetadata = {};

    // Extract date information
    const dateFields = ['DateTimeOriginal', 'DateTime', 'CreateDate'];
    for (const field of dateFields) {
      if (exifData[field]) {
        metadata.date = new Date(exifData[field]);
        break;
      }
    }

    // Extract GPS coordinates
    if (exifData.latitude && exifData.longitude) {
      metadata.coordinates = {
        latitude: exifData.latitude,
        longitude: exifData.longitude
      };

      // Try to get a readable location name from coordinates
      try {
        const locationName = await reverseGeocode(exifData.latitude, exifData.longitude);
        if (locationName) {
          metadata.location = locationName;
        }
      } catch (error) {
        console.warn('Failed to reverse geocode coordinates:', error);
        // Fallback to showing coordinates
        metadata.location = `${exifData.latitude.toFixed(6)}, ${exifData.longitude.toFixed(6)}`;
      }
    }

    return metadata;
  } catch (error) {
    console.warn('Failed to extract metadata from image:', error);
    return {};
  }
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Using a free geocoding service (OpenStreetMap Nominatim)
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
      // Try to extract a meaningful location name
      const address = data.address;
      if (address) {
        const parts = [];
        
        // Add city/town/village
        if (address.city) parts.push(address.city);
        else if (address.town) parts.push(address.town);
        else if (address.village) parts.push(address.village);
        
        // Add state/region
        if (address.state) parts.push(address.state);
        
        // Add country
        if (address.country) parts.push(address.country);
        
        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      
      // Fallback to display name, but truncate if too long
      const displayName = data.display_name;
      if (displayName.length > 50) {
        return displayName.substring(0, 47) + '...';
      }
      return displayName;
    }

    return null;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}