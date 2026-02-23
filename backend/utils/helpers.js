import Activity from '../models/Activity.js';

export const logActivity = async (farmId, type, icon, message) => {
  try {
    await Activity.create({ farmId, type, icon, message });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

export const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(500, Math.max(1, parseInt(limit)));
  return { skip: (p - 1) * l, limit: l, page: p };
};

export const dateFilter = (startDate, endDate, field = 'date') => {
  const filter = {};
  if (startDate) filter[field] = { ...filter[field], $gte: new Date(startDate) };
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter[field] = { ...filter[field], $lte: end };
  }
  return filter;
};
