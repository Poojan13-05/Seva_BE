const VehicleInsurance = require('../models/VehicleInsurance');
const Customer = require('../models/Customer');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { generateSignedUrl: s3GenerateSignedUrl, extractS3Key, deleteMultipleFilesFromS3, extractS3KeyEnhanced } = require('../services/s3Sevice');
const { deleteFileFromS3 } = require('../middleware/upload');

// Helper function to check if URL is already signed
const isSignedUrl = (url) => {
  return false; // Always return false to force regeneration of signed URLs for fresh access
};

// Helper function to transform vehicle insurance URLs to signed URLs
const transformVehicleInsuranceUrls = async (vehicleInsurance) => {
  const vehicleInsuranceObj = vehicleInsurance.toObject ? vehicleInsurance.toObject() : vehicleInsurance;

  try {
    // Handle policy file
    let policyFileUrl = vehicleInsuranceObj.uploadPolicy?.policyFileUrl;
    if (policyFileUrl && !isSignedUrl(policyFileUrl)) {
      const s3Key = extractS3Key(policyFileUrl);
      if (s3Key) {
        policyFileUrl = await s3GenerateSignedUrl(s3Key);
      }
    }

    // Handle upload documents
    const uploadDocuments = await Promise.all(
      (vehicleInsuranceObj.uploadDocuments || []).map(async (doc) => {
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
      ...vehicleInsuranceObj,
      uploadPolicy: {
        ...vehicleInsuranceObj.uploadPolicy,
        policyFileUrl
      },
      uploadDocuments
    };
  } catch (error) {
    logger.error('Error transforming vehicle insurance URLs:', error);
    return vehicleInsuranceObj; // Return original object if transformation fails
  }
};

// Create new vehicle insurance policy
const createVehicleInsurance = async (req, res) => {
  try {
    const vehicleInsuranceData = {};

    // Parse JSON strings from form data
    try {
      if (req.body.clientDetails) {
        vehicleInsuranceData.clientDetails = typeof req.body.clientDetails === 'string'
          ? JSON.parse(req.body.clientDetails)
          : req.body.clientDetails;
      }
      if (req.body.insuranceDetails) {
        vehicleInsuranceData.insuranceDetails = typeof req.body.insuranceDetails === 'string'
          ? JSON.parse(req.body.insuranceDetails)
          : req.body.insuranceDetails;
      }
      if (req.body.legalLiabilityAndCovers) {
        vehicleInsuranceData.legalLiabilityAndCovers = typeof req.body.legalLiabilityAndCovers === 'string'
          ? JSON.parse(req.body.legalLiabilityAndCovers)
          : req.body.legalLiabilityAndCovers;
      }
      if (req.body.premiumCommissionDetails) {
        vehicleInsuranceData.premiumCommissionDetails = typeof req.body.premiumCommissionDetails === 'string'
          ? JSON.parse(req.body.premiumCommissionDetails)
          : req.body.premiumCommissionDetails;
      }
      if (req.body.registrationPermitValidity) {
        vehicleInsuranceData.registrationPermitValidity = typeof req.body.registrationPermitValidity === 'string'
          ? JSON.parse(req.body.registrationPermitValidity)
          : req.body.registrationPermitValidity;
      }
      if (req.body.notes) {
        vehicleInsuranceData.notes = typeof req.body.notes === 'string'
          ? JSON.parse(req.body.notes)
          : req.body.notes;
      }
    } catch (parseError) {
      logger.error('JSON parsing error:', parseError);
      return errorResponse(res, 'Invalid JSON data in request', 400);
    }

    // Convert string numbers to actual numbers for numeric fields
    if (vehicleInsuranceData.premiumCommissionDetails) {
      const numericFields = ['tpPremium', 'netPremium', 'gstAmount', 'totalPremium',
                            'mainAgentCommissionPercent', 'mainAgentCommissionView',
                            'mainAgentTDSPercent', 'mainAgentTDSAmount'];

      numericFields.forEach(field => {
        if (vehicleInsuranceData.premiumCommissionDetails[field] !== undefined &&
            vehicleInsuranceData.premiumCommissionDetails[field] !== '') {
          const num = Number(vehicleInsuranceData.premiumCommissionDetails[field]);
          if (!isNaN(num)) {
            vehicleInsuranceData.premiumCommissionDetails[field] = num;
          }
        } else if (vehicleInsuranceData.premiumCommissionDetails[field] === '') {
          delete vehicleInsuranceData.premiumCommissionDetails[field];
        }
      });
    }

    // Handle file uploads if any
    if (req.files) {
      // Policy file upload
      if (req.files.policyFile && req.files.policyFile[0]) {
        vehicleInsuranceData.uploadPolicy = vehicleInsuranceData.uploadPolicy || {};
        vehicleInsuranceData.uploadPolicy.policyFileUrl = req.files.policyFile[0].location;
        vehicleInsuranceData.uploadPolicy.originalName = req.files.policyFile[0].originalname;
        vehicleInsuranceData.uploadPolicy.fileSize = req.files.policyFile[0].size;
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

        vehicleInsuranceData.uploadDocuments = req.files.uploadDocuments.map((file, index) => ({
          documentName: documentNames[index] || 'Document',
          documentUrl: file.location,
          originalName: file.originalname,
          fileSize: file.size
        }));
      }
    }

    // Set created by admin
    vehicleInsuranceData.createdBy = req.admin._id;

    // Create vehicle insurance policy
    const vehicleInsurance = await VehicleInsurance.create(vehicleInsuranceData);

    // Populate the created policy
    const populatedVehicleInsurance = await VehicleInsurance.findById(vehicleInsurance._id)
      .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
      .populate('createdBy', 'name email');

    logger.info('Vehicle Insurance policy created:', {
      policyId: vehicleInsurance._id,
      policyNumber: vehicleInsurance.insuranceDetails.policyNumber,
      createdBy: req.admin._id,
      customerId: vehicleInsurance.clientDetails.customer,
      ip: req.ip
    });

    const vehicleInsuranceWithSignedUrls = await transformVehicleInsuranceUrls(populatedVehicleInsurance);
    successResponse(res, { vehicleInsurance: vehicleInsuranceWithSignedUrls }, 'Vehicle Insurance policy created successfully', 201);
  } catch (error) {
    logger.error('Create vehicle insurance error:', error);
    return errorResponse(res, 'Failed to create vehicle insurance policy', 500);
  }
};

// Get all vehicle insurance policies with pagination, search, and filtering
const getVehicleInsurancePolicies = async (req, res) => {
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
        { 'insuranceDetails.registrationNumber': { $regex: search, $options: 'i' } },
        { 'insuranceDetails.make': { $regex: search, $options: 'i' } },
        { 'insuranceDetails.model': { $regex: search, $options: 'i' } }
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
    const [vehicleInsurancePolicies, totalCount] = await Promise.all([
      VehicleInsurance.find(searchQuery)
        .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
        .populate('createdBy', 'name email')
        .populate('lastUpdatedBy', 'name email')
        .sort(sortObject)
        .skip(skip)
        .limit(limitNumber),
      VehicleInsurance.countDocuments(searchQuery)
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

    logger.info('Vehicle Insurance policies retrieved:', {
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
      vehicleInsurancePolicies.map(policy => transformVehicleInsuranceUrls(policy))
    );

    successResponse(res, {
      vehicleInsurancePolicies: policiesWithSignedUrls,
      pagination,
      filters: {
        search,
        insuranceCompany,
        policyType,
        sortBy,
        sortOrder
      }
    }, 'Vehicle Insurance policies retrieved successfully', 200);

  } catch (error) {
    logger.error('Get vehicle insurance policies error:', error);
    return errorResponse(res, 'Failed to retrieve vehicle insurance policies', 500);
  }
};

// Get vehicle insurance policy by ID
const getVehicleInsuranceById = async (req, res) => {
  try {
    const { policyId } = req.params;

    const vehicleInsurance = await VehicleInsurance.findById(policyId)
      .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email');

    if (!vehicleInsurance) {
      return errorResponse(res, 'Vehicle Insurance policy not found', 404);
    }

    const vehicleInsuranceWithSignedUrls = await transformVehicleInsuranceUrls(vehicleInsurance);
    successResponse(res, { vehicleInsurance: vehicleInsuranceWithSignedUrls }, 'Vehicle Insurance policy retrieved successfully', 200);
  } catch (error) {
    logger.error('Get vehicle insurance by ID error:', error);
    return errorResponse(res, 'Failed to retrieve vehicle insurance policy', 500);
  }
};

// Update vehicle insurance policy
const updateVehicleInsurance = async (req, res) => {
  try {
    const { policyId } = req.params;
    const updateData = {};

    // Get existing policy first
    const existingPolicy = await VehicleInsurance.findById(policyId);
    if (!existingPolicy) {
      return errorResponse(res, 'Vehicle Insurance policy not found', 404);
    }

    // Parse JSON strings from form data
    logger.info('Update request body keys:', Object.keys(req.body));
    logger.info('Update request files:', req.files ? Object.keys(req.files) : 'No files');

    // Initialize files to delete array
    let filesToDeleteFromS3 = [];

    try {
      if (req.body.clientDetails) {
        updateData.clientDetails = typeof req.body.clientDetails === 'string'
          ? JSON.parse(req.body.clientDetails)
          : req.body.clientDetails;
      }
      if (req.body.insuranceDetails) {
        updateData.insuranceDetails = typeof req.body.insuranceDetails === 'string'
          ? JSON.parse(req.body.insuranceDetails)
          : req.body.insuranceDetails;
      }
      if (req.body.legalLiabilityAndCovers) {
        updateData.legalLiabilityAndCovers = typeof req.body.legalLiabilityAndCovers === 'string'
          ? JSON.parse(req.body.legalLiabilityAndCovers)
          : req.body.legalLiabilityAndCovers;
      }
      if (req.body.premiumCommissionDetails) {
        updateData.premiumCommissionDetails = typeof req.body.premiumCommissionDetails === 'string'
          ? JSON.parse(req.body.premiumCommissionDetails)
          : req.body.premiumCommissionDetails;
      }
      if (req.body.registrationPermitValidity) {
        updateData.registrationPermitValidity = typeof req.body.registrationPermitValidity === 'string'
          ? JSON.parse(req.body.registrationPermitValidity)
          : req.body.registrationPermitValidity;
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
      if (existingPolicy.uploadPolicy?.policyFileUrl) {
        const policyFileKey = extractS3KeyEnhanced(existingPolicy.uploadPolicy.policyFileUrl);
        if (policyFileKey && !filesToDeleteFromS3.includes(policyFileKey)) {
          filesToDeleteFromS3.push(policyFileKey);
        }
      }
      updateData.uploadPolicy = null;
    }

    // Handle policy file replacement
    if (req.files && req.files.policyFile && req.files.policyFile[0]) {
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

    // Handle existing documents
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

          const existingDocIndex = finalDocuments.findIndex(doc => doc.documentName === documentName);

          if (existingDocIndex >= 0) {
            const oldDocUrl = finalDocuments[existingDocIndex].documentUrl;
            const oldS3Key = extractS3KeyEnhanced(oldDocUrl);
            if (oldS3Key && !filesToDeleteFromS3.includes(oldS3Key)) {
              filesToDeleteFromS3.push(oldS3Key);
            }

            finalDocuments[existingDocIndex] = {
              _id: finalDocuments[existingDocIndex]._id,
              documentName: documentName,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            };
          } else {
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

    updateData.uploadDocuments = finalDocuments;

    // Convert string numbers to actual numbers
    if (updateData.premiumCommissionDetails) {
      const numericFields = ['tpPremium', 'netPremium', 'gstAmount', 'totalPremium',
                            'mainAgentCommissionPercent', 'mainAgentCommissionView',
                            'mainAgentTDSPercent', 'mainAgentTDSAmount'];

      numericFields.forEach(field => {
        if (updateData.premiumCommissionDetails[field] !== undefined &&
            updateData.premiumCommissionDetails[field] !== '') {
          const num = Number(updateData.premiumCommissionDetails[field]);
          if (!isNaN(num)) {
            updateData.premiumCommissionDetails[field] = num;
          }
        } else if (updateData.premiumCommissionDetails[field] === '') {
          delete updateData.premiumCommissionDetails[field];
        }
      });
    }

    // Set last updated by
    updateData.lastUpdatedBy = req.admin._id;

    logger.info('Updating vehicle insurance policy with data:', {
      policyId,
      updateDataKeys: Object.keys(updateData),
      documentsCount: updateData.uploadDocuments?.length || 0,
      filesToDelete: filesToDeleteFromS3.length
    });

    // Update database first
    const vehicleInsurance = await VehicleInsurance.findByIdAndUpdate(
      policyId,
      updateData,
      { new: true, runValidators: true }
    ).populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
     .populate('createdBy', 'name email')
     .populate('lastUpdatedBy', 'name email');

    if (!vehicleInsurance) {
      return errorResponse(res, 'Vehicle Insurance policy not found', 404);
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

    logger.info('Vehicle Insurance policy updated successfully:', {
      policyId: vehicleInsurance._id,
      policyNumber: vehicleInsurance.insuranceDetails.policyNumber,
      updatedBy: req.admin._id,
      ip: req.ip
    });

    const vehicleInsuranceWithSignedUrls = await transformVehicleInsuranceUrls(vehicleInsurance);
    successResponse(res, { vehicleInsurance: vehicleInsuranceWithSignedUrls }, 'Vehicle Insurance policy updated successfully', 200);
  } catch (error) {
    logger.error('Update vehicle insurance error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, 'Validation Error', 400, errors);
    }

    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid ID format', 400);
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment ? error.message : 'Failed to update vehicle insurance policy';

    return errorResponse(res, errorMessage, 500);
  }
};

// Delete vehicle insurance policy (soft delete)
const deleteVehicleInsurance = async (req, res) => {
  try {
    const { policyId } = req.params;

    const vehicleInsurance = await VehicleInsurance.findById(policyId);

    if (!vehicleInsurance) {
      return errorResponse(res, 'Vehicle Insurance policy not found', 404);
    }

    // Soft delete by setting isActive to false
    vehicleInsurance.isActive = false;
    vehicleInsurance.lastUpdatedBy = req.admin._id;
    await vehicleInsurance.save();

    logger.info('Vehicle Insurance policy deleted (soft):', {
      policyId: vehicleInsurance._id,
      policyNumber: vehicleInsurance.insuranceDetails.policyNumber,
      deletedBy: req.admin._id,
      ip: req.ip
    });

    successResponse(res, null, 'Vehicle Insurance policy deleted successfully', 200);
  } catch (error) {
    logger.error('Delete vehicle insurance error:', error);
    return errorResponse(res, 'Failed to delete vehicle insurance policy', 500);
  }
};

// Toggle vehicle insurance policy status
const toggleVehicleInsuranceStatus = async (req, res) => {
  try {
    const { policyId } = req.params;

    const vehicleInsurance = await VehicleInsurance.findById(policyId);

    if (!vehicleInsurance) {
      return errorResponse(res, 'Vehicle Insurance policy not found', 404);
    }

    await vehicleInsurance.toggleActiveStatus(req.admin._id);

    logger.info('Vehicle Insurance policy status changed:', {
      policyId: vehicleInsurance._id,
      policyNumber: vehicleInsurance.insuranceDetails.policyNumber,
      changedBy: req.admin._id,
      newStatus: vehicleInsurance.isActive,
      ip: req.ip
    });

    successResponse(res, {
      vehicleInsurance: {
        id: vehicleInsurance._id,
        policyNumber: vehicleInsurance.insuranceDetails.policyNumber,
        isActive: vehicleInsurance.isActive
      }
    }, `Vehicle Insurance policy ${vehicleInsurance.isActive ? 'activated' : 'deactivated'} successfully`, 200);
  } catch (error) {
    logger.error('Toggle vehicle insurance status error:', error);
    return errorResponse(res, 'Failed to change vehicle insurance policy status', 500);
  }
};

// Get vehicle insurance statistics
const getVehicleInsuranceStats = async (req, res) => {
  try {
    const stats = await VehicleInsurance.getVehicleInsuranceStats();

    successResponse(res, { stats }, 'Vehicle Insurance statistics retrieved successfully', 200);
  } catch (error) {
    logger.error('Get vehicle insurance stats error:', error);
    return errorResponse(res, 'Failed to retrieve vehicle insurance statistics', 500);
  }
};

// Delete document from vehicle insurance policy
const deleteDocument = async (req, res) => {
  try {
    const { policyId, documentId } = req.params;

    const vehicleInsurance = await VehicleInsurance.findById(policyId);

    if (!vehicleInsurance) {
      return errorResponse(res, 'Vehicle Insurance policy not found', 404);
    }

    const documentIndex = vehicleInsurance.uploadDocuments.findIndex(doc => doc._id.toString() === documentId);

    if (documentIndex === -1) {
      return errorResponse(res, 'Document not found', 404);
    }

    const document = vehicleInsurance.uploadDocuments[documentIndex];

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
    vehicleInsurance.uploadDocuments.splice(documentIndex, 1);
    vehicleInsurance.lastUpdatedBy = req.admin._id;
    await vehicleInsurance.save();

    logger.info('Document deleted from vehicle insurance policy:', {
      policyId: vehicleInsurance._id,
      policyNumber: vehicleInsurance.insuranceDetails.policyNumber,
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
  createVehicleInsurance,
  getVehicleInsurancePolicies,
  getVehicleInsuranceById,
  updateVehicleInsurance,
  deleteVehicleInsurance,
  toggleVehicleInsuranceStatus,
  getVehicleInsuranceStats,
  deleteDocument,
  getCustomersForDropdown,
  getCustomerById
};
