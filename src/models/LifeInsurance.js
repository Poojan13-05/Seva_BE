const mongoose = require('mongoose');

const lifeInsuranceSchema = new mongoose.Schema({
  // Client Details - Store customer _id for population
  clientDetails: {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required']
    },
    insuredName: {
      type: String,
      trim: true
    }
  },

  // Insurance Details
  insuranceDetails: {
    insuranceCompany: {
      type: String,
      enum: [
        'Acko General Insurance Limited',
        'Agriculture Insurance Company on India Ltd',
        'Bajaj Allianz General Insurance Company Limited',
        'Cholamandalam MS General Insurance Company Limited',
        'ECGC Limited',
        'Future Generali India Insurance Co Ltd',
        'Go digit General Insurance Ltd',
        'HDFC ERGO General Insurance Ltd',
        'ICICI LOMBARD General Insurance Ltd',
        'IFFCO TOKIO General Insurance Co Ltd',
        'Kotak Mahindra General Insurance Company Limited',
        'Kshema General Insurance Limited',
        'Libertly General Insurance Ltd',
        'Magma HDI General Insurance Co Ltd',
        'National Insurance Co Ltd',
        'Navi General Insurance Limited',
        'Raheja QBE General Insurance Co Ltd',
        'Reliance General Insurance Co Ltd',
        'Royal Sundaram General Insurance Co Ltd',
        'SBI General Insurance Co Ltd',
        'Shriram General Insurance Co Ltd',
        'TATA AIG General Insurance Co Ltd',
        'The New India Assurance Co Ltd',
        'The Oriental Insurance Company Limited',
        'United India Insurance Company Limited',
        'Universal Sampo General Insurance Co Ltd',
        'Zuno General Insurance Ltd'
      ]
    },
    agencyCode: {
      type: String,
      enum: ['Agency Code', 'Broker Code']
    },
    policyType: {
      type: String,
      enum: ['New', 'Renewal']
    },
    planName: {
      type: String,
      trim: true
    },
    paymentMode: {
      type: String,
      enum: ['Yearly', 'Half Yearly', 'Quaterly', 'Monthly', 'Single']
    },
    policyNumber: {
      type: String,
      trim: true
    },
    policyDate: {
      type: Date
    },
    policyStartDate: {
      type: Date
    },
    policyEndDate: {
      type: Date
    },
    bookingDate: {
      type: Date
    },
    riskStartDate: {
      type: Date
    },
    policyTerm: {
      type: Number
    },
    premiumPaymentNumber: {
      type: Number
    },
    sumInsured: {
      type: Number
    },
    netPremium: {
      type: Number
    },
    firstYearGST: {
      type: Number
    },
    secondYearGST: {
      type: Number
    },
    thirdYearGST: {
      type: Number
    },
    totalPremium: {
      type: Number
    },
    bonus: {
      type: Number,
      default: 0
    },
    fund: {
      type: Number,
      default: 0,
          }
  },

  // Commission Details
  commissionDetails: {
    mainAgentCommissionPercent: {
      type: Number,
    },
    firstYear: {
      type: Number,
    },
    mainAgentCommissionAmount: {
      type: Number,
    },
    mainAgentTDSPercent: {
      type: Number,

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

  // Nominee Details
  nomineeDetails: {
    nomineeName: {
      type: String,
      trim: true
    },
    nomineeRelationship: {
      type: String,
      trim: true
    },
    nomineeAge: {
      type: Number,
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

  // Rider Details
  riderDetails: {
    termRider: {
      amount: {
        type: Number,
        default: 0,
              },
      note: {
        type: String,
        trim: true,
              }
    },
    criticalIllnessRider: {
      amount: {
        type: Number,
        default: 0,
              },
      note: {
        type: String,
        trim: true,
              }
    },
    accidentRider: {
      amount: {
        type: Number,
        default: 0,
              },
      note: {
        type: String,
        trim: true,
              }
    },
    pwbRider: {
      amount: {
        type: Number,
        default: 0,
              },
      note: {
        type: String,
        trim: true,
              }
    },
    othersRider: {
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Others rider amount cannot be negative']
      },
      note: {
        type: String,
        trim: true,
              }
    }
  },

  // Bank Details
  bankDetails: {
    bankName: {
      type: String,
      trim: true
    },
    accountType: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    accountHolderName: {
      type: String,
      trim: true
    }
  },

  // Upload Documents (array for multiple documents)
  uploadDocuments: [{
    documentName: {
      type: String,
      enum: ['Document', 'Aadhaar Card', 'Pancard', 'Driving License', 'Mediclaim', 'RC Book', 'Other File'],
          },
    documentUrl: {
      type: String,
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
lifeInsuranceSchema.index({ 'insuranceDetails.policyNumber': 1 });
lifeInsuranceSchema.index({ 'clientDetails.customer': 1 });
lifeInsuranceSchema.index({ 'insuranceDetails.insuranceCompany': 1 });
lifeInsuranceSchema.index({ 'insuranceDetails.policyType': 1 });
lifeInsuranceSchema.index({ isActive: 1 });
lifeInsuranceSchema.index({ createdBy: 1 });
lifeInsuranceSchema.index({ createdAt: -1 });

// Text index for search functionality
lifeInsuranceSchema.index({
  'insuranceDetails.policyNumber': 'text',
  'clientDetails.insuredName': 'text',
  'insuranceDetails.planName': 'text',
  'nomineeDetails.nomineeName': 'text'
}, {
  weights: {
    'insuranceDetails.policyNumber': 10,
    'clientDetails.insuredName': 8,
    'insuranceDetails.planName': 5,
    'nomineeDetails.nomineeName': 3
  },
  name: 'life_insurance_text_search'
});

// Virtual for calculating total rider amount
lifeInsuranceSchema.virtual('totalRiderAmount').get(function() {
  const riders = this.riderDetails || {};
  return (riders.termRider?.amount || 0) +
         (riders.criticalIllnessRider?.amount || 0) +
         (riders.accidentRider?.amount || 0) +
         (riders.pwbRider?.amount || 0) +
         (riders.othersRider?.amount || 0);
});

// Static methods
lifeInsuranceSchema.statics.getLifeInsuranceList = function(filters = {}) {
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

lifeInsuranceSchema.statics.getLifeInsuranceStats = async function() {
  const [
    totalPolicies,
    newPolicies,
    renewalPolicies,
    totalSumInsured,
    recentPolicies
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'New', isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'Renewal', isActive: true }),
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
    totalSumInsured: totalSumInsured[0]?.total || 0,
    recentPolicies,
    newPolicyPercentage: totalPolicies > 0 ? Math.round((newPolicies / totalPolicies) * 100) : 0,
    renewalPolicyPercentage: totalPolicies > 0 ? Math.round((renewalPolicies / totalPolicies) * 100) : 0
  };
};

// Method to toggle active status
lifeInsuranceSchema.methods.toggleActiveStatus = function(updatedBy) {
  this.isActive = !this.isActive;
  this.lastUpdatedBy = updatedBy;
  return this.save();
};

const LifeInsurance = mongoose.model('LifeInsurance', lifeInsuranceSchema);

module.exports = LifeInsurance;