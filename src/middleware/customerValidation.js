// src/middleware/customerValidation.js - FIXED VERSION
const { errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

// Validate customer creation data
const validateCustomerCreation = (req, res, next) => {
  try {
    // ✅ PARSE JSON STRINGS FIRST - This is the key fix!
    if (typeof req.body.personalDetails === 'string') {
      try {
        req.body.personalDetails = JSON.parse(req.body.personalDetails);
      } catch (e) {
        return errorResponse(res, 'Invalid personal details format', 400, ['Personal details must be valid JSON']);
      }
    }

    if (typeof req.body.corporateDetails === 'string') {
      try {
        req.body.corporateDetails = JSON.parse(req.body.corporateDetails);
      } catch (e) {
        return errorResponse(res, 'Invalid corporate details format', 400, ['Corporate details must be valid JSON']);
      }
    }

    if (typeof req.body.familyDetails === 'string') {
      try {
        req.body.familyDetails = JSON.parse(req.body.familyDetails);
      } catch (e) {
        return errorResponse(res, 'Invalid family details format', 400, ['Family details must be valid JSON']);
      }
    }

    const { customerType, personalDetails, corporateDetails, familyDetails } = req.body;
    const errors = [];

    // Customer type validation
    if (!customerType || !['individual', 'corporate'].includes(customerType)) {
      errors.push('Customer type must be either "individual" or "corporate"');
    }

    // Individual customer validations
    if (customerType === 'individual') {
      if (!personalDetails) {
        errors.push('Personal details are required for individual customers');
      } else {
        // Required fields for individual customers
        if (!personalDetails.firstName || personalDetails.firstName.trim().length === 0) {
          errors.push('First name is required');
        }
        if (!personalDetails.lastName || personalDetails.lastName.trim().length === 0) {
          errors.push('Last name is required');
        }
        if (!personalDetails.mobileNumber) {
          errors.push('Mobile number is required');
        } else if (!/^[6-9]\d{9}$/.test(personalDetails.mobileNumber)) {
          errors.push('Please enter a valid Indian mobile number');
        }
        if (!personalDetails.email) {
          errors.push('Email is required');
        } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(personalDetails.email)) {
          errors.push('Please enter a valid email address');
        }
        if (!personalDetails.state || personalDetails.state.trim().length === 0) {
          errors.push('State is required');
        }
        if (!personalDetails.city || personalDetails.city.trim().length === 0) {
          errors.push('City is required');
        }
        if (!personalDetails.address || personalDetails.address.trim().length === 0) {
          errors.push('Address is required');
        }
        if (!personalDetails.birthDate) {
          errors.push('Birth date is required');
        }
        if (!personalDetails.gender || !['male', 'female', 'other'].includes(personalDetails.gender)) {
          errors.push('Gender must be male, female, or other');
        }
        if (!personalDetails.maritalStatus || !['married', 'unmarried'].includes(personalDetails.maritalStatus)) {
          errors.push('Marital status must be married or unmarried');
        }

        // Optional field validations
        if (personalDetails.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(personalDetails.panNumber)) {
          errors.push('Please enter a valid PAN number');
        }
        if (personalDetails.gstNumber && personalDetails.gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(personalDetails.gstNumber)) {
          errors.push('Please enter a valid GST number');
        }
        if (personalDetails.age && (personalDetails.age < 0 || personalDetails.age > 150)) {
          errors.push('Age must be between 0 and 150');
        }
        if (personalDetails.height && (personalDetails.height < 0 || personalDetails.height > 10)) {
          errors.push('Height must be between 0 and 10 feet');
        }
        if (personalDetails.weight && (personalDetails.weight < 0 || personalDetails.weight > 500)) {
          errors.push('Weight must be between 0 and 500 kg');
        }
        if (personalDetails.annualIncome && personalDetails.annualIncome < 0) {
          errors.push('Annual income cannot be negative');
        }
        if (personalDetails.businessOrJob && !['business', 'job'].includes(personalDetails.businessOrJob)) {
          errors.push('Business/Job type must be either "business" or "job"');
        }
      }
    }

    // Corporate details validation (if provided)
    if (corporateDetails && Array.isArray(corporateDetails)) {
      corporateDetails.forEach((corp, index) => {
        // Skip validation for empty corporate details (when user adds but doesn't fill)
        const hasAnyData = Object.values(corp).some(value => value && value.trim && value.trim().length > 0);
        
        if (hasAnyData) {
          if (!corp.companyName || corp.companyName.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: Company name is required`);
          }
          if (!corp.mobileNumber || !/^[6-9]\d{9}$/.test(corp.mobileNumber)) {
            errors.push(`Corporate detail ${index + 1}: Valid mobile number is required`);
          }
          if (!corp.email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(corp.email)) {
            errors.push(`Corporate detail ${index + 1}: Valid email is required`);
          }
          if (!corp.state || corp.state.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: State is required`);
          }
          if (!corp.city || corp.city.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: City is required`);
          }
          if (!corp.address || corp.address.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: Address is required`);
          }
          if (!corp.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(corp.panNumber)) {
            errors.push(`Corporate detail ${index + 1}: Valid PAN number is required`);
          }
          if (corp.annualIncome && corp.annualIncome < 0) {
            errors.push(`Corporate detail ${index + 1}: Annual income cannot be negative`);
          }
        }
      });
    }

    // Family details validation (if provided)
    if (familyDetails && Array.isArray(familyDetails)) {
      familyDetails.forEach((family, index) => {
        // Skip validation for empty family details
        const hasAnyData = Object.values(family).some(value => value && value.toString().trim().length > 0);
        
        if (hasAnyData) {
          if (!family.firstName || family.firstName.trim().length === 0) {
            errors.push(`Family member ${index + 1}: First name is required`);
          }
          if (!family.lastName || family.lastName.trim().length === 0) {
            errors.push(`Family member ${index + 1}: Last name is required`);
          }
          if (!family.birthDate) {
            errors.push(`Family member ${index + 1}: Birth date is required`);
          }
          if (!family.age || family.age < 0 || family.age > 150) {
            errors.push(`Family member ${index + 1}: Age must be between 0 and 150`);
          }
          if (!family.gender || !['male', 'female', 'other'].includes(family.gender)) {
            errors.push(`Family member ${index + 1}: Gender must be male, female, or other`);
          }
          if (!family.relationship || !['husband', 'wife', 'daughter', 'brother', 'sister', 'son', 'mother', 'father', 'mother_in_law', 'father_in_law', 'daughter_in_law', 'nephew', 'other'].includes(family.relationship)) {
            errors.push(`Family member ${index + 1}: Valid relationship is required`);
          }
          if (family.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(family.panNumber)) {
            errors.push(`Family member ${index + 1}: Please enter a valid PAN number`);
          }
          if (family.mobileNumber && !/^[6-9]\d{9}$/.test(family.mobileNumber)) {
            errors.push(`Family member ${index + 1}: Please enter a valid mobile number`);
          }
          if (family.height && (family.height < 0 || family.height > 10)) {
            errors.push(`Family member ${index + 1}: Height must be between 0 and 10 feet`);
          }
          if (family.weight && (family.weight < 0 || family.weight > 500)) {
            errors.push(`Family member ${index + 1}: Weight must be between 0 and 500 kg`);
          }
        }
      });
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      logger.warn('Customer creation validation failed:', {
        errors,
        customerType,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    // Sanitize and clean up data
    if (req.body.personalDetails) {
      const personalDetails = req.body.personalDetails;
      if (personalDetails.firstName) personalDetails.firstName = personalDetails.firstName.trim();
      if (personalDetails.middleName) personalDetails.middleName = personalDetails.middleName.trim();
      if (personalDetails.lastName) personalDetails.lastName = personalDetails.lastName.trim();
      if (personalDetails.email) personalDetails.email = personalDetails.email.trim().toLowerCase();
      if (personalDetails.panNumber) personalDetails.panNumber = personalDetails.panNumber.trim().toUpperCase();
      if (personalDetails.gstNumber) personalDetails.gstNumber = personalDetails.gstNumber.trim().toUpperCase();
      if (personalDetails.state) personalDetails.state = personalDetails.state.trim();
      if (personalDetails.city) personalDetails.city = personalDetails.city.trim();
      if (personalDetails.address) personalDetails.address = personalDetails.address.trim();
      if (personalDetails.birthPlace) personalDetails.birthPlace = personalDetails.birthPlace.trim();
      if (personalDetails.education) personalDetails.education = personalDetails.education.trim();
      if (personalDetails.nameOfBusinessJob) personalDetails.nameOfBusinessJob = personalDetails.nameOfBusinessJob.trim();
      if (personalDetails.typeOfDuty) personalDetails.typeOfDuty = personalDetails.typeOfDuty.trim();
    }

    // Clean up empty corporate details
    if (req.body.corporateDetails && Array.isArray(req.body.corporateDetails)) {
      req.body.corporateDetails = req.body.corporateDetails.filter(corp => {
        // Keep only corporate details that have at least some data
        return Object.values(corp).some(value => value && value.trim && value.trim().length > 0);
      });

      // Sanitize remaining corporate details
      req.body.corporateDetails.forEach(corp => {
        if (corp.companyName) corp.companyName = corp.companyName.trim();
        if (corp.email) corp.email = corp.email.trim().toLowerCase();
        if (corp.panNumber) corp.panNumber = corp.panNumber.trim().toUpperCase();
        if (corp.state) corp.state = corp.state.trim();
        if (corp.city) corp.city = corp.city.trim();
        if (corp.address) corp.address = corp.address.trim();
      });
    }

    // Clean up empty family details
    if (req.body.familyDetails && Array.isArray(req.body.familyDetails)) {
      req.body.familyDetails = req.body.familyDetails.filter(family => {
        // Keep only family details that have at least some data
        return Object.values(family).some(value => value && value.toString().trim().length > 0);
      });

      // Sanitize remaining family details
      req.body.familyDetails.forEach(family => {
        if (family.firstName) family.firstName = family.firstName.trim();
        if (family.middleName) family.middleName = family.middleName.trim();
        if (family.lastName) family.lastName = family.lastName.trim();
        if (family.panNumber) family.panNumber = family.panNumber.trim().toUpperCase();
      });
    }

    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    return errorResponse(res, 'Validation error occurred', 500);
  }
};

// Validate customer update data
const validateCustomerUpdate = (req, res, next) => {
  try {
    // ✅ PARSE JSON STRINGS FIRST for updates too
    if (typeof req.body.personalDetails === 'string') {
      try {
        req.body.personalDetails = JSON.parse(req.body.personalDetails);
      } catch (e) {
        return errorResponse(res, 'Invalid personal details format', 400, ['Personal details must be valid JSON']);
      }
    }

    if (typeof req.body.corporateDetails === 'string') {
      try {
        req.body.corporateDetails = JSON.parse(req.body.corporateDetails);
      } catch (e) {
        return errorResponse(res, 'Invalid corporate details format', 400, ['Corporate details must be valid JSON']);
      }
    }

    if (typeof req.body.familyDetails === 'string') {
      try {
        req.body.familyDetails = JSON.parse(req.body.familyDetails);
      } catch (e) {
        return errorResponse(res, 'Invalid family details format', 400, ['Family details must be valid JSON']);
      }
    }

    const { personalDetails, corporateDetails, familyDetails } = req.body;
    const errors = [];

    // Personal details validation (if provided)
    if (personalDetails) {
      if (personalDetails.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(personalDetails.email)) {
        errors.push('Please enter a valid email address');
      }
      if (personalDetails.mobileNumber && !/^[6-9]\d{9}$/.test(personalDetails.mobileNumber)) {
        errors.push('Please enter a valid Indian mobile number');
      }
      if (personalDetails.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(personalDetails.panNumber)) {
        errors.push('Please enter a valid PAN number');
      }
      if (personalDetails.gstNumber && personalDetails.gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(personalDetails.gstNumber)) {
        errors.push('Please enter a valid GST number');
      }
      if (personalDetails.age && (personalDetails.age < 0 || personalDetails.age > 150)) {
        errors.push('Age must be between 0 and 150');
      }
      if (personalDetails.height && (personalDetails.height < 0 || personalDetails.height > 10)) {
        errors.push('Height must be between 0 and 10 feet');
      }
      if (personalDetails.weight && (personalDetails.weight < 0 || personalDetails.weight > 500)) {
        errors.push('Weight must be between 0 and 500 kg');
      }
      if (personalDetails.annualIncome && personalDetails.annualIncome < 0) {
        errors.push('Annual income cannot be negative');
      }
      if (personalDetails.gender && !['male', 'female', 'other'].includes(personalDetails.gender)) {
        errors.push('Gender must be male, female, or other');
      }
      if (personalDetails.maritalStatus && !['married', 'unmarried'].includes(personalDetails.maritalStatus)) {
        errors.push('Marital status must be married or unmarried');
      }
      if (personalDetails.businessOrJob && !['business', 'job'].includes(personalDetails.businessOrJob)) {
        errors.push('Business/Job type must be either "business" or "job"');
      }
      if (personalDetails.firstName && personalDetails.firstName.trim().length === 0) {
        errors.push('First name cannot be empty');
      }
      if (personalDetails.lastName && personalDetails.lastName.trim().length === 0) {
        errors.push('Last name cannot be empty');
      }
      if (personalDetails.state && personalDetails.state.trim().length === 0) {
        errors.push('State cannot be empty');
      }
      if (personalDetails.city && personalDetails.city.trim().length === 0) {
        errors.push('City cannot be empty');
      }
      if (personalDetails.address && personalDetails.address.trim().length === 0) {
        errors.push('Address cannot be empty');
      }
    }

    // Corporate details validation (if provided)
    if (corporateDetails && Array.isArray(corporateDetails)) {
      corporateDetails.forEach((corp, index) => {
        const hasAnyData = Object.values(corp).some(value => value && value.trim && value.trim().length > 0);
        
        if (hasAnyData) {
          if (corp.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(corp.email)) {
            errors.push(`Corporate detail ${index + 1}: Please enter a valid email address`);
          }
          if (corp.mobileNumber && !/^[6-9]\d{9}$/.test(corp.mobileNumber)) {
            errors.push(`Corporate detail ${index + 1}: Please enter a valid mobile number`);
          }
          if (corp.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(corp.panNumber)) {
            errors.push(`Corporate detail ${index + 1}: Please enter a valid PAN number`);
          }
          if (corp.annualIncome && corp.annualIncome < 0) {
            errors.push(`Corporate detail ${index + 1}: Annual income cannot be negative`);
          }
          if (corp.companyName && corp.companyName.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: Company name cannot be empty`);
          }
          if (corp.state && corp.state.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: State cannot be empty`);
          }
          if (corp.city && corp.city.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: City cannot be empty`);
          }
          if (corp.address && corp.address.trim().length === 0) {
            errors.push(`Corporate detail ${index + 1}: Address cannot be empty`);
          }
        }
      });
    }

    // Family details validation (if provided)
    if (familyDetails && Array.isArray(familyDetails)) {
      familyDetails.forEach((family, index) => {
        const hasAnyData = Object.values(family).some(value => value && value.toString().trim().length > 0);
        
        if (hasAnyData) {
          if (family.age && (family.age < 0 || family.age > 150)) {
            errors.push(`Family member ${index + 1}: Age must be between 0 and 150`);
          }
          if (family.gender && !['male', 'female', 'other'].includes(family.gender)) {
            errors.push(`Family member ${index + 1}: Gender must be male, female, or other`);
          }
          if (family.relationship && !['husband', 'wife', 'daughter', 'brother', 'sister', 'son', 'mother', 'father', 'mother_in_law', 'father_in_law', 'daughter_in_law', 'nephew', 'other'].includes(family.relationship)) {
            errors.push(`Family member ${index + 1}: Valid relationship is required`);
          }
          if (family.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(family.panNumber)) {
            errors.push(`Family member ${index + 1}: Please enter a valid PAN number`);
          }
          if (family.mobileNumber && !/^[6-9]\d{9}$/.test(family.mobileNumber)) {
            errors.push(`Family member ${index + 1}: Please enter a valid mobile number`);
          }
          if (family.height && (family.height < 0 || family.height > 10)) {
            errors.push(`Family member ${index + 1}: Height must be between 0 and 10 feet`);
          }
          if (family.weight && (family.weight < 0 || family.weight > 500)) {
            errors.push(`Family member ${index + 1}: Weight must be between 0 and 500 kg`);
          }
          if (family.firstName && family.firstName.trim().length === 0) {
            errors.push(`Family member ${index + 1}: First name cannot be empty`);
          }
          if (family.lastName && family.lastName.trim().length === 0) {
            errors.push(`Family member ${index + 1}: Last name cannot be empty`);
          }
        }
      });
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      logger.warn('Customer update validation failed:', {
        errors,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    // Sanitize data (same as in creation)
    if (req.body.personalDetails) {
      const personalDetails = req.body.personalDetails;
      if (personalDetails.firstName) personalDetails.firstName = personalDetails.firstName.trim();
      if (personalDetails.middleName) personalDetails.middleName = personalDetails.middleName.trim();
      if (personalDetails.lastName) personalDetails.lastName = personalDetails.lastName.trim();
      if (personalDetails.email) personalDetails.email = personalDetails.email.trim().toLowerCase();
      if (personalDetails.panNumber) personalDetails.panNumber = personalDetails.panNumber.trim().toUpperCase();
      if (personalDetails.gstNumber) personalDetails.gstNumber = personalDetails.gstNumber.trim().toUpperCase();
      if (personalDetails.state) personalDetails.state = personalDetails.state.trim();
      if (personalDetails.city) personalDetails.city = personalDetails.city.trim();
      if (personalDetails.address) personalDetails.address = personalDetails.address.trim();
      if (personalDetails.birthPlace) personalDetails.birthPlace = personalDetails.birthPlace.trim();
      if (personalDetails.education) personalDetails.education = personalDetails.education.trim();
      if (personalDetails.nameOfBusinessJob) personalDetails.nameOfBusinessJob = personalDetails.nameOfBusinessJob.trim();
      if (personalDetails.typeOfDuty) personalDetails.typeOfDuty = personalDetails.typeOfDuty.trim();
    }

    // Clean up and sanitize other details
    if (req.body.corporateDetails && Array.isArray(req.body.corporateDetails)) {
      req.body.corporateDetails = req.body.corporateDetails.filter(corp => {
        return Object.values(corp).some(value => value && value.trim && value.trim().length > 0);
      });

      req.body.corporateDetails.forEach(corp => {
        if (corp.companyName) corp.companyName = corp.companyName.trim();
        if (corp.email) corp.email = corp.email.trim().toLowerCase();
        if (corp.panNumber) corp.panNumber = corp.panNumber.trim().toUpperCase();
        if (corp.state) corp.state = corp.state.trim();
        if (corp.city) corp.city = corp.city.trim();
        if (corp.address) corp.address = corp.address.trim();
      });
    }

    if (req.body.familyDetails && Array.isArray(req.body.familyDetails)) {
      req.body.familyDetails = req.body.familyDetails.filter(family => {
        return Object.values(family).some(value => value && value.toString().trim().length > 0);
      });

      req.body.familyDetails.forEach(family => {
        if (family.firstName) family.firstName = family.firstName.trim();
        if (family.middleName) family.middleName = family.middleName.trim();
        if (family.lastName) family.lastName = family.lastName.trim();
        if (family.panNumber) family.panNumber = family.panNumber.trim().toUpperCase();
      });
    }

    next();
  } catch (error) {
    logger.error('Update validation middleware error:', error);
    return errorResponse(res, 'Validation error occurred', 500);
  }
};

module.exports = {
  validateCustomerCreation,
  validateCustomerUpdate
};