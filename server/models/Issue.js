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

    upvotes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Issue = mongoose.model('Issue', issueSchema);

export default Issue;