// src/controllers/customerController.js
const Customer = require('../models/Customer');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { generateSignedUrl, deleteFileFromS3 } = require('../middleware/upload');
const { generateSignedUrl: s3GenerateSignedUrl, extractS3Key } = require('../services/s3Sevice');

// Helper function to transform customer URLs to signed URLs
const transformCustomerUrls = (customer) => {
  const customerObj = customer.toObject ? customer.toObject() : customer;
  
  return {
    ...customerObj,
    personalDetails: {
      ...customerObj.personalDetails,
      profilePhoto: customerObj.personalDetails?.profilePhoto 
        ? s3GenerateSignedUrl(extractS3Key(customerObj.personalDetails.profilePhoto))
        : null
    },
    documents: customerObj.documents?.map(doc => ({
      ...doc,
      documentUrl: s3GenerateSignedUrl(extractS3Key(doc.documentUrl))
    })) || [],
    additionalDocuments: customerObj.additionalDocuments?.map(doc => ({
      ...doc,
      documentUrl: s3GenerateSignedUrl(extractS3Key(doc.documentUrl))
    })) || []
  };
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
        customerData.additionalDocuments = req.files.additionalDocuments.map((file, index) => ({
          name: req.body.additionalDocumentNames?.[index] || file.originalname,
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

    successResponse(res, { customer: transformCustomerUrls(customer) }, 'Customer created successfully', 201);
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

    // Transform customers with signed URLs
    const customersWithSignedUrls = customers.map(transformCustomerUrls);

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

    successResponse(res, { customer: transformCustomerUrls(customer) }, 'Customer retrieved successfully', 200);
  } catch (error) {
    logger.error('Get customer by ID error:', error);
    return errorResponse(res, 'Failed to retrieve customer', 500);
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const updateData = req.body;

    // Handle file uploads if any
    if (req.files) {
      // Profile photo
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        updateData.personalDetails = updateData.personalDetails || {};
        updateData.personalDetails.profilePhoto = req.files.profilePhoto[0].location;
      }

      // Documents - append to existing documents
      if (req.files.documents && req.files.documents.length > 0) {
        const newDocuments = req.files.documents.map(file => ({
          documentType: req.body.documentTypes?.[req.files.documents.indexOf(file)] || 'other',
          documentUrl: file.location,
          originalName: file.originalname,
          fileSize: file.size
        }));
        
        // Get existing customer to append documents
        const existingCustomer = await Customer.findById(customerId);
        updateData.documents = [...(existingCustomer?.documents || []), ...newDocuments];
      }

      // Additional documents - append to existing
      if (req.files.additionalDocuments && req.files.additionalDocuments.length > 0) {
        const newAdditionalDocs = req.files.additionalDocuments.map((file, index) => ({
          name: req.body.additionalDocumentNames?.[index] || file.originalname,
          documentUrl: file.location,
          originalName: file.originalname,
          fileSize: file.size
        }));
        
        const existingCustomer = await Customer.findById(customerId);
        updateData.additionalDocuments = [...(existingCustomer?.additionalDocuments || []), ...newAdditionalDocs];
      }
    }

    // Set last updated by
    updateData.lastUpdatedBy = req.admin._id;

    const customer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('lastUpdatedBy', 'name email');

    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    logger.info('Customer updated:', {
      customerId: customer.customerId,
      updatedBy: req.admin._id,
      ip: req.ip
    });

    successResponse(res, { customer: transformCustomerUrls(customer) }, 'Customer updated successfully', 200);
  } catch (error) {
    logger.error('Update customer error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, 'Validation Error', 400, errors);
    }

    return errorResponse(res, 'Failed to update customer', 500);
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

// Delete document from customer
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
    
    // Delete from S3
    try {
      const s3Key = document.documentUrl.split('/').pop(); // Extract key from URL
      await deleteFileFromS3(s3Key);
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