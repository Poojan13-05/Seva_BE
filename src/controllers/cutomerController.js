// src/controllers/customerController.js
const Customer = require('../models/Customer');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { generateSignedUrl, deleteFileFromS3 } = require('../middleware/upload');
const { generateSignedUrl: s3GenerateSignedUrl, extractS3Key, deleteMultipleFilesFromS3, extractS3KeyEnhanced } = require('../services/s3Sevice');

// Helper function to check if URL is already signed
const isSignedUrl = (url) => {
  // Always return false to force regeneration of signed URLs for fresh access
  return false;
};

// Helper function to transform customer URLs to signed URLs
const transformCustomerUrls = async (customer) => {
  const customerObj = customer.toObject ? customer.toObject() : customer;
  
  try {
    // Handle profile photo
    let profilePhoto = customerObj.personalDetails?.profilePhoto;
    if (profilePhoto && !isSignedUrl(profilePhoto)) {
      const s3Key = extractS3Key(profilePhoto);
      if (s3Key) {
        profilePhoto = await s3GenerateSignedUrl(s3Key);
      }
    }

    // Handle documents
    const documents = await Promise.all(
      (customerObj.documents || []).map(async (doc) => {
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

    // Handle additional documents
    const additionalDocuments = await Promise.all(
      (customerObj.additionalDocuments || []).map(async (doc) => {
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
      ...customerObj,
      personalDetails: {
        ...customerObj.personalDetails,
        profilePhoto
      },
      documents,
      additionalDocuments
    };
  } catch (error) {
    logger.error('Error transforming customer URLs:', error);
    return customerObj; // Return original object if transformation fails
  }
};

// Create new customer
const createCustomer = async (req, res) => {
  try {
    const customerData = req.body;
    
    // Handle file uploads if any
    if (req.files) {
      // Profile photo
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        customerData.personalDetails = customerData.personalDetails || {};
        customerData.personalDetails.profilePhoto = req.files.profilePhoto[0].location;
      }

      // Documents
      if (req.files.documents && req.files.documents.length > 0) {
        customerData.documents = req.files.documents.map(file => ({
          documentType: req.body.documentTypes?.[req.files.documents.indexOf(file)] || 'other',
          documentUrl: file.location,
          originalName: file.originalname,
          fileSize: file.size
        }));
      }

      // Additional documents
      if (req.files.additionalDocuments && req.files.additionalDocuments.length > 0) {
        // Parse additional document names properly
        let additionalDocumentNames = req.body.additionalDocumentNames;
        
        // Handle if it's a string (single item) or array
        if (typeof additionalDocumentNames === 'string') {
          additionalDocumentNames = [additionalDocumentNames];
        } else if (!Array.isArray(additionalDocumentNames)) {
          additionalDocumentNames = [];
        }

        customerData.additionalDocuments = req.files.additionalDocuments.map((file, index) => ({
          name: additionalDocumentNames[index] || file.originalname,
          documentUrl: file.location,
          originalName: file.originalname,
          fileSize: file.size
        }));
      }
    }

    // Set created by admin
    customerData.createdBy = req.admin._id;

    // Create customer
    const customer = await Customer.create(customerData);

    logger.info('Customer created:', {
      customerId: customer.customerId,
      createdBy: req.admin._id,
      customerType: customer.customerType,
      ip: req.ip
    });

    const customerWithSignedUrls = await transformCustomerUrls(customer);
    successResponse(res, { customer: customerWithSignedUrls }, 'Customer created successfully', 201);
  } catch (error) {
    logger.error('Create customer error:', error);
    
    // If it's a validation error, return specific error
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, 'Validation Error', 400, errors);
    }

    // If it's a duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return errorResponse(res, `${field} already exists`, 400);
    }

    return errorResponse(res, 'Failed to create customer', 500);
  }
};

// Get all customers with pagination, search, and filtering
const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      customerType = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search query
    const searchQuery = { isActive: true };

    // Add search functionality
    if (search.trim()) {
      searchQuery.$or = [
        { customerId: { $regex: search, $options: 'i' } },
        { 'personalDetails.firstName': { $regex: search, $options: 'i' } },
        { 'personalDetails.lastName': { $regex: search, $options: 'i' } },
        { 'personalDetails.email': { $regex: search, $options: 'i' } },
        { 'personalDetails.mobileNumber': { $regex: search, $options: 'i' } }
      ];
    }

    // Add customer type filter
    if (customerType !== 'all') {
      searchQuery.customerType = customerType;
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries
    const [customers, totalCount] = await Promise.all([
      Customer.find(searchQuery)
        .populate('createdBy', 'name email')
        .populate('lastUpdatedBy', 'name email')
        .sort(sortObject)
        .skip(skip)
        .limit(limitNumber),
      Customer.countDocuments(searchQuery)
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

    logger.info('Customers retrieved:', {
      requestedBy: req.admin._id,
      totalCount,
      page: pageNumber,
      search: search || 'none',
      customerType,
      ip: req.ip
    });

    // Transform customers with signed URLs (now async)
    const customersWithSignedUrls = await Promise.all(
      customers.map(customer => transformCustomerUrls(customer))
    );

    successResponse(res, {
      customers: customersWithSignedUrls,
      pagination,
      filters: {
        search,
        customerType,
        sortBy,
        sortOrder
      }
    }, 'Customers retrieved successfully', 200);

  } catch (error) {
    logger.error('Get customers error:', error);
    return errorResponse(res, 'Failed to retrieve customers', 500);
  }
};

// Get customer by ID
const getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const customer = await Customer.findById(customerId)
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email');

    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    const customerWithSignedUrls = await transformCustomerUrls(customer);
    successResponse(res, { customer: customerWithSignedUrls }, 'Customer retrieved successfully', 200);
  } catch (error) {
    logger.error('Get customer by ID error:', error);
    return errorResponse(res, 'Failed to retrieve customer', 500);
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const updateData = { ...req.body };

    // Get existing customer first
    const existingCustomer = await Customer.findById(customerId);
    if (!existingCustomer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    // PHASE 1: Collect files to be deleted from S3
    const filesToDeleteFromS3 = [];

    // Parse JSON strings if they exist
    try {
      if (typeof updateData.personalDetails === 'string') {
        updateData.personalDetails = JSON.parse(updateData.personalDetails);
      }
      if (typeof updateData.corporateDetails === 'string') {
        updateData.corporateDetails = JSON.parse(updateData.corporateDetails);
      }
      if (typeof updateData.familyDetails === 'string') {
        updateData.familyDetails = JSON.parse(updateData.familyDetails);
      }
      if (typeof updateData.documents === 'string') {
        updateData.documents = JSON.parse(updateData.documents);
      }
      if (typeof updateData.additionalDocuments === 'string') {
        updateData.additionalDocuments = JSON.parse(updateData.additionalDocuments);
      }

      // PHASE 1: Parse deleted files information
      let deletedDocuments = [];
      let deletedAdditionalDocuments = [];
      let deletedProfilePhoto = null;

      if (updateData.deletedDocuments && typeof updateData.deletedDocuments === 'string') {
        deletedDocuments = JSON.parse(updateData.deletedDocuments);
      }
      if (updateData.deletedAdditionalDocuments && typeof updateData.deletedAdditionalDocuments === 'string') {
        deletedAdditionalDocuments = JSON.parse(updateData.deletedAdditionalDocuments);
      }
      if (updateData.deletedProfilePhoto) {
        deletedProfilePhoto = updateData.deletedProfilePhoto;
      }

      // Collect S3 keys for files to be deleted
      deletedDocuments.forEach(doc => {
        const s3Key = extractS3KeyEnhanced(doc.documentUrl);
        if (s3Key) filesToDeleteFromS3.push(s3Key);
      });

      deletedAdditionalDocuments.forEach(doc => {
        const s3Key = extractS3KeyEnhanced(doc.documentUrl);
        if (s3Key) filesToDeleteFromS3.push(s3Key);
      });

      if (deletedProfilePhoto) {
        const s3Key = extractS3KeyEnhanced(deletedProfilePhoto);
        if (s3Key) filesToDeleteFromS3.push(s3Key);
      }

    } catch (parseError) {
      logger.error('JSON parsing error:', parseError);
      return errorResponse(res, 'Invalid JSON data in request', 400);
    }

    // PHASE 2: Handle profile photo replacement
    if (req.files && req.files.profilePhoto && req.files.profilePhoto[0]) {
      // If replacing profile photo, add old one to deletion list
      if (existingCustomer.personalDetails?.profilePhoto) {
        const oldProfilePhotoKey = extractS3KeyEnhanced(existingCustomer.personalDetails.profilePhoto);
        if (oldProfilePhotoKey && !filesToDeleteFromS3.includes(oldProfilePhotoKey)) {
          filesToDeleteFromS3.push(oldProfilePhotoKey);
        }
      }
      updateData.personalDetails = updateData.personalDetails || {};
      updateData.personalDetails.profilePhoto = req.files.profilePhoto[0].location;
    }

    // Handle existing documents - properly maintain existing ones without duplicating
    let finalDocuments = [];
    if (updateData.documents && Array.isArray(updateData.documents)) {
      finalDocuments = updateData.documents.filter(doc => {
        return doc.existingUrl && doc.documentType && doc._id;
      }).map(doc => ({
        _id: doc._id,
        documentType: doc.documentType,
        documentUrl: doc.existingUrl,
        originalName: doc.existingName || 'Document',
        fileSize: doc.fileSize
      }));
    }

    // Handle existing additional documents - properly maintain existing ones without duplicating
    let finalAdditionalDocuments = [];
    if (updateData.additionalDocuments && Array.isArray(updateData.additionalDocuments)) {
      finalAdditionalDocuments = updateData.additionalDocuments.filter(doc => {
        return doc.existingUrl && doc.name && doc._id;
      }).map(doc => ({
        _id: doc._id,
        name: doc.name,
        documentUrl: doc.existingUrl,
        originalName: doc.existingName || doc.name,
        fileSize: doc.fileSize
      }));
    }

    // Handle file uploads if any
    if (req.files) {
      // FIXED: Handle new documents - check if replacing existing ones
      const documentsFiles = req.files.newDocuments || req.files.documents;
      if (documentsFiles && documentsFiles.length > 0) {
        let documentTypes = req.body.newDocumentTypes || req.body.documentTypes;
        
        if (typeof documentTypes === 'string') {
          documentTypes = [documentTypes];
        } else if (!Array.isArray(documentTypes)) {
          documentTypes = [];
        }

        documentsFiles.forEach((file, index) => {
          const documentType = documentTypes[index] || 'other';
          
          // FIXED: Check if this document type already exists and is being replaced
          const existingDocIndex = finalDocuments.findIndex(doc => doc.documentType === documentType);
          
          if (existingDocIndex >= 0) {
            // FIXED: Add the old document to deletion list before replacing
            const oldDocUrl = finalDocuments[existingDocIndex].documentUrl;
            const oldS3Key = extractS3KeyEnhanced(oldDocUrl);
            if (oldS3Key && !filesToDeleteFromS3.includes(oldS3Key)) {
              filesToDeleteFromS3.push(oldS3Key);
            }
            
            // Replace existing document
            finalDocuments[existingDocIndex] = {
              _id: finalDocuments[existingDocIndex]._id, // Keep the same ID
              documentType: documentType,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            };
          } else {
            // Add as new document
            finalDocuments.push({
              documentType: documentType,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            });
          }
        });
      }

      // FIXED: Handle additional documents with better replacement logic
      const additionalDocsFiles = req.files.newAdditionalDocuments || req.files.additionalDocuments;
      if (additionalDocsFiles && additionalDocsFiles.length > 0) {
        let additionalDocumentNames = req.body.newAdditionalDocumentNames || req.body.additionalDocumentNames;
        
        if (typeof additionalDocumentNames === 'string') {
          additionalDocumentNames = [additionalDocumentNames];
        } else if (!Array.isArray(additionalDocumentNames)) {
          additionalDocumentNames = [];
        }

        // Process each new additional document
        additionalDocsFiles.forEach((file, index) => {
          const documentName = additionalDocumentNames[index] || file.originalname;
          
          // FIXED: Check if this document name already exists and is being replaced
          const existingDocIndex = finalAdditionalDocuments.findIndex(doc => doc.name === documentName);
          
          if (existingDocIndex >= 0) {
            // FIXED: Add the old document to deletion list before replacing
            const oldDocUrl = finalAdditionalDocuments[existingDocIndex].documentUrl;
            const oldS3Key = extractS3KeyEnhanced(oldDocUrl);
            if (oldS3Key && !filesToDeleteFromS3.includes(oldS3Key)) {
              filesToDeleteFromS3.push(oldS3Key);
            }
            
            // Replace existing document
            finalAdditionalDocuments[existingDocIndex] = {
              _id: finalAdditionalDocuments[existingDocIndex]._id, // Keep the same ID
              name: documentName,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            };
          } else {
            // Add as new document
            finalAdditionalDocuments.push({
              name: documentName,
              documentUrl: file.location,
              originalName: file.originalname,
              fileSize: file.size
            });
          }
        });
      }
    }

    // Set the final document arrays
    updateData.documents = finalDocuments;
    updateData.additionalDocuments = finalAdditionalDocuments;

    // Set last updated by
    updateData.lastUpdatedBy = req.admin._id;

    // Remove any undefined or null values from personalDetails
    if (updateData.personalDetails) {
      Object.keys(updateData.personalDetails).forEach(key => {
        if (updateData.personalDetails[key] === undefined || updateData.personalDetails[key] === null) {
          delete updateData.personalDetails[key];
        }
      });
    }

    logger.info('Updating customer with data:', {
      customerId,
      updateDataKeys: Object.keys(updateData),
      documentsCount: updateData.documents?.length || 0,
      additionalDocumentsCount: updateData.additionalDocuments?.length || 0,
      filesToDelete: filesToDeleteFromS3.length,
      filesToDeleteList: filesToDeleteFromS3, // ADDED: Log the actual files being deleted
      finalDocuments: finalDocuments.map(doc => ({ type: doc.documentType, url: doc.documentUrl })),
      finalAdditionalDocuments: finalAdditionalDocuments.map(doc => ({ name: doc.name, url: doc.documentUrl }))
    });

    // Update database first (safer approach)
    const customer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('lastUpdatedBy', 'name email');

    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    // PHASE 2: Delete old files from S3 after successful database update
    if (filesToDeleteFromS3.length > 0) {
      try {
        logger.info('Starting S3 cleanup for files:', filesToDeleteFromS3);
        const deleteResults = await deleteMultipleFilesFromS3(filesToDeleteFromS3);
        const failedDeletions = deleteResults.filter(result => !result.success);
        
        if (failedDeletions.length > 0) {
          logger.warn('Some S3 files failed to delete:', failedDeletions);
          // Continue execution - this is not critical to the update operation
        }
        
        logger.info('S3 cleanup completed:', {
          total: deleteResults.length,
          successful: deleteResults.length - failedDeletions.length,
          failed: failedDeletions.length,
          successfulDeletions: deleteResults.filter(result => result.success).map(result => result.key)
        });
      } catch (s3Error) {
        logger.error('S3 cleanup error:', s3Error);
        // Don't fail the entire operation due to S3 cleanup issues
      }
    }

    logger.info('Customer updated successfully:', {
      customerId: customer.customerId,
      updatedBy: req.admin._id,
      documentsAfterUpdate: customer.documents?.length || 0,
      additionalDocumentsAfterUpdate: customer.additionalDocuments?.length || 0,
      s3FilesDeleted: filesToDeleteFromS3.length,
      ip: req.ip
    });

    const customerWithSignedUrls = await transformCustomerUrls(customer);
    successResponse(res, { customer: customerWithSignedUrls }, 'Customer updated successfully', 200);
  } catch (error) {
    logger.error('Update customer error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, 'Validation Error', 400, errors);
    }

    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid customer ID format', 400);
    }

    return errorResponse(res, 'Failed to update customer', 500);
  }
};

