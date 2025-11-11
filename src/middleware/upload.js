// src/middleware/upload.js - FIXED VERSION FOR AWS SDK v3
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client } = require('../config/aws'); // Import the v3 client
const { S3Client, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');

// File type validation - Enhanced for customer documents
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

// Enhanced file filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check MIME type and extension
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${ext}. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
};

// Generate unique filename with customer context
const generateFileName = (originalname, fieldname, customerId = null) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString('hex');
  const ext = path.extname(originalname);
  const name = path.basename(originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
  
  // Include customer ID in filename if available
  const prefix = customerId ? `${customerId}_` : '';
  return `${prefix}${timestamp}_${randomString}_${name}${ext}`;
};

// Determine upload folder based on field name and file type
const getUploadFolder = (fieldname, filename) => {
  const baseFolder = 'customers';
  
  switch (fieldname) {
    case 'profilePhoto':
      return `${baseFolder}/profile-photos`;
    case 'documents':
    case 'newDocuments': // Add this for new documents during update
      return `${baseFolder}/documents`;
    case 'additionalDocuments':
    case 'newAdditionalDocuments':
      return `${baseFolder}/additional-documents`;
    case 'policyFile':
      // Determine if it's life or health insurance based on request path
      if (filename.includes('health') || fieldname.includes('health')) {
        return 'health-insurance/policy-files';
      }
      return 'life-insurance/policy-files';
    case 'uploadDocuments':
    case 'newUploadDocuments':
      // Determine if it's life or health insurance based on request path
      if (filename.includes('health') || fieldname.includes('health')) {
        return 'health-insurance/documents';
      }
      return 'life-insurance/documents';
    default:
      // FIXED: Don't use misc folder, use documents as fallback
      return `${baseFolder}/documents`;
  }
};

// S3 storage configuration for customer documents - FIXED FOR v3
const s3Storage = multerS3({
  s3: s3Client, // Use the v3 client
  bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
  acl: 'private', // Keep files private
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const folder = getUploadFolder(file.fieldname, file.originalname);
    const fileName = generateFileName(file.originalname, file.fieldname, req.body.customerId);
    const fullPath = `${folder}/${fileName}`;

    console.log(`Uploading file to S3: ${fullPath}`);
    cb(null, fullPath);
  },
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      originalName: file.originalname,
      uploadedBy: req.admin ? req.admin._id.toString() : 'system',
      uploadedAt: new Date().toISOString(),
      customerId: req.body.customerId || 'unknown'
    });
  }
});

// S3 storage configuration for health insurance documents - FIXED FOR v3
const s3StorageHealthInsurance = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
  acl: 'private',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    let folder;
    if (file.fieldname === 'policyFile') {
      folder = 'health-insurance/policy-files';
    } else {
      folder = 'health-insurance/documents';
    }
    const fileName = generateFileName(file.originalname, file.fieldname, req.body.customerId);
    const fullPath = `${folder}/${fileName}`;

    console.log(`Uploading health insurance file to S3: ${fullPath}`);
    cb(null, fullPath);
  },
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      originalName: file.originalname,
      uploadedBy: req.admin ? req.admin._id.toString() : 'system',
      uploadedAt: new Date().toISOString(),
      customerId: req.body.customerId || 'unknown',
      insuranceType: 'health'
    });
  }
});

// S3 storage configuration for vehicle insurance documents - FIXED FOR v3
const s3StorageVehicleInsurance = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
  acl: 'private',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    let folder;
    if (file.fieldname === 'policyFile') {
      folder = 'vehicle-insurance/policy-files';
    } else {
      folder = 'vehicle-insurance/documents';
    }
    const fileName = generateFileName(file.originalname, file.fieldname, req.body.customerId);
    const fullPath = `${folder}/${fileName}`;

    console.log(`Uploading vehicle insurance file to S3: ${fullPath}`);
    cb(null, fullPath);
  },
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      originalName: file.originalname,
      uploadedBy: req.admin ? req.admin._id.toString() : 'system',
      uploadedAt: new Date().toISOString(),
      customerId: req.body.customerId || 'unknown',
      insuranceType: 'vehicle'
    });
  }
});

