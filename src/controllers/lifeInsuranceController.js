const LifeInsurance = require('../models/LifeInsurance');
const Customer = require('../models/Customer');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { generateSignedUrl: s3GenerateSignedUrl, extractS3Key, deleteMultipleFilesFromS3, extractS3KeyEnhanced } = require('../services/s3Sevice');
const { deleteFileFromS3 } = require('../middleware/upload');

// Helper function to check if URL is already signed
const isSignedUrl = (url) => {
  return false; // Always return false to force regeneration of signed URLs for fresh access
};

// Helper function to transform life insurance URLs to signed URLs
const transformLifeInsuranceUrls = async (lifeInsurance) => {
  const lifeInsuranceObj = lifeInsurance.toObject ? lifeInsurance.toObject() : lifeInsurance;
  
  try {
    // Handle policy file
    let policyFileUrl = lifeInsuranceObj.uploadPolicy?.policyFileUrl;
    if (policyFileUrl && !isSignedUrl(policyFileUrl)) {
      const s3Key = extractS3Key(policyFileUrl);
      if (s3Key) {
        policyFileUrl = await s3GenerateSignedUrl(s3Key);
      }
    }

    // Handle upload documents
    const uploadDocuments = await Promise.all(
      (lifeInsuranceObj.uploadDocuments || []).map(async (doc) => {
        if (!isSignedUrl(doc.documentUrl)) {
          const s3Key = extractS3Key(doc.documentUrl);
          if (s3Key) {
            const signedUrl = await s3GenerateSignedUrl(s3Key);
            return { ...doc, documentUrl: signedUrl || doc.documentUrl };
          }
        }
        return doc;
      })
    );

    return {
      ...lifeInsuranceObj,
      uploadPolicy: {
        ...lifeInsuranceObj.uploadPolicy,
        policyFileUrl
      },
      uploadDocuments
    };
  } catch (error) {
    logger.error('Error transforming life insurance URLs:', error);
    return lifeInsuranceObj; // Return original object if transformation fails
  }
};

