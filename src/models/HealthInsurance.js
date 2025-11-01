const mongoose = require('mongoose');

const healthInsuranceSchema = new mongoose.Schema({
  // Client Details - Store customer _id for population
  clientDetails: {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    }
  },

  // Insurance Details
  insuranceDetails: {
    insuranceCompany: {
      type: String,
      enum: [
        'Acko General Insurance Limited',
        'Aditya Birla Health Insurance',
        'Agriculture Insurance Company of India Ltd',
        'Bajaj Allianz General Insurance Company Limited',
        'Care Health Insurance Ltd',
        'Cholamandalam MS General Insurance Co Ltd',
        'ECGC Limited',
        'Future Generali India Insurance Co Ltd',
        'Go digital General Insurance Limited',
        'HDFC General Insurance Co Ltd',
        'ICICI Lombard General Insurance Co. Ltd',
        'IFFCO TOKIO General Insurance Co. Ltd',
        'Kotak Mahindra General Insurance Company Limited',
        'Kshema General Insurance Limited',
        'Liberty General Insurance Ltd',
        'Magma HDI General Insurance Co. Ltd',
        'Manipal Cigna Health Insurance Company Limited',
        'National Insurance Co. Ltd',
        'Navi General Insurance Limited',
        'Niva Bupa Health Insurance Co Ltd',
        'Raheja QBE General Insurance Co Ltd',
        'Reliance General Insurance Co Ltd',
        'Royal Sundaram General Co. Ltd',
        'SBI General Insurance Company Ltd',
        'Shriram General Insurance Company Ltd',
        'Star Health Allied Insurance Co Ltd',
        'Tata AIG General Insurance Co Ltd',
        'The New India Assurance Co. Ltd',
        'The Oriental Insurance Company Limited',
        'United India Insurance Company Ltd',
        'Universal Sompo General Insurance Co Ltd',
        'Zuno General Insurance Ltd'
      ]
    },
    agencyBrokerCode: {
      type: String,
      enum: ['Agency Code', 'Broker Code']
    },
    policyType: {
      type: String,
      enum: ['New', 'Renewal', 'Portability']
    },
    insuranceType: {
      type: String,
      enum: ['Single', 'Floater']
    },
    planName: {
      type: String,
      trim: true
    },
    policyNumber: {
      type: String,
      trim: true
    },
    policyBookingDate: {
      type: Date
    },
    policyStartDate: {
      type: Date
    },
    policyEndDate: {
      type: Date
    },
    policyTerm: {
      type: Number
    },
    paymentMode: {
      type: String,
      enum: ['Yearly', 'Half Yearly', 'Quaterly', 'Monthly', 'Single']
    },
    claimProcess: {
      type: String,
      enum: ['Inhouse', 'TPA']
    },
    sumInsured: {
      type: Number
    },
    netPremium: {
      type: Number
    },
    gstPercent: {
      type: Number
    },
    totalPremium: {
      type: Number
    }
  },

  // Commission Details
  commissionDetails: {
    mainAgentCommissionPercent: {
      type: Number
    },
    mainAgentCommission: {
      type: Number
    },
    mainAgentTDSPercent: {
      type: Number
    },
    mainAgentTDSAmount: {
      type: Number
    },
    referenceByName: {
      type: String,
      trim: true
    },
    brokerName: {
      type: String,
      trim: true
    }
  },

  // Upload Policy
  uploadPolicy: {
    policyFileUrl: {
      type: String,
      trim: true
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
  },

  // Notes
  notes: {
    note: {
      type: String,
      trim: true,
      maxlength: [1000, 'Note cannot exceed 1000 characters']
    }
  },

  // Family Details / Employee Details (array of objects)
  familyDetails: [{
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    birthDate: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other']
    },
    height: {
      type: Number
    },
    weight: {
      type: Number
    },
    relationship: {
      type: String,
      enum: ['Husband', 'Wife', 'Daughter', 'Son', 'Brother', 'Sister']
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    mobileNumber: {
      type: String,
      trim: true
    },
    sumInsured: {
      type: Number
    }
  }],

  // Upload Documents (array for multiple documents)
  uploadDocuments: [{
    documentName: {
      type: String,
      enum: ['Document', 'Aadhaar Card', 'Pancard', 'Driving Licencse', 'RC Book', 'Mediclaim', 'Other File']
    },
    documentUrl: {
      type: String
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
    ref: 'Admin'
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
healthInsuranceSchema.index({ 'insuranceDetails.policyNumber': 1 });
healthInsuranceSchema.index({ 'clientDetails.customer': 1 });
healthInsuranceSchema.index({ 'insuranceDetails.insuranceCompany': 1 });
healthInsuranceSchema.index({ 'insuranceDetails.policyType': 1 });
healthInsuranceSchema.index({ isActive: 1 });
healthInsuranceSchema.index({ createdBy: 1 });
healthInsuranceSchema.index({ createdAt: -1 });

// Text index for search functionality
healthInsuranceSchema.index({
  'insuranceDetails.policyNumber': 'text',
  'insuranceDetails.planName': 'text',
  'familyDetails.firstName': 'text',
  'familyDetails.lastName': 'text'
}, {
  weights: {
    'insuranceDetails.policyNumber': 10,
    'insuranceDetails.planName': 5,
    'familyDetails.firstName': 3,
    'familyDetails.lastName': 3
  },
  name: 'health_insurance_text_search'
});

// Static methods
healthInsuranceSchema.statics.getHealthInsuranceList = function(filters = {}) {
  const query = { isActive: true };

  // Add search functionality
  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  // Add insurance company filter
  if (filters.insuranceCompany && filters.insuranceCompany !== 'all') {
    query['insuranceDetails.insuranceCompany'] = filters.insuranceCompany;
  }

  // Add policy type filter
  if (filters.policyType && filters.policyType !== 'all') {
    query['insuranceDetails.policyType'] = filters.policyType;
  }

  return this.find(query)
    .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email personalDetails.mobileNumber')
    .populate('createdBy', 'name email')
    .populate('lastUpdatedBy', 'name email')
    .sort(filters.sort || { createdAt: -1 });
};

healthInsuranceSchema.statics.getHealthInsuranceStats = async function() {
  const [
    totalPolicies,
    newPolicies,
    renewalPolicies,
    portabilityPolicies,
    totalSumInsured,
    recentPolicies
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'New', isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'Renewal', isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'Portability', isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$insuranceDetails.sumInsured' } } }
    ]),
    this.countDocuments({
      isActive: true,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
  ]);

  return {
    totalPolicies,
    newPolicies,
    renewalPolicies,
    portabilityPolicies,
    totalSumInsured: totalSumInsured[0]?.total || 0,
    recentPolicies,
    newPolicyPercentage: totalPolicies > 0 ? Math.round((newPolicies / totalPolicies) * 100) : 0,
    renewalPolicyPercentage: totalPolicies > 0 ? Math.round((renewalPolicies / totalPolicies) * 100) : 0,
    portabilityPolicyPercentage: totalPolicies > 0 ? Math.round((portabilityPolicies / totalPolicies) * 100) : 0
  };
};

// Method to toggle active status
healthInsuranceSchema.methods.toggleActiveStatus = function(updatedBy) {
  this.isActive = !this.isActive;
  this.lastUpdatedBy = updatedBy;
  return this.save();
};

const HealthInsurance = mongoose.model('HealthInsurance', healthInsuranceSchema);

module.exports = HealthInsurance;