// PHASE 1: Enhanced delete document function with better S3 key extraction
const deleteDocument = async (req, res) => {
  try {
    const { customerId, documentId } = req.params;
    const { documentType } = req.query; // 'documents' or 'additionalDocuments'

    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    let documentArray = documentType === 'additionalDocuments' ? 
      customer.additionalDocuments : customer.documents;
    
    const documentIndex = documentArray.findIndex(doc => doc._id.toString() === documentId);
    
    if (documentIndex === -1) {
      return errorResponse(res, 'Document not found', 404);
    }

    const document = documentArray[documentIndex];
    
    // PHASE 1: Enhanced S3 deletion with better key extraction
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
      // Continue with database deletion even if S3 deletion fails
    }

    // Remove from array
    documentArray.splice(documentIndex, 1);
    customer.lastUpdatedBy = req.admin._id;
    await customer.save();

    logger.info('Document deleted:', {
      customerId: customer.customerId,
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

// Delete customer (soft delete)
const deleteCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    // Soft delete by setting isActive to false
    customer.isActive = false;
    customer.lastUpdatedBy = req.admin._id;
    await customer.save();

    logger.info('Customer deleted (soft):', {
      customerId: customer.customerId,
      deletedBy: req.admin._id,
      ip: req.ip
    });

    successResponse(res, null, 'Customer deleted successfully', 200);
  } catch (error) {
    logger.error('Delete customer error:', error);
    return errorResponse(res, 'Failed to delete customer', 500);
  }
};

// Toggle customer status
const toggleCustomerStatus = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    await customer.toggleActiveStatus(req.admin);

    logger.info('Customer status changed:', {
      customerId: customer.customerId,
      changedBy: req.admin._id,
      newStatus: customer.isActive,
      ip: req.ip
    });

    successResponse(res, { 
      customer: { 
        id: customer._id, 
        customerId: customer.customerId,
        isActive: customer.isActive 
      } 
    }, `Customer ${customer.isActive ? 'activated' : 'deactivated'} successfully`, 200);
  } catch (error) {
    logger.error('Toggle customer status error:', error);
    return errorResponse(res, 'Failed to change customer status', 500);
  }
};

// Get customer statistics
const getCustomerStats = async (req, res) => {
  try {
    const stats = await Customer.getCustomerStats();

    successResponse(res, { stats }, 'Customer statistics retrieved successfully', 200);
  } catch (error) {
    logger.error('Get customer stats error:', error);
    return errorResponse(res, 'Failed to retrieve customer statistics', 500);
  }
};

// Export customers to Excel
const exportCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Prepare data for Excel export
    const exportData = customers.map(customer => ({
      'Customer ID': customer.customerId,
      'Customer Type': customer.customerType,
      'Name': customer.personalDetails?.firstName ? 
        `${customer.personalDetails.firstName} ${customer.personalDetails.middleName || ''} ${customer.personalDetails.lastName}`.trim() : 
        'N/A',
      'Email': customer.personalDetails?.email || 'N/A',
      'Mobile': customer.personalDetails?.mobileNumber || 'N/A',
      'State': customer.personalDetails?.state || 'N/A',
      'City': customer.personalDetails?.city || 'N/A',
      'Gender': customer.personalDetails?.gender || 'N/A',
      'Birth Date': customer.personalDetails?.birthDate ? 
        new Date(customer.personalDetails.birthDate).toLocaleDateString('en-IN') : 'N/A',
      'Age': customer.personalDetails?.age || 'N/A',
      'Marital Status': customer.personalDetails?.maritalStatus || 'N/A',
      'Annual Income': customer.personalDetails?.annualIncome || 'N/A',
      'PAN Number': customer.personalDetails?.panNumber || 'N/A',
      'GST Number': customer.personalDetails?.gstNumber || 'N/A',
      'Family Members': customer.familyDetails?.length || 0,
      'Documents': customer.documents?.length || 0,
      'Additional Documents': customer.additionalDocuments?.length || 0,
      'Corporate Details': customer.corporateDetails?.length || 0,
      'Created Date': new Date(customer.createdAt).toLocaleDateString('en-IN'),
      'Created By': customer.createdBy?.name || 'N/A'
    }));

    // Set headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=customers_export_${new Date().toISOString().split('T')[0]}.xlsx`);

    // For now, return JSON data (Excel generation can be added with a library like xlsx)
    successResponse(res, { 
      exportData,
      totalRecords: exportData.length,
      exportDate: new Date().toISOString()
    }, 'Customer data exported successfully', 200);

  } catch (error) {
    logger.error('Export customers error:', error);
    return errorResponse(res, 'Failed to export customer data', 500);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,
  getCustomerStats,
  exportCustomers,
  deleteDocument
};