// src/middleware/upload.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// File type validation
const allowedMimeTypes = [
  // Images
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];

const allowedExtensions = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'
];

// File filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
};

// Generate unique filename
const generateFileName = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString('hex');
  const ext = path.extname(originalname);
  const name = path.basename(originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
  return `${timestamp}_${randomString}_${name}${ext}`;
};

// S3 storage configuration
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET,
  acl: 'private', // Keep files private
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const folder = getUploadFolder(file.fieldname);
    const fileName = generateFileName(file.originalname);
    cb(null, `${folder}/${fileName}`);
  },
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      originalName: file.originalname,
      uploadedBy: req.admin ? req.admin._id.toString() : 'system',
      uploadedAt: new Date().toISOString()
    });
  }
});

// Determine upload folder based on field name
const getUploadFolder = (fieldname) => {
  switch (fieldname) {
    case 'profilePhoto':
      return 'customers/profile-photos';
    case 'documents':
      return 'customers/documents';
    case 'additionalDocuments':
      return 'customers/additional-documents';
    default:
      return 'customers/misc';
  }
};

// Multer configuration for customer documents
const uploadCustomerDocuments = multer({
  storage: s3Storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 10 // 10 files max
  }
});

// Middleware for different upload types
const uploadMiddleware = {
  // Single profile photo
  profilePhoto: uploadCustomerDocuments.single('profilePhoto'),
  
  // Multiple documents (up to 10)
  documents: uploadCustomerDocuments.array('documents', 10),
  
  // Multiple additional documents (up to 5)
  additionalDocuments: uploadCustomerDocuments.array('additionalDocuments', 5),
  
  // Mixed uploads for customer creation
  customerDocuments: uploadCustomerDocuments.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 },
    { name: 'additionalDocuments', maxCount: 5 }
  ])
};

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large',
        details: `Maximum file size is ${process.env.MAX_FILE_SIZE || 5242880} bytes (5MB)`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files',
        details: 'Maximum 10 files allowed per request'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field',
        details: 'Invalid file field name'
      });
    }
  }
  
  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type',
      details: err.message
    });
  }
  
  console.error('Upload error:', err);
  return res.status(500).json({
    success: false,
    message: 'File upload failed',
    details: 'Please try again later'
  });
};

// Utility function to generate signed URL for file access
const generateSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expiresIn // 1 hour default
    };
    
    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
};

// Utility function to delete file from S3
const deleteFileFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    console.log(`File deleted successfully: ${key}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

// Utility function to compress images before upload (for profile photos)
const compressImage = async (buffer, quality = 80) => {
  try {
    return await sharp(buffer)
      .jpeg({ quality })
      .resize(800, 800, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toBuffer();
  } catch (error) {
    console.error('Error compressing image:', error);
    return buffer; // Return original if compression fails
  }
};

// Middleware to log file uploads (for monitoring)
const logFileUpload = (req, res, next) => {
  if (req.files || req.file) {
    const files = req.files || [req.file];
    const totalSize = Array.isArray(files) 
      ? files.reduce((sum, file) => sum + (file.size || 0), 0)
      : files.size || 0;
    
    console.log(`File upload - User: ${req.admin?._id}, Files: ${Array.isArray(files) ? files.length : 1}, Total Size: ${totalSize} bytes`);
  }
  next();
};

module.exports = {
  uploadMiddleware,
  handleUploadError,
  generateSignedUrl,
  deleteFileFromS3,
  compressImage,
  logFileUpload,
  s3
};