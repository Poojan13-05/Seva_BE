const mongoose = require('mongoose');

const vehicleInsuranceSchema = new mongoose.Schema({
  // Client Details - Store customer _id for population
  clientDetails: {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    referenceByName: {
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
      enum: ['New', 'Renewal', 'Rollover']
    },
    insuranceType: {
      type: String,
      enum: ['Package', 'Liability']
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
    previousPolicyNumber: {
      type: String,
      trim: true
    },
    ncb: {
      type: String,
      trim: true
    },
    vehicleType: {
      type: String,
      enum: ['Old Vehicle', 'New Vehicle']
    },
    classOfVehicle: {
      type: String,
      enum: [
        'Private Car',
        'Commercial (Truck/GCV)',
        'Two Wheeler',
        'Miscellaneous (JCB/Crane/Agriculture/Tractor)',
        '3 wheeler loading Rickshaw Goods Carrying',
        '3 Wheeler passenger Rikshaw above 5+ seater',
        'Passenger carrying taxi',
        'Passenger carrying maxi',
        'Passenger bus (Route Bus)',
        'Passenger carrying two wheeler'
      ]
    },
    cngIdv: {
      type: String,
      trim: true
    },
    totalIdv: {
      type: String,
      trim: true
    },
    registrationNumber: {
      type: String,
      trim: true
    },
    engineNumber: {
      type: String,
      trim: true
    },
    chassisNumber: {
      type: String,
      trim: true
    },
    mfy: {
      type: String,
      trim: true
    },
    make: {
      type: String,
      trim: true
    },
    model: {
      type: String,
      trim: true
    },
    variant: {
      type: String,
      trim: true
    },
    seatingCapacity: {
      type: String,
      trim: true
    },
    discount: {
      type: String,
      trim: true
    },
    loading: {
      type: String,
      trim: true
    }
  },

  // Legal Liability, Financier, Accessories, Add-Ons & Optional Covers
  legalLiabilityAndCovers: {
    numberOfPersonsNonFarePaying: {
      type: String,
      trim: true
    },
    imt28NumberOfPersons: {
      type: String,
      trim: true
    },
    covers: {
      paCoverPaidDriver: { type: Boolean, default: false },
      commercialPrivatePurpose: { type: Boolean, default: false },
      ownPremisesOnly: { type: Boolean, default: false },
      lampsTyresTubes: { type: Boolean, default: false },
      toolOfTrade: { type: Boolean, default: false },
      financierHPA: { type: Boolean, default: false },
      cngLpg: { type: Boolean, default: false },
      batteryKilowatt: { type: Boolean, default: false },
      electricalAccessories: { type: Boolean, default: false },
      nonElectricalAccessories: { type: Boolean, default: false },
      zeroDepreciation: { type: Boolean, default: false },
      returnToInvoice: { type: Boolean, default: false },
      roadsideAssistance: { type: Boolean, default: false },
      keyReplacement: { type: Boolean, default: false },
      inconvenienceAllowance: { type: Boolean, default: false },
      lossOfPersonalBelongings: { type: Boolean, default: false },
      consumable: { type: Boolean, default: false },
      engineProtector: { type: Boolean, default: false },
      emiProtector: { type: Boolean, default: false },
      medicalExpenseExtension: { type: Boolean, default: false },
      batterySecure: { type: Boolean, default: false },
      additionalTowingCover: { type: Boolean, default: false },
      multipleDamageCover: { type: Boolean, default: false },
      zeroExcessCover: { type: Boolean, default: false },
      tyreGuard: { type: Boolean, default: false },
      rimSafeguard: { type: Boolean, default: false },
      lossOfIncome: { type: Boolean, default: false },
      ncbProtection: { type: Boolean, default: false }
    }
  },

  // Premium & Commission Details
  premiumCommissionDetails: {
    tpPremium: {
      type: Number
    },
    netPremium: {
      type: Number
    },
    gstAmount: {
      type: Number
    },
    totalPremium: {
      type: Number
    },
    payOut: {
      type: String,
      enum: ['Own Damage Premium', 'Net Premium', 'Separate Commission']
    },
    mainAgentCommissionPercent: {
      type: Number
    },
    mainAgentCommissionView: {
      type: Number
    },
    mainAgentTDSPercent: {
      type: Number
    },
    mainAgentTDSAmount: {
      type: Number
    },
    brokerName: {
      type: String,
      trim: true
    }
  },

  // Registration & Permit Validity
  registrationPermitValidity: {
    statePermitStartDate: {
      type: Date
    },
    statePermitEndDate: {
      type: Date
    },
    fitnessStartDate: {
      type: Date
    },
    fitnessEndDate: {
      type: Date
    },
    rcStartDate: {
      type: Date
    },
    rcEndDate: {
      type: Date
    },
    nationalPermitStartDate: {
      type: Date
    },
    nationalPermitEndDate: {
      type: Date
    },
    pucStartDate: {
      type: Date
    },
    pucEndDate: {
      type: Date
    },
    rtoTaxStartDate: {
      type: Date
    },
    rtoTaxEndDate: {
      type: Date
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

  // Upload Documents (array for multiple documents)
  uploadDocuments: [{
    documentName: {
      type: String,
      enum: ['Document', 'Aadhaar Card', 'Pancard', 'Driving License', 'Mediclaim', 'RC Book', 'Other File']
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
vehicleInsuranceSchema.index({ 'insuranceDetails.policyNumber': 1 });
vehicleInsuranceSchema.index({ 'clientDetails.customer': 1 });
vehicleInsuranceSchema.index({ 'insuranceDetails.insuranceCompany': 1 });
vehicleInsuranceSchema.index({ 'insuranceDetails.policyType': 1 });
vehicleInsuranceSchema.index({ 'insuranceDetails.registrationNumber': 1 });
vehicleInsuranceSchema.index({ isActive: 1 });
vehicleInsuranceSchema.index({ createdBy: 1 });
vehicleInsuranceSchema.index({ createdAt: -1 });

// Text index for search functionality
vehicleInsuranceSchema.index({
  'insuranceDetails.policyNumber': 'text',
  'insuranceDetails.registrationNumber': 'text',
  'insuranceDetails.make': 'text',
  'insuranceDetails.model': 'text'
}, {
  weights: {
    'insuranceDetails.policyNumber': 10,
    'insuranceDetails.registrationNumber': 8,
    'insuranceDetails.make': 5,
    'insuranceDetails.model': 5
  },
  name: 'vehicle_insurance_text_search'
});

// Static methods
vehicleInsuranceSchema.statics.getVehicleInsuranceList = function(filters = {}) {
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

vehicleInsuranceSchema.statics.getVehicleInsuranceStats = async function() {
  const [
    totalPolicies,
    newPolicies,
    renewalPolicies,
    rolloverPolicies,
    totalPremium,
    recentPolicies
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'New', isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'Renewal', isActive: true }),
    this.countDocuments({ 'insuranceDetails.policyType': 'Rollover', isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$premiumCommissionDetails.totalPremium' } } }
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
    rolloverPolicies,
    totalPremium: totalPremium[0]?.total || 0,
    recentPolicies,
    newPolicyPercentage: totalPolicies > 0 ? Math.round((newPolicies / totalPolicies) * 100) : 0,
    renewalPolicyPercentage: totalPolicies > 0 ? Math.round((renewalPolicies / totalPolicies) * 100) : 0,
    rolloverPolicyPercentage: totalPolicies > 0 ? Math.round((rolloverPolicies / totalPolicies) * 100) : 0
  };
};

// Method to toggle active status
vehicleInsuranceSchema.methods.toggleActiveStatus = function(updatedBy) {
  this.isActive = !this.isActive;
  this.lastUpdatedBy = updatedBy;
  return this.save();
};

const VehicleInsurance = mongoose.model('VehicleInsurance', vehicleInsuranceSchema);

module.exports = VehicleInsurance;