// Enhanced multer configuration for customer documents
const uploadCustomerDocuments = multer({
  storage: s3Storage,
  fileFilter: (req, file, cb) => {
    const allowedFields = ['profilePhoto', 'documents', 'additionalDocuments', 'newDocuments', 'newAdditionalDocuments'];
    
    if (!allowedFields.includes(file.fieldname)) {
      const error = new Error('Unexpected file field');
      error.code = 'INVALID_FIELD';
      error.details = `Invalid file field name. Use: ${allowedFields.join(', ')}`;
      return cb(error, false);
    }

    // Allow images and documents
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      error.details = 'Only images (JPEG, PNG) and documents (PDF, DOC, DOCX) are allowed';
      cb(error, false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 15 // Increased for customer docs
  }
});

// Enhanced multer configuration for life insurance documents
const uploadLifeInsuranceDocuments = multer({
  storage: s3Storage,
  fileFilter: (req, file, cb) => {
    const allowedFields = ['policyFile', 'uploadDocuments', 'newUploadDocuments'];

    if (!allowedFields.includes(file.fieldname)) {
      const error = new Error('Unexpected file field');
      error.code = 'INVALID_FIELD';
      error.details = `Invalid file field name. Use: ${allowedFields.join(', ')}`;
      return cb(error, false);
    }

    // Allow images and documents
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      error.details = 'Only images (JPEG, PNG) and documents (PDF, DOC, DOCX) are allowed';
      cb(error, false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 15 // Increased for life insurance docs
  }
});

// Enhanced multer configuration for health insurance documents
const uploadHealthInsuranceDocuments = multer({
  storage: s3StorageHealthInsurance,
  fileFilter: (req, file, cb) => {
    const allowedFields = ['policyFile', 'uploadDocuments', 'newUploadDocuments'];

    if (!allowedFields.includes(file.fieldname)) {
      const error = new Error('Unexpected file field');
      error.code = 'INVALID_FIELD';
      error.details = `Invalid file field name. Use: ${allowedFields.join(', ')}`;
      return cb(error, false);
    }

    // Allow images and documents
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      error.details = 'Only images (JPEG, PNG) and documents (PDF, DOC, DOCX) are allowed';
      cb(error, false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 15 // Increased for health insurance docs
  }
});

// Enhanced multer configuration for vehicle insurance documents
const uploadVehicleInsuranceDocuments = multer({
  storage: s3StorageVehicleInsurance,
  fileFilter: (req, file, cb) => {
    const allowedFields = ['policyFile', 'uploadDocuments', 'newUploadDocuments'];

    if (!allowedFields.includes(file.fieldname)) {
      const error = new Error('Unexpected file field');
      error.code = 'INVALID_FIELD';
      error.details = `Invalid file field name. Use: ${allowedFields.join(', ')}`;
      return cb(error, false);
    }

    // Allow images and documents
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      error.details = 'Only images (JPEG, PNG) and documents (PDF, DOC, DOCX) are allowed';
      cb(error, false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 15 // Increased for vehicle insurance docs
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
  
  // Mixed uploads for customer creation/update
  customerDocuments: uploadCustomerDocuments.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 },
    { name: 'additionalDocuments', maxCount: 5 },
    { name: 'newDocuments', maxCount: 10 },
    { name: 'newAdditionalDocuments', maxCount: 10 }
  ]),
  
  // Life insurance document uploads
  lifeInsuranceDocuments: uploadLifeInsuranceDocuments.fields([
    { name: 'policyFile', maxCount: 1 },
    { name: 'uploadDocuments', maxCount: 10 },
    { name: 'newUploadDocuments', maxCount: 10 }
  ]),

  // Health insurance document uploads
  healthInsuranceDocuments: uploadHealthInsuranceDocuments.fields([
    { name: 'policyFile', maxCount: 1 },
    { name: 'uploadDocuments', maxCount: 10 },
    { name: 'newUploadDocuments', maxCount: 10 }
  ]),

  // Vehicle insurance document uploads
  vehicleInsuranceDocuments: uploadVehicleInsuranceDocuments.fields([
    { name: 'policyFile', maxCount: 1 },
    { name: 'uploadDocuments', maxCount: 10 },
    { name: 'newUploadDocuments', maxCount: 10 }
  ])
};

// Enhanced error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large',
        details: `Maximum file size is ${process.env.MAX_FILE_SIZE || 5242880} bytes (5MB)`,
        errorCode: 'FILE_TOO_LARGE'
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files',
        details: 'Maximum 15 files allowed per request',
        errorCode: 'TOO_MANY_FILES'
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field',
        details: 'Invalid file field name. Use: profilePhoto, documents, or additionalDocuments',
        errorCode: 'INVALID_FIELD'
      });
    }
  }
  
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type',
      details: err.message,
      errorCode: 'INVALID_FILE_TYPE'
    });
  }
  
  // AWS S3 errors
  if (err.code === 'NoSuchBucket') {
    console.error('S3 Bucket not found:', err);
    return res.status(500).json({
      success: false,
      message: 'Storage configuration error',
      details: 'Please contact administrator',
      errorCode: 'STORAGE_ERROR'
    });
  }
  
  if (err.code === 'AccessDenied') {
    console.error('S3 Access denied:', err);
    return res.status(500).json({
      success: false,
      message: 'Storage access denied',
      details: 'Please contact administrator',
      errorCode: 'STORAGE_ACCESS_DENIED'
    });
  }
  
  console.error('Upload error:', err);
  return res.status(500).json({
    success: false,
    message: 'File upload failed',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
    errorCode: 'UPLOAD_FAILED'
  });
};

