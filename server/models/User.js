
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ['citizen', 'department', 'admin'],
      default: 'citizen',
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
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

export default User;