// Create new life insurance policy
const createLifeInsurance = async (req, res) => {
  try {
    const lifeInsuranceData = {};
    
    // Parse JSON strings from form data
    try {
      if (req.body.clientDetails) {
        lifeInsuranceData.clientDetails = typeof req.body.clientDetails === 'string' 
          ? JSON.parse(req.body.clientDetails) 
          : req.body.clientDetails;
      }
      if (req.body.insuranceDetails) {
        lifeInsuranceData.insuranceDetails = typeof req.body.insuranceDetails === 'string' 
          ? JSON.parse(req.body.insuranceDetails) 
          : req.body.insuranceDetails;
      }
      if (req.body.commissionDetails) {
        lifeInsuranceData.commissionDetails = typeof req.body.commissionDetails === 'string' 
          ? JSON.parse(req.body.commissionDetails) 
          : req.body.commissionDetails;
      }
      if (req.body.nomineeDetails) {
        lifeInsuranceData.nomineeDetails = typeof req.body.nomineeDetails === 'string' 
          ? JSON.parse(req.body.nomineeDetails) 
          : req.body.nomineeDetails;
      }
      if (req.body.riderDetails) {
        lifeInsuranceData.riderDetails = typeof req.body.riderDetails === 'string' 
          ? JSON.parse(req.body.riderDetails) 
          : req.body.riderDetails;
      }
      if (req.body.bankDetails) {
        lifeInsuranceData.bankDetails = typeof req.body.bankDetails === 'string' 
          ? JSON.parse(req.body.bankDetails) 
          : req.body.bankDetails;
      }
      if (req.body.notes) {
        lifeInsuranceData.notes = typeof req.body.notes === 'string' 
          ? JSON.parse(req.body.notes) 
          : req.body.notes;
      }
    } catch (parseError) {
      logger.error('JSON parsing error:', parseError);
      return errorResponse(res, 'Invalid JSON data in request', 400);
    }
    
    // Validate customer is provided
    if (!lifeInsuranceData.clientDetails?.customer || lifeInsuranceData.clientDetails.customer === '') {
      return errorResponse(res, 'Customer selection is required', 400);
    }

    // Convert string numbers to actual numbers for numeric fields
    if (lifeInsuranceData.insuranceDetails) {
      const numericFields = ['policyTerm', 'premiumPaymentNumber', 'sumInsured', 'netPremium', 
                            'firstYearGST', 'secondYearGST', 'thirdYearGST', 'totalPremium', 'bonus', 'fund'];
      
      numericFields.forEach(field => {
        if (lifeInsuranceData.insuranceDetails[field] !== undefined && lifeInsuranceData.insuranceDetails[field] !== '') {
          const num = Number(lifeInsuranceData.insuranceDetails[field]);
          if (!isNaN(num)) {
            lifeInsuranceData.insuranceDetails[field] = num;
          }
        } else if (lifeInsuranceData.insuranceDetails[field] === '') {
          delete lifeInsuranceData.insuranceDetails[field];
        }
      });
    }

    // Convert commission details numeric fields
    if (lifeInsuranceData.commissionDetails) {
      const commissionNumericFields = ['mainAgentCommissionPercent', 'firstYear', 'mainAgentCommissionAmount', 
                                      'mainAgentTDSPercent', 'mainAgentTDSAmount'];
      
      commissionNumericFields.forEach(field => {
        if (lifeInsuranceData.commissionDetails[field] !== undefined && lifeInsuranceData.commissionDetails[field] !== '') {
          const num = Number(lifeInsuranceData.commissionDetails[field]);
          if (!isNaN(num)) {
            lifeInsuranceData.commissionDetails[field] = num;
          }
        } else if (lifeInsuranceData.commissionDetails[field] === '') {
          delete lifeInsuranceData.commissionDetails[field];
        }
      });
    }

    // Convert nominee age
    if (lifeInsuranceData.nomineeDetails?.nomineeAge !== undefined && lifeInsuranceData.nomineeDetails.nomineeAge !== '') {
      const age = Number(lifeInsuranceData.nomineeDetails.nomineeAge);
      if (!isNaN(age)) {
        lifeInsuranceData.nomineeDetails.nomineeAge = age;
      }
    } else if (lifeInsuranceData.nomineeDetails?.nomineeAge === '') {
      delete lifeInsuranceData.nomineeDetails.nomineeAge;
    }

    // Convert rider details numeric fields
    if (lifeInsuranceData.riderDetails) {
      const riderTypes = ['termRider', 'criticalIllnessRider', 'accidentRider', 'pwbRider', 'othersRider'];
      
      riderTypes.forEach(riderType => {
        if (lifeInsuranceData.riderDetails[riderType]?.amount !== undefined && lifeInsuranceData.riderDetails[riderType].amount !== '') {
          const amount = Number(lifeInsuranceData.riderDetails[riderType].amount);
          if (!isNaN(amount)) {
            lifeInsuranceData.riderDetails[riderType].amount = amount;
          }
        } else if (lifeInsuranceData.riderDetails[riderType]?.amount === '') {
          delete lifeInsuranceData.riderDetails[riderType].amount;
        }
      });
    }
    
    // No validation - allow any customer ID

    // Handle file uploads if any
    if (req.files) {
      // Policy file upload
      if (req.files.policyFile && req.files.policyFile[0]) {
        lifeInsuranceData.uploadPolicy = lifeInsuranceData.uploadPolicy || {};
        lifeInsuranceData.uploadPolicy.policyFileUrl = req.files.policyFile[0].location;
        lifeInsuranceData.uploadPolicy.originalName = req.files.policyFile[0].originalname;
        lifeInsuranceData.uploadPolicy.fileSize = req.files.policyFile[0].size;
      }

      // Upload documents
      if (req.files.uploadDocuments && req.files.uploadDocuments.length > 0) {
        let documentNames = req.body.documentNames;
        
        if (typeof documentNames === 'string') {
          try {
            documentNames = JSON.parse(documentNames);
          } catch (e) {
            documentNames = documentNames.split(',').map(name => name.trim());
          }
        } else if (!Array.isArray(documentNames)) {
          documentNames = [];
        }

        lifeInsuranceData.uploadDocuments = req.files.uploadDocuments.map((file, index) => ({
          documentName: documentNames[index] || 'Document',
          documentUrl: file.location,
          originalName: file.originalname,
          fileSize: file.size
        }));
      }
    }

    // Set created by admin
    lifeInsuranceData.createdBy = req.admin._id;

    // Create life insurance policy
    const lifeInsurance = await LifeInsurance.create(lifeInsuranceData);

    // Populate the created policy
    const populatedLifeInsurance = await LifeInsurance.findById(lifeInsurance._id)
      .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
      .populate('createdBy', 'name email');

    logger.info('Life Insurance policy created:', {
      policyId: lifeInsurance._id,
      policyNumber: lifeInsurance.insuranceDetails.policyNumber,
      createdBy: req.admin._id,
      customerId: lifeInsurance.clientDetails.customer,
      ip: req.ip
    });

    const lifeInsuranceWithSignedUrls = await transformLifeInsuranceUrls(populatedLifeInsurance);
    successResponse(res, { lifeInsurance: lifeInsuranceWithSignedUrls }, 'Life Insurance policy created successfully', 201);
  } catch (error) {
    logger.error('Create life insurance error:', error);
    
    // No validation - allow duplicates

    return errorResponse(res, 'Failed to create life insurance policy', 500);
  }
};

