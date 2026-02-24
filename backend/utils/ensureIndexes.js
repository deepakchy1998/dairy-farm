import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import FeedRecord from '../models/FeedRecord.js';
import Expense from '../models/Expense.js';
import Revenue from '../models/Revenue.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';

export async function ensureIndexes() {
  try {
    // Compound indexes for common queries
    await Cattle.collection.createIndex({ farmId: 1, status: 1, category: 1 });
    await Cattle.collection.createIndex({ farmId: 1, tagNumber: 1 });
    await MilkRecord.collection.createIndex({ farmId: 1, date: -1 });
    await HealthRecord.collection.createIndex({ farmId: 1, cattleId: 1, date: -1 });
    await BreedingRecord.collection.createIndex({ farmId: 1, status: 1, expectedDelivery: 1 });
    await Activity.collection.createIndex({ farmId: 1, timestamp: -1 });
    await Notification.collection.createIndex({ userId: 1, read: 1, createdAt: -1 });
    console.log('✅ Database indexes ensured');
  } catch (err) {
    console.error('Index creation warning:', err.message);
  }
}