// Utility function to generate signed URL for file access - FIXED FOR v3
const generateSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Key: key,
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate file access URL');
  }
};

// Utility function to delete file from S3 - FIXED FOR v3
const deleteFileFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Key: key
    });
    
    await s3Client.send(command);
    console.log(`File deleted successfully: ${key}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error(`Failed to delete file: ${key}`);
  }
};

// Utility function to check if file exists in S3 - FIXED FOR v3
const fileExistsInS3 = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Key: key
    });
    
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

// Utility function to get file metadata from S3 - FIXED FOR v3
const getFileMetadata = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Key: key
    });
    
    const result = await s3Client.send(command);
    return {
      size: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType,
      metadata: result.Metadata
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw new Error(`Failed to get file metadata: ${key}`);
  }
};

// Utility function to list files in a folder - FIXED FOR v3
const listFilesInFolder = async (folderPath, maxKeys = 1000) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Prefix: folderPath,
      MaxKeys: maxKeys
    });
    
    const result = await s3Client.send(command);
    return result.Contents?.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
    })) || [];
  } catch (error) {
    console.error('Error listing files:', error);
    throw new Error(`Failed to list files in folder: ${folderPath}`);
  }
};

// Middleware to log file uploads (for monitoring and debugging)
const logFileUpload = (req, res, next) => {
  if (req.files || req.file) {
    const files = req.files || [req.file];
    let totalSize = 0;
    let fileDetails = [];

    if (Array.isArray(files)) {
      // Handle array of files
      totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      fileDetails = files.map(file => ({
        fieldname: file.fieldname,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }));
    } else if (typeof files === 'object') {
      // Handle multer fields() result
      Object.keys(files).forEach(fieldname => {
        files[fieldname].forEach(file => {
          totalSize += file.size || 0;
          fileDetails.push({
            fieldname: file.fieldname,
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype
          });
        });
      });
    } else {
      // Handle single file
      totalSize = files.size || 0;
      fileDetails = [{
        fieldname: files.fieldname,
        originalname: files.originalname,
        size: files.size,
        mimetype: files.mimetype
      }];
    }
    
    console.log(`File upload - User: ${req.admin?._id}, Files: ${fileDetails.length}, Total Size: ${totalSize} bytes`, {
      files: fileDetails,
      customerId: req.body.customerId,
      ip: req.ip
    });
  }
  next();
};

// Clean up temporary files (utility function for scheduled tasks) - FIXED FOR v3
const cleanupTempFiles = async (olderThanDays = 7) => {
  try {
    const tempFolder = 'temp/';
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Prefix: tempFolder
    });
    
    const result = await s3Client.send(listCommand);
    const filesToDelete = result.Contents?.filter(item => 
      new Date(item.LastModified) < cutoffDate
    ) || [];
    
    if (filesToDelete.length > 0) {
      const deletePromises = filesToDelete.map(item => {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
          Key: item.Key
        });
        return s3Client.send(deleteCommand);
      });
      
      await Promise.all(deletePromises);
      console.log(`Cleaned up ${filesToDelete.length} temporary files`);
    }
    
    return filesToDelete.length;
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
    throw error;
  }
};

// Validate S3 configuration on startup - FIXED FOR v3
const validateS3Config = async () => {
  try {
    console.log('Validating S3 configuration...');
    
    // Check if bucket exists and we have access
    const headCommand = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'seva-consultancy-documents',
      Key: 'test-connection' // This will fail but tells us if bucket exists
    });
    
    try {
      await s3Client.send(headCommand);
    } catch (error) {
      // If it's just that the object doesn't exist, that's fine
      if (error.name === 'NotFound') {
        console.log('✅ S3 bucket exists and is accessible');
      } else if (error.name === 'NoSuchBucket') {
        throw new Error('S3 bucket does not exist');
      } else {
        throw error;
      }
    }
    
    console.log('✅ S3 configuration is valid');
  } catch (error) {
    console.error('❌ S3 configuration error:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.error('💡 Bucket does not exist. Please create it first.');
    } else if (error.name === 'AccessDenied') {
      console.error('💡 Access denied. Please check your AWS credentials and bucket policy.');
    } else if (error.name === 'CredentialsError') {
      console.error('💡 Invalid AWS credentials. Please check your environment variables.');
    }
    
    throw error;
  }
};

module.exports = {
  uploadMiddleware,
  handleUploadError,
  generateSignedUrl,
  deleteFileFromS3,
  fileExistsInS3,
  getFileMetadata,
  listFilesInFolder,
  logFileUpload,
  cleanupTempFiles,
  validateS3Config,
  s3Client
};