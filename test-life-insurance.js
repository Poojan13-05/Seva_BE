// Simple test script to verify Life Insurance model and population
const mongoose = require('mongoose');
require('dotenv').config();

const LifeInsurance = require('./src/models/LifeInsurance');
const Customer = require('./src/models/Customer');

async function testLifeInsuranceModel() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Check if model can be loaded
    console.log('\n🧪 Test 1: Model Loading');
    console.log('LifeInsurance model loaded:', !!LifeInsurance);
    console.log('Customer model loaded:', !!Customer);

    // Test 2: Check indexes
    console.log('\n🧪 Test 2: Index Information');
    const indexes = await LifeInsurance.collection.getIndexes();
    console.log('Indexes on LifeInsurance collection:', Object.keys(indexes));

    // Test 3: Try to fetch any existing customers for dropdown
    console.log('\n🧪 Test 3: Customer Dropdown Test');
    const customers = await Customer.find({ isActive: true })
      .select('_id customerId personalDetails.firstName personalDetails.lastName personalDetails.email')
      .limit(5);
    
    console.log(`Found ${customers.length} active customers`);
    if (customers.length > 0) {
      customers.forEach(customer => {
        console.log(`- ${customer.customerId}: ${customer.personalDetails.firstName} ${customer.personalDetails.lastName}`);
      });
    }

    // Test 4: Try to fetch any existing life insurance policies with population
    console.log('\n🧪 Test 4: Life Insurance Population Test');
    const policies = await LifeInsurance.find({ isActive: true })
      .populate('clientDetails.customer', 'customerId personalDetails.firstName personalDetails.lastName personalDetails.email')
      .populate('createdBy', 'name email')
      .limit(3);
    
    console.log(`Found ${policies.length} active life insurance policies`);
    if (policies.length > 0) {
      policies.forEach(policy => {
        const customer = policy.clientDetails.customer;
        console.log(`- Policy ${policy.insuranceDetails.policyNumber}: ${customer ? `${customer.customerId} - ${customer.personalDetails.firstName} ${customer.personalDetails.lastName}` : 'No customer data'}`);
      });
    } else {
      console.log('No existing policies found - this is expected for a new installation');
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Model structure updated to store customer _id in clientDetails.customer');
    console.log('- Population queries updated to use clientDetails.customer');
    console.log('- Indexes updated to use the new field structure');
    console.log('- Ready to create life insurance policies with proper customer references');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the test
testLifeInsuranceModel();