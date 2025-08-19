// services/s3Service.js
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/aws');

const generateSignedUrl = async (s3Key, expiresIn = 3600) => {
  try {
    if (!s3Key) return null;
    
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    });
    
    // Generate signed URL with longer expiration (24 hours default)
    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: expiresIn || 86400 // 24 hours default
    });
    
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

const extractS3Key = (s3Url) => {
  if (!s3Url) return null;
  
  try {
    // Remove any query parameters (access tokens) first
    const urlWithoutParams = s3Url.split('?')[0];
    
    // Handle different S3 URL formats
    let s3Key;
    
    // Format 1: https://bucket.s3.region.amazonaws.com/key
    if (urlWithoutParams.includes(`${process.env.AWS_S3_BUCKET}.s3.`)) {
      s3Key = urlWithoutParams.replace(`https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`, '');
    }
    // Format 2: https://s3.region.amazonaws.com/bucket/key
    else if (urlWithoutParams.includes('s3.')) {
      const parts = urlWithoutParams.split(`${process.env.AWS_S3_BUCKET}/`);
      s3Key = parts[1] || parts[0].split('/').pop();
    }
    // Format 3: Just the key itself
    else if (!urlWithoutParams.startsWith('http')) {
      s3Key = urlWithoutParams;
    }
    else {
      // Fallback: extract everything after the last /
      s3Key = urlWithoutParams.split('/').pop();
    }
    
    return decodeURIComponent(s3Key);
  } catch (error) {
    console.error('Error extracting S3 key:', error);
    return null;
  }
};

// Utility function to delete multiple files from S3
const deleteMultipleFilesFromS3 = async (s3Keys) => {
  if (!s3Keys || s3Keys.length === 0) return [];

  const deletePromises = s3Keys.map(async (key) => {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      });
      
      await s3Client.send(command);
      console.log(`File deleted successfully: ${key}`);
      return { key, success: true };
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      return { key, success: false, error: error.message };
    }
  });

  return Promise.all(deletePromises);
};

// Enhanced S3 key extraction that handles signed URLs better
const extractS3KeyEnhanced = (s3Url) => {
  if (!s3Url) return null;
  
  try {
    // Remove any query parameters (signed URL parameters) first
    const urlWithoutParams = s3Url.split('?')[0];
    
    // Handle different S3 URL formats
    let s3Key;
    
    // Format 1: https://bucket.s3.region.amazonaws.com/key
    if (urlWithoutParams.includes(`${process.env.AWS_S3_BUCKET}.s3.`)) {
      s3Key = urlWithoutParams.replace(`https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`, '');
    }
    // Format 2: https://s3.region.amazonaws.com/bucket/key
    else if (urlWithoutParams.includes('s3.')) {
      const parts = urlWithoutParams.split(`${process.env.AWS_S3_BUCKET}/`);
      s3Key = parts[1] || parts[0].split('/').pop();
    }
    // Format 3: Just the key itself
    else if (!urlWithoutParams.startsWith('http')) {
      s3Key = urlWithoutParams;
    }
    else {
      // Fallback: extract everything after the bucket name
      const urlParts = urlWithoutParams.split('/');
      const bucketIndex = urlParts.findIndex(part => part.includes(process.env.AWS_S3_BUCKET));
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        s3Key = urlParts.slice(bucketIndex + 1).join('/');
      } else {
        s3Key = urlParts[urlParts.length - 1];
      }
    }
    
    return decodeURIComponent(s3Key);
  } catch (error) {
    console.error('Error extracting S3 key:', error);
    return null;
  }
};

module.exports = {
  generateSignedUrl,
  extractS3Key,
  deleteMultipleFilesFromS3,
  extractS3KeyEnhanced
};