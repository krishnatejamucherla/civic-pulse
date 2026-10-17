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

const Issue = mongoose.model('Issue', issueSchema);

issueSchema.virtual('priorityScore').get(function () {
  const severityScores = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4,
  };

  const severityScore = severityScores[this.severity] || 2;
  const voteScore = Math.min(this.upvotes || 0, 20) * 0.1;

  return Number((severityScore + voteScore).toFixed(1));
});

issueSchema.virtual('priority').get(function () {
  const score = this.priorityScore;

  if (score >= 4) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
});

export default Issue;