// Get all life insurance policies with pagination, search, and filtering
const getLifeInsurancePolicies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      insuranceCompany = 'all',
      policyType = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search query
    const searchQuery = { isActive: true };

    // Add search functionality
    if (search.trim()) {
      searchQuery.$or = [
        { 'insuranceDetails.policyNumber': { $regex: search, $options: 'i' } },
        { 'clientDetails.insuredName': { $regex: search, $options: 'i' } },
        { 'insuranceDetails.planName': { $regex: search, $options: 'i' } },
        { 'nomineeDetails.nomineeName': { $regex: search, $options: 'i' } }
      ];
    }

    // Add insurance company filter
    if (insuranceCompany !== 'all') {
      searchQuery['insuranceDetails.insuranceCompany'] = insuranceCompany;
    }

    // Add policy type filter
    if (policyType !== 'all') {
      searchQuery['insuranceDetails.policyType'] = policyType;
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries
    const [lifeInsurancePolicies, totalCount] = await Promise.all([
      LifeInsurance.find(searchQuery)
        .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
        .populate('createdBy', 'name email')
        .populate('lastUpdatedBy', 'name email')
        .sort(sortObject)
        .skip(skip)
        .limit(limitNumber),
      LifeInsurance.countDocuments(searchQuery)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    const pagination = {
      currentPage: pageNumber,
      totalPages,
      totalCount,
      limit: limitNumber,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? pageNumber + 1 : null,
      prevPage: hasPrevPage ? pageNumber - 1 : null
    };

    logger.info('Life Insurance policies retrieved:', {
      requestedBy: req.admin._id,
      totalCount,
      page: pageNumber,
      search: search || 'none',
      insuranceCompany,
      policyType,
      ip: req.ip
    });

    // Transform policies with signed URLs
    const policiesWithSignedUrls = await Promise.all(
      lifeInsurancePolicies.map(policy => transformLifeInsuranceUrls(policy))
    );

    successResponse(res, {
      lifeInsurancePolicies: policiesWithSignedUrls,
      pagination,
      filters: {
        search,
        insuranceCompany,
        policyType,
        sortBy,
        sortOrder
      }
    }, 'Life Insurance policies retrieved successfully', 200);

  } catch (error) {
    logger.error('Get life insurance policies error:', error);
    return errorResponse(res, 'Failed to retrieve life insurance policies', 500);
  }
};

// Get life insurance policy by ID
const getLifeInsuranceById = async (req, res) => {
  try {
    const { policyId } = req.params;
    
    const lifeInsurance = await LifeInsurance.findById(policyId)
      .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email');

    if (!lifeInsurance) {
      return errorResponse(res, 'Life Insurance policy not found', 404);
    }

    const lifeInsuranceWithSignedUrls = await transformLifeInsuranceUrls(lifeInsurance);
    successResponse(res, { lifeInsurance: lifeInsuranceWithSignedUrls }, 'Life Insurance policy retrieved successfully', 200);
  } catch (error) {
    logger.error('Get life insurance by ID error:', error);
    return errorResponse(res, 'Failed to retrieve life insurance policy', 500);
  }
};

// Update life insurance policy
const updateLifeInsurance = async (req, res) => {
  try {
    const { policyId } = req.params;
    const updateData = {};

    // Get existing policy first
    const existingPolicy = await LifeInsurance.findById(policyId);
    if (!existingPolicy) {
      return errorResponse(res, 'Life Insurance policy not found', 404);
    }

    // Parse JSON strings from form data
    logger.info('Update request body keys:', Object.keys(req.body));
    logger.info('Update request files:', req.files ? Object.keys(req.files) : 'No files');
    
    // Initialize files to delete array outside try-catch to avoid reference errors
    let filesToDeleteFromS3 = [];
    
    try {
      if (req.body.clientDetails) {
        updateData.clientDetails = typeof req.body.clientDetails === 'string' 
          ? JSON.parse(req.body.clientDetails) 
          : req.body.clientDetails;
        logger.info('Parsed clientDetails:', updateData.clientDetails);
      }
      if (req.body.insuranceDetails) {
        updateData.insuranceDetails = typeof req.body.insuranceDetails === 'string' 
          ? JSON.parse(req.body.insuranceDetails) 
          : req.body.insuranceDetails;
      }
      if (req.body.commissionDetails) {
        updateData.commissionDetails = typeof req.body.commissionDetails === 'string' 
          ? JSON.parse(req.body.commissionDetails) 
          : req.body.commissionDetails;
      }
      if (req.body.nomineeDetails) {
        updateData.nomineeDetails = typeof req.body.nomineeDetails === 'string' 
          ? JSON.parse(req.body.nomineeDetails) 
          : req.body.nomineeDetails;
      }
      if (req.body.riderDetails) {
        updateData.riderDetails = typeof req.body.riderDetails === 'string' 
          ? JSON.parse(req.body.riderDetails) 
          : req.body.riderDetails;
      }
      if (req.body.bankDetails) {
        updateData.bankDetails = typeof req.body.bankDetails === 'string' 
          ? JSON.parse(req.body.bankDetails) 
          : req.body.bankDetails;
      }
      if (req.body.uploadDocuments) {
        updateData.uploadDocuments = typeof req.body.uploadDocuments === 'string' 
          ? JSON.parse(req.body.uploadDocuments) 
          : req.body.uploadDocuments;
      }
      if (req.body.notes) {
        updateData.notes = typeof req.body.notes === 'string' 
          ? JSON.parse(req.body.notes) 
          : req.body.notes;
      }

      // Parse deleted files information
      let deletedDocuments = [];
      let deletedPolicyFile = null;

      if (req.body.deletedDocuments && typeof req.body.deletedDocuments === 'string') {
        deletedDocuments = JSON.parse(req.body.deletedDocuments);
      }
      if (req.body.deletedPolicyFile) {
        deletedPolicyFile = req.body.deletedPolicyFile;
      }

      // Collect files to be deleted from S3

      // Collect S3 keys for files to be deleted
      deletedDocuments.forEach(doc => {
        const s3Key = extractS3KeyEnhanced(doc.documentUrl);
        if (s3Key) filesToDeleteFromS3.push(s3Key);
      });

      if (deletedPolicyFile) {
        const s3Key = extractS3KeyEnhanced(deletedPolicyFile);
        if (s3Key) filesToDeleteFromS3.push(s3Key);
      }

    } catch (parseError) {
      logger.error('JSON parsing error:', parseError);
      return errorResponse(res, 'Invalid JSON data in request', 400);
    }

    // Handle policy file deletion
    if (req.body.deletePolicyFile === 'true' || req.body.deletePolicyFile === true) {
      // If deleting policy file, add current one to deletion list
      if (existingPolicy.uploadPolicy?.policyFileUrl) {
        const policyFileKey = extractS3KeyEnhanced(existingPolicy.uploadPolicy.policyFileUrl);
        if (policyFileKey && !filesToDeleteFromS3.includes(policyFileKey)) {
          filesToDeleteFromS3.push(policyFileKey);
        }
      }
      // Remove policy file from database
      updateData.uploadPolicy = null;
    }

    // Handle policy file replacement
    if (req.files && req.files.policyFile && req.files.policyFile[0]) {
      // If replacing policy file, add old one to deletion list
      if (existingPolicy.uploadPolicy?.policyFileUrl) {
        const oldPolicyFileKey = extractS3KeyEnhanced(existingPolicy.uploadPolicy.policyFileUrl);
        if (oldPolicyFileKey && !filesToDeleteFromS3.includes(oldPolicyFileKey)) {
          filesToDeleteFromS3.push(oldPolicyFileKey);
        }
      }
      updateData.uploadPolicy = updateData.uploadPolicy || {};
      updateData.uploadPolicy.policyFileUrl = req.files.policyFile[0].location;
      updateData.uploadPolicy.originalName = req.files.policyFile[0].originalname;
      updateData.uploadPolicy.fileSize = req.files.policyFile[0].size;
    }

    // Handle existing documents - properly maintain existing ones without duplicating
    let finalDocuments = [];
    if (updateData.uploadDocuments && Array.isArray(updateData.uploadDocuments)) {
      finalDocuments = updateData.uploadDocuments.filter(doc => {
        return doc.existingUrl && doc.documentName && doc._id;
      }).map(doc => ({
        _id: doc._id,
        documentName: doc.documentName,
        documentUrl: doc.existingUrl,
        originalName: doc.existingName || doc.documentName,
        fileSize: doc.fileSize
      }));
    }

    // Handle file uploads if any
    if (req.files) {
      // Handle new documents
      const documentsFiles = req.files.newUploadDocuments || req.files.uploadDocuments;
      if (documentsFiles && documentsFiles.length > 0) {
        let documentNames = req.body.newDocumentNames || req.body.documentNames;
        
        if (typeof documentNames === 'string') {
          try {
            documentNames = JSON.parse(documentNames);
          } catch (e) {
            documentNames = [documentNames];
          }
        } else if (!Array.isArray(documentNames)) {
          documentNames = [];
        }

        documentsFiles.forEach((file, index) => {
          const documentName = documentNames[index] || 'Document';
          
          // Check if this document name already exists and is being replaced
          const existingDocIndex = finalDocuments.findIndex(doc => doc.documentName === documentName);
          
          if (existingDocIndex >= 0) {
            // Add the old document to deletion list before replacing
            const oldDocUrl = finalDocuments[existingDocIndex].documentUrl;
            const oldS3Key = extractS3KeyEnhanced(oldDocUrl);
            if (oldS3Key && !filesToDeleteFromS3.includes(oldS3Key)) {
              filesToDeleteFromS3.push(oldS3Key);
            }
            
            // Replace existing document
            finalDocuments[existingDocIndex] = {
              _id: finalDocuments[existingDocIndex]._id, // Keep the same ID
              documentName: documentName,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            };
          } else {
            // Add as new document
            finalDocuments.push({
              documentName: documentName,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            });
          }
        });
      }
    }

    // Set the final document array
    updateData.uploadDocuments = finalDocuments;

    // Validate customer is provided  
    if (!updateData.clientDetails?.customer || 
        updateData.clientDetails.customer === '' || 
        updateData.clientDetails.customer === null || 
        updateData.clientDetails.customer === undefined) {
      return errorResponse(res, 'Customer selection is required', 400);
    }

    // Convert string numbers to actual numbers for numeric fields
    if (updateData.insuranceDetails) {
      const numericFields = ['policyTerm', 'premiumPaymentNumber', 'sumInsured', 'netPremium', 
                            'firstYearGST', 'secondYearGST', 'thirdYearGST', 'totalPremium', 'bonus', 'fund'];
      
      numericFields.forEach(field => {
        if (updateData.insuranceDetails[field] !== undefined && updateData.insuranceDetails[field] !== '') {
          const num = Number(updateData.insuranceDetails[field]);
          if (!isNaN(num)) {
            updateData.insuranceDetails[field] = num;
          }
        } else if (updateData.insuranceDetails[field] === '') {
          delete updateData.insuranceDetails[field];
        }
      });
    }

    // Convert commission details numeric fields
    if (updateData.commissionDetails) {
      const commissionNumericFields = ['mainAgentCommissionPercent', 'firstYear', 'mainAgentCommissionAmount', 
                                      'mainAgentTDSPercent', 'mainAgentTDSAmount'];
      
      commissionNumericFields.forEach(field => {
        if (updateData.commissionDetails[field] !== undefined && updateData.commissionDetails[field] !== '') {
          const num = Number(updateData.commissionDetails[field]);
          if (!isNaN(num)) {
            updateData.commissionDetails[field] = num;
          }
        } else if (updateData.commissionDetails[field] === '') {
          delete updateData.commissionDetails[field];
        }
      });
    }

    // Convert nominee age
    if (updateData.nomineeDetails?.nomineeAge !== undefined && updateData.nomineeDetails.nomineeAge !== '') {
      const age = Number(updateData.nomineeDetails.nomineeAge);
      if (!isNaN(age)) {
        updateData.nomineeDetails.nomineeAge = age;
      }
    } else if (updateData.nomineeDetails?.nomineeAge === '') {
      delete updateData.nomineeDetails.nomineeAge;
    }

    // Convert rider details numeric fields
    if (updateData.riderDetails) {
      const riderTypes = ['termRider', 'criticalIllnessRider', 'accidentRider', 'pwbRider', 'othersRider'];
      
      riderTypes.forEach(riderType => {
        if (updateData.riderDetails[riderType]?.amount !== undefined && updateData.riderDetails[riderType].amount !== '') {
          const amount = Number(updateData.riderDetails[riderType].amount);
          if (!isNaN(amount)) {
            updateData.riderDetails[riderType].amount = amount;
          }
        } else if (updateData.riderDetails[riderType]?.amount === '') {
          delete updateData.riderDetails[riderType].amount;
        }
      });
    }

    // Validate client exists if customer is being updated
    if (updateData.clientDetails?.customer) {
      try {
        logger.info('Validating customer ID:', updateData.clientDetails.customer);
        const clientExists = await Customer.findById(updateData.clientDetails.customer);
        if (!clientExists) {
          logger.error('Customer not found in database:', updateData.clientDetails.customer);
          return errorResponse(res, 'Customer not found', 404);
        }
        logger.info('Customer validation passed');
      } catch (customerError) {
        logger.error('Customer validation error:', customerError);
        return errorResponse(res, 'Invalid customer ID format', 400);
      }
    }

    // Set last updated by
    updateData.lastUpdatedBy = req.admin._id;

    logger.info('Updating life insurance policy with data:', {
      policyId,
      updateDataKeys: Object.keys(updateData),
      documentsCount: updateData.uploadDocuments?.length || 0,
      filesToDelete: filesToDeleteFromS3.length,
      filesToDeleteList: filesToDeleteFromS3
    });

    // Update database first
    const lifeInsurance = await LifeInsurance.findByIdAndUpdate(
      policyId,
      updateData,
      { new: true, runValidators: true }
    ).populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
     .populate('createdBy', 'name email')
     .populate('lastUpdatedBy', 'name email');

    if (!lifeInsurance) {
      return errorResponse(res, 'Life Insurance policy not found', 404);
    }

    // Delete old files from S3 after successful database update
    if (filesToDeleteFromS3.length > 0) {
      try {
        logger.info('Starting S3 cleanup for files:', filesToDeleteFromS3);
        const deleteResults = await deleteMultipleFilesFromS3(filesToDeleteFromS3);
        const failedDeletions = deleteResults.filter(result => !result.success);
        
        if (failedDeletions.length > 0) {
          logger.warn('Some S3 files failed to delete:', failedDeletions);
        }
        
        logger.info('S3 cleanup completed:', {
          total: deleteResults.length,
          successful: deleteResults.length - failedDeletions.length,
          failed: failedDeletions.length
        });
      } catch (s3Error) {
        logger.error('S3 cleanup error:', s3Error);
      }
    }

    logger.info('Life Insurance policy updated successfully:', {
      policyId: lifeInsurance._id,
      policyNumber: lifeInsurance.insuranceDetails.policyNumber,
      updatedBy: req.admin._id,
      customerId: lifeInsurance.clientDetails.customer,
      documentsAfterUpdate: lifeInsurance.uploadDocuments?.length || 0,
      s3FilesDeleted: filesToDeleteFromS3.length,
      ip: req.ip
    });

    const lifeInsuranceWithSignedUrls = await transformLifeInsuranceUrls(lifeInsurance);
    successResponse(res, { lifeInsurance: lifeInsuranceWithSignedUrls }, 'Life Insurance policy updated successfully', 200);
  } catch (error) {
    logger.error('Update life insurance error:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Error message:', error.message);
    logger.error('Error name:', error.name);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, 'Validation Error', 400, errors);
    }

    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid ID format', 400);
    }

    // Return more specific error message in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment ? error.message : 'Failed to update life insurance policy';
    
    return errorResponse(res, errorMessage, 500);
  }
};

