import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHelmetProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  type?: 'website' | 'article';
  articlePublishedTime?: string;
  keywords?: string[];
}

const SEOHelmet: React.FC<SEOHelmetProps> = ({
  title = 'This Is Us - Shared Memories App for Couples & Friends',
  description = 'Create beautiful memory boards with your loved ones. Share photos, videos, and notes in a private, collaborative space designed for couples and friends.',
  canonicalUrl = 'https://thisisus.space',
  imageUrl = 'https://thisisus.space/best.png',
  type = 'website',
  articlePublishedTime,
  keywords = ['shared memories', 'couples app', 'photo sharing', 'memory boards', 'collaborative albums', 'relationship app'],
}) => {
  const fullTitle = title.includes('This Is Us') ? title : `${title} | This Is Us`;
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="This Is Us" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {/* Article specific meta tags */}
      {type === 'article' && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
    </Helmet>
  );
};

export default SEOHelmet;