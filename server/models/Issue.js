import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide an issue title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Please provide a detailed description'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Please specify a category'],
      enum: ['Pothole', 'Streetlight', 'Garbage', 'Water Supply', 'Other'],
      default: 'Other'
    },
    location: {
      address: {
        type: String,
        required: [true, 'Please provide an address or landmark']
      },
      latitude: {
        type: Number
      },
      longitude: {
        type: Number
      }
    },
    status: {
      type: String,
      enum: ['Reported', 'In Progress', 'Resolved'],
      default: 'Reported'
    },
    upvotes: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const Issue = mongoose.model('Issue', issueSchema);

export default Issue;