// Delete life insurance policy (soft delete)
const deleteLifeInsurance = async (req, res) => {
  try {
    const { policyId } = req.params;

    const lifeInsurance = await LifeInsurance.findById(policyId);
    
    if (!lifeInsurance) {
      return errorResponse(res, 'Life Insurance policy not found', 404);
    }

    // Soft delete by setting isActive to false
    lifeInsurance.isActive = false;
    lifeInsurance.lastUpdatedBy = req.admin._id;
    await lifeInsurance.save();

    logger.info('Life Insurance policy deleted (soft):', {
      policyId: lifeInsurance._id,
      policyNumber: lifeInsurance.insuranceDetails.policyNumber,
      deletedBy: req.admin._id,
      ip: req.ip
    });

    successResponse(res, null, 'Life Insurance policy deleted successfully', 200);
  } catch (error) {
    logger.error('Delete life insurance error:', error);
    return errorResponse(res, 'Failed to delete life insurance policy', 500);
  }
};

// Toggle life insurance policy status
const toggleLifeInsuranceStatus = async (req, res) => {
  try {
    const { policyId } = req.params;

    const lifeInsurance = await LifeInsurance.findById(policyId);
    
    if (!lifeInsurance) {
      return errorResponse(res, 'Life Insurance policy not found', 404);
    }

    await lifeInsurance.toggleActiveStatus(req.admin._id);

    logger.info('Life Insurance policy status changed:', {
      policyId: lifeInsurance._id,
      policyNumber: lifeInsurance.insuranceDetails.policyNumber,
      changedBy: req.admin._id,
      newStatus: lifeInsurance.isActive,
      ip: req.ip
    });

    successResponse(res, { 
      lifeInsurance: { 
        id: lifeInsurance._id,
        policyNumber: lifeInsurance.insuranceDetails.policyNumber,
        isActive: lifeInsurance.isActive 
      } 
    }, `Life Insurance policy ${lifeInsurance.isActive ? 'activated' : 'deactivated'} successfully`, 200);
  } catch (error) {
    logger.error('Toggle life insurance status error:', error);
    return errorResponse(res, 'Failed to change life insurance policy status', 500);
  }
};

