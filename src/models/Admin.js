// src/models/Admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin'],
    required: [true, 'Role is required'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: function() {
      return this.role === 'admin'; // Only admin needs createdBy (created by super_admin)
    }
  },
  lastLogin: {
    type: Date,
    default: null
  },

  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpire: {
    type: Date,
    select: false
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ createdBy: 1 });
adminSchema.index({ passwordResetToken: 1 });


adminSchema.virtual('isSuperAdmin').get(function() {
  return this.role === 'super_admin';
});


adminSchema.virtual('roleDisplay').get(function() {
  return this.role === 'super_admin' ? 'Super Admin' : 'Admin';
});

adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

adminSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword) return false;
  
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

adminSchema.methods.updateLastLogin = async function() {
  return this.updateOne({ lastLogin: new Date() });
};

adminSchema.methods.toggleActiveStatus = function(updatedBy) {
  if (this.role === 'super_admin') {
    throw new Error('Cannot deactivate super admin');
  }
  
  if (!updatedBy || updatedBy.role !== 'super_admin') {
    throw new Error('Only super admin can change admin status');
  }
  
  this.isActive = !this.isActive;
  return this.save();
};

adminSchema.methods.generatePasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

adminSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email }).select('+password');
};

adminSchema.statics.findByResetToken = function(token) {
  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpire: { $gt: Date.now() }
  }).select('+passwordResetToken +passwordResetExpire');
};

adminSchema.statics.getAdminsList = function(requestedBy) {
  if (!requestedBy || requestedBy.role !== 'super_admin') {
    throw new Error('Only super admin can view all admins');
  }
  
  return this.find({ role: 'admin' })
    .select('-password -passwordResetToken -passwordResetExpire')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

adminSchema.statics.createAdmin = async function(adminData, createdBy) {
  if (!createdBy || createdBy.role !== 'super_admin') {
    throw new Error('Only super admin can create new admins');
  }
  
  adminData.role = 'admin'; 
  adminData.createdBy = createdBy._id;
  
  return this.create(adminData);
};

adminSchema.statics.ensureSuperAdmin = async function() {
  const superAdmin = await this.findOne({ role: 'super_admin' });
  
  if (!superAdmin) {
    const defaultSuperAdmin = await this.create({
      email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@sevaconsultancy.com',
      password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
      name: 'Super Administrator',
      role: 'super_admin',
      phone: process.env.SUPER_ADMIN_PHONE || null
    });
    
    console.log('Super Admin created:', defaultSuperAdmin.email);
    return defaultSuperAdmin;
  }
  
  return superAdmin;
};

adminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.password;
  delete admin.passwordResetToken;
  delete admin.passwordResetExpire;
  return admin;
};


adminSchema.index({ name: 1 }); // For name-based sorting and searching
adminSchema.index({ phone: 1 }); // For phone number searching
adminSchema.index({ createdAt: -1 }); // For date-based sorting (most recent first)
adminSchema.index({ updatedAt: -1 }); // For last updated sorting
adminSchema.index({ lastLogin: -1 }); // For tracking login activity

// Compound indexes for efficient filtering combinations
adminSchema.index({ role: 1, isActive: 1 }); // Filter by role and status together
adminSchema.index({ role: 1, createdAt: -1 }); // Get recent admins by role
adminSchema.index({ isActive: 1, createdAt: -1 }); // Get recent active/inactive users
adminSchema.index({ email: 1, isActive: 1 }); // Email lookup with status check

// Text index for full-text search across name, email, and phone
adminSchema.index({
  name: 'text',
  email: 'text',
  phone: 'text'
}, {
  weights: {
    name: 10,    // Name has highest weight in search
    email: 5,    // Email has medium weight
    phone: 1     // Phone has lowest weight
  },
  name: 'admin_text_search',
  default_language: 'english'
});

// Sparse indexes for optional fields
adminSchema.index({ phone: 1 }, { sparse: true }); // Only index documents that have phone
adminSchema.index({ lastLogin: -1 }, { sparse: true }); // Only index documents that have lastLogin


const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;