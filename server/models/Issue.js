import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
    },

    // Citizen who reported this issue
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    category: {
      type: String,
      required: true,
      enum: [
        'Pothole',
        'Road Damage / Potholes',
        'Streetlight',
        'Streetlight Fault',
        'Garbage',
        'Garbage Overflow',
        'Water Supply',
        'Water Supply Issue',
        'Other',
      ],
      default: 'Road Damage / Potholes',
    },

    status: {
      type: String,
      enum: ['Reported', 'In Progress', 'Resolved'],
      default: 'Reported',
    },

    severity: {
  type: String,
  enum: ['Low', 'Medium', 'High', 'Critical'],
  default: 'Medium',
},

department: {
  type: String,
  enum: [
    'Roads Department',
    'Streetlight Department',
    'Sanitation Department',
    'Water Supply Department',
    'General Department',
  ],
  default: 'General Department',
},

    location: {
      address: {
        type: String,
        required: true,
      },

      coordinates: {
        type: [Number], // [latitude, longitude]
        default: [17.3850, 78.4867],
      },
    },

    imageUrl: {
      type: String,
      default: '',
    },

    // Photo uploaded by the department after completing repairs
repairImageUrl: {
  type: String,
  default: '',
},

// Final resolution summary
resolutionNote: {
  type: String,
  trim: true,
  default: '',
},

// When the complaint was resolved
resolvedAt: {
  type: Date,
  default: null,
},

// Department staff member who resolved the complaint
resolvedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null,
},

imageVerificationStatus: {
  type: String,
  enum: [
    'Not Checked',
    'Pending Verification',
    'Likely Relevant',
    'Needs Review',
    'Mismatch',
  ],
  default: 'Not Checked',
},

imageVerificationReason: {
  type: String,
  default: '',
},


    upvotes: {
  type: Number,
  default: 0,
},

    upvotedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  // ADD statusHistory HERE
  statusHistory: [
    {
      status: {
        type: String,
        enum: ['Reported', 'In Progress', 'Resolved'],
        required: true,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      note: {
        type: String,
        trim: true,
        default: '',
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  },
  {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
}
);

issueSchema.virtual('priorityScore').get(function () {
  const severityScores = {
    Low: 25,
    Medium: 50,
    High: 75,
    Critical: 100,
  };

  const severityScore = severityScores[this.severity] || 50;
  const voteScore = Math.min(Math.max(Number(this.upvotes) || 0, 0), 20) * 0.25;

  const ageDays = this.createdAt
    ? Math.max(0, (Date.now() - new Date(this.createdAt).getTime()) / 86400000)
    : 0;
  const waitingScore = Math.min(ageDays, 30) * 0.25;

  return Number((severityScore + voteScore + waitingScore).toFixed(1));
});

issueSchema.virtual('priority').get(function () {
  const priorities = ['Low', 'Medium', 'High', 'Critical'];
  return priorities.includes(this.severity) ? this.severity : 'Medium';
});

const Issue = mongoose.model('Issue', issueSchema);

export default Issue;