// Get life insurance statistics
const getLifeInsuranceStats = async (req, res) => {
  try {
    const stats = await LifeInsurance.getLifeInsuranceStats();

    successResponse(res, { stats }, 'Life Insurance statistics retrieved successfully', 200);
  } catch (error) {
    logger.error('Get life insurance stats error:', error);
    return errorResponse(res, 'Failed to retrieve life insurance statistics', 500);
  }
};

// Delete document from life insurance policy
const deleteDocument = async (req, res) => {
  try {
    const { policyId, documentId } = req.params;

    const lifeInsurance = await LifeInsurance.findById(policyId);
    
    if (!lifeInsurance) {
      return errorResponse(res, 'Life Insurance policy not found', 404);
    }

    const documentIndex = lifeInsurance.uploadDocuments.findIndex(doc => doc._id.toString() === documentId);
    
    if (documentIndex === -1) {
      return errorResponse(res, 'Document not found', 404);
    }

    const document = lifeInsurance.uploadDocuments[documentIndex];
    
    // Delete from S3
    try {
      const s3Key = extractS3KeyEnhanced(document.documentUrl);
      if (s3Key) {
        await deleteFileFromS3(s3Key);
        logger.info('File deleted from S3:', s3Key);
      } else {
        logger.warn('Could not extract S3 key from URL:', document.documentUrl);
      }
    } catch (s3Error) {
      logger.warn('Failed to delete file from S3:', s3Error);
    }

    // Remove from array
    lifeInsurance.uploadDocuments.splice(documentIndex, 1);
    lifeInsurance.lastUpdatedBy = req.admin._id;
    await lifeInsurance.save();

    logger.info('Document deleted from life insurance policy:', {
      policyId: lifeInsurance._id,
      policyNumber: lifeInsurance.insuranceDetails.policyNumber,
      documentId,
      deletedBy: req.admin._id,
      ip: req.ip
    });

    successResponse(res, null, 'Document deleted successfully', 200);
  } catch (error) {
    logger.error('Delete document error:', error);
    return errorResponse(res, 'Failed to delete document', 500);
  }
};

// Get customers for dropdown
const getCustomersForDropdown = async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true })
      .select('_id customerId personalDetails.firstName personalDetails.lastName personalDetails.email')
      .sort({ 'personalDetails.firstName': 1 });

    const formattedCustomers = customers.map(customer => ({
      value: customer._id,
      label: `${customer.customerId} - ${customer.personalDetails.firstName} ${customer.personalDetails.lastName}`,
      email: customer.personalDetails.email
    }));

    successResponse(res, { customers: formattedCustomers }, 'Customers retrieved successfully', 200);
  } catch (error) {
    logger.error('Get customers for dropdown error:', error);
    return errorResponse(res, 'Failed to retrieve customers', 500);
  }
};

// Get customer details by ID for edit dialog
const getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const customer = await Customer.findById(customerId)
      .select('_id customerId personalDetails.firstName personalDetails.lastName personalDetails.email');

    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    const formattedCustomer = {
      value: customer._id,
      label: `${customer.customerId} - ${customer.personalDetails.firstName} ${customer.personalDetails.lastName}`,
      email: customer.personalDetails.email
    };

    successResponse(res, { customer: formattedCustomer }, 'Customer retrieved successfully', 200);
  } catch (error) {
    logger.error('Get customer by ID error:', error);
    return errorResponse(res, 'Failed to retrieve customer', 500);
  }
};

module.exports = {
  createLifeInsurance,
  getLifeInsurancePolicies,
  getLifeInsuranceById,
  updateLifeInsurance,
  deleteLifeInsurance,
  toggleLifeInsuranceStatus,
  getLifeInsuranceStats,
  deleteDocument,
  getCustomersForDropdown,
  getCustomerById
};