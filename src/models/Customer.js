// src/models/Customer.js - FIXED VERSION
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Auto-generated Customer ID - FIXED: Not required since it's auto-generated
  customerId: {
    type: String,
    unique: true,
    index: true
    // Removed required: true since it's auto-generated
  },

  // Customer Type
  customerType: {
    type: String,
    enum: ['individual', 'corporate'],
    required: [true, 'Customer type is required'],
    default: 'individual'
  },

  // Personal Details (for individual customers)
  personalDetails: {
    firstName: {
      type: String,
      required: function() { return this.customerType === 'individual'; },
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    middleName: {
      type: String,
      trim: true,
      maxlength: [50, 'Middle name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: function() { return this.customerType === 'individual'; },
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    state: {
      type: String,
      required: function() { return this.customerType === 'individual'; },
      trim: true
    },
    city: {
      type: String,
      required: function() { return this.customerType === 'individual'; },
      trim: true
    },
    country: {
      type: String,
      required: function() { return this.customerType === 'individual'; },
      trim: true,
      default: 'India'
    },
    address: {
      type: String,
      required: function() { return this.customerType === 'individual'; },
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    birthPlace: {
      type: String,
      trim: true,
      maxlength: [100, 'Birth place cannot exceed 100 characters']
    },
    birthDate: {
      type: Date,
      required: function() { return this.customerType === 'individual'; }
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [150, 'Age cannot exceed 150']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: function() { return this.customerType === 'individual'; }
    },
    height: {
      type: Number, // in feet
      min: [0, 'Height cannot be negative'],
      max: [10, 'Height cannot exceed 10 feet']
    },
    weight: {
      type: Number, // in kg
      min: [0, 'Weight cannot be negative'],
      max: [500, 'Weight cannot exceed 500 kg']
    },
    education: {
      type: String,
      trim: true,
      maxlength: [100, 'Education cannot exceed 100 characters']
    },
    maritalStatus: {
      type: String,
      enum: ['married', 'unmarried'],
      required: function() { return this.customerType === 'individual'; }
    },
    // FIXED: Allow empty string and undefined for optional enum fields
    businessOrJob: {
      type: String,
      enum: {
        values: ['business', 'job', ''], // Allow empty string
        message: 'Business/Job type must be either "business", "job", or empty'
      }
    },
    nameOfBusinessJob: {
      type: String,
      trim: true,
      maxlength: [100, 'Business/Job name cannot exceed 100 characters']
    },
    typeOfDuty: {
      type: String,
      trim: true,
      maxlength: [100, 'Type of duty cannot exceed 100 characters']
    },
    annualIncome: {
      type: Number,
      min: [0, 'Annual income cannot be negative']
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
    },
    profilePhoto: {
      type: String // URL to uploaded photo
    }
  },

  // Corporate Details (array for multiple corporate entities)
  corporateDetails: [{
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    mobileNumber: {
      type: String,
      required: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number']
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    annualIncome: {
      type: Number,
      min: [0, 'Annual income cannot be negative']
    },
    panNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    }
  }],

  // Family Details (array for multiple family members)
  familyDetails: [{
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    middleName: {
      type: String,
      trim: true,
      maxlength: [50, 'Middle name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    birthDate: {
      type: Date,
      required: true
    },
    age: {
      type: Number,
      required: true,
      min: [0, 'Age cannot be negative'],
      max: [150, 'Age cannot exceed 150']
    },
    height: {
      type: Number, // in feet
      min: [0, 'Height cannot be negative'],
      max: [10, 'Height cannot exceed 10 feet']
    },
    weight: {
      type: Number, // in kg
      min: [0, 'Weight cannot be negative'],
      max: [500, 'Weight cannot exceed 500 kg']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    relationship: {
      type: String,
      enum: [
        'husband', 
        'wife', 
        'daughter', 
        'brother', 
        'sister', 
        'son', 
        'mother', 
        'father', 
        'mother_in_law', 
        'father_in_law', 
        'daughter_in_law', 
        'nephew', 
        'other'
      ],
      required: true
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    },
    mobileNumber: {
      type: String,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number']
    }
  }],

  // Document Uploads (array for multiple documents)
  documents: [{
    documentType: {
      type: String,
      enum: ['aadhaar_card', 'pan_card', 'driving_license', 'mediclaim', 'rc_book', 'other'],
      required: true
    },
    documentUrl: {
      type: String,
      required: true
    },
    originalName: {
      type: String
    },
    fileSize: {
      type: Number
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Additional Documents (array for other documents)
  additionalDocuments: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Document name cannot exceed 100 characters']
    },
    documentUrl: {
      type: String,
      required: true
    },
    originalName: {
      type: String
    },
    fileSize: {
      type: Number
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
customerSchema.index({ customerId: 1 }, { unique: true });
customerSchema.index({ 'personalDetails.email': 1 }, { unique: true, sparse: true });
customerSchema.index({ 'personalDetails.mobileNumber': 1 });
customerSchema.index({ 'personalDetails.panNumber': 1 }, { sparse: true });
customerSchema.index({ customerType: 1 });
customerSchema.index({ isActive: 1 });
customerSchema.index({ createdBy: 1 });
customerSchema.index({ createdAt: -1 });

// Text index for search functionality
customerSchema.index({
  'personalDetails.firstName': 'text',
  'personalDetails.lastName': 'text',
  'personalDetails.email': 'text',
  'personalDetails.mobileNumber': 'text',
  customerId: 'text'
}, {
  weights: {
    customerId: 10,
    'personalDetails.firstName': 8,
    'personalDetails.lastName': 8,
    'personalDetails.email': 5,
    'personalDetails.mobileNumber': 3
  },
  name: 'customer_text_search'
});

// Virtual for full name
customerSchema.virtual('personalDetails.fullName').get(function() {
  if (this.customerType === 'individual' && this.personalDetails) {
    const { firstName, middleName, lastName } = this.personalDetails;
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
  }
  return '';
});

// FIXED: Pre-save middleware to generate customer ID
customerSchema.pre('save', async function(next) {
  // Only generate customerId for new documents
  if (this.isNew && !this.customerId) {
    try {
      let isUnique = false;
      let customerId;
      
      while (!isUnique) {
        // Generate customer ID with format: SEVA-(6 digit numbers)
        const numbers = '0123456789';
        
        let numberPart = '';
        for (let i = 0; i < 6; i++) {
          numberPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        
        customerId = `SEVA-${numberPart}`;
        
        // Check if this ID already exists
        const existingCustomer = await this.constructor.findOne({ customerId });
        if (!existingCustomer) {
          isUnique = true;
        }
      }
      
      this.customerId = customerId;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Static methods
customerSchema.statics.getCustomersList = function(filters = {}) {
  const query = { isActive: true };
  
  // Add search functionality
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  // Add customer type filter
  if (filters.customerType && filters.customerType !== 'all') {
    query.customerType = filters.customerType;
  }
  
  return this.find(query)
    .populate('createdBy', 'name email')
    .populate('lastUpdatedBy', 'name email')
    .sort(filters.sort || { createdAt: -1 });
};

customerSchema.statics.getCustomerStats = async function() {
  const [
    totalCustomers,
    individualCustomers,
    corporateCustomers,
    recentCustomers
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ customerType: 'individual', isActive: true }),
    this.countDocuments({ customerType: 'corporate', isActive: true }),
    this.countDocuments({
      isActive: true,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
  ]);

  return {
    totalCustomers,
    individualCustomers,
    corporateCustomers,
    recentCustomers,
    individualPercentage: totalCustomers > 0 ? Math.round((individualCustomers / totalCustomers) * 100) : 0,
    corporatePercentage: totalCustomers > 0 ? Math.round((corporateCustomers / totalCustomers) * 100) : 0
  };
};

// Method to toggle active status
customerSchema.methods.toggleActiveStatus = function(updatedBy) {
  this.isActive = !this.isActive;
  this.lastUpdatedBy = updatedBy;
  return this.save();
};

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;