import 'dotenv/config';
import mongoose from 'mongoose';
import Cattle from './models/Cattle.js';
import MilkRecord from './models/MilkRecord.js';
import HealthRecord from './models/HealthRecord.js';
import BreedingRecord from './models/BreedingRecord.js';
import FeedRecord from './models/FeedRecord.js';
import Expense from './models/Expense.js';
import Revenue from './models/Revenue.js';
import Employee from './models/Employee.js';
import Customer from './models/Customer.js';
import MilkDelivery from './models/MilkDelivery.js';
import Insurance from './models/Insurance.js';
import Farm from './models/Farm.js';

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

await mongoose.connect(MONGO_URI);
console.log('Connected to MongoDB');

// Find the first farm
const farm = await Farm.findOne();
if (!farm) { console.error('No farm found. Create a user/farm first.'); process.exit(1); }
const farmId = farm._id;
console.log(`Seeding data for farm: ${farm.name} (${farmId})`);

// Helper
const d = (daysAgo) => { const dt = new Date(); dt.setDate(dt.getDate() - daysAgo); return dt; };
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ═══════════════════════════════════════
// 1. CATTLE (10)
// ═══════════════════════════════════════
const cattleData = [
  { tagNumber: 'GIR-001', breed: 'Gir', gender: 'female', category: 'milking', dateOfBirth: d(1200), weight: 420, color: 'Red & White', lactationNumber: 3, lastCalvingDate: d(60) },
  { tagNumber: 'HF-002', breed: 'Holstein Friesian', gender: 'female', category: 'milking', dateOfBirth: d(1500), weight: 550, color: 'Black & White', lactationNumber: 4, lastCalvingDate: d(90) },
  { tagNumber: 'SAH-003', breed: 'Sahiwal', gender: 'female', category: 'milking', dateOfBirth: d(1100), weight: 380, color: 'Reddish Brown', lactationNumber: 2, lastCalvingDate: d(45) },
  { tagNumber: 'JER-004', breed: 'Jersey', gender: 'female', category: 'milking', dateOfBirth: d(1300), weight: 400, color: 'Brown', lactationNumber: 3, lastCalvingDate: d(120) },
  { tagNumber: 'MUR-005', breed: 'Murrah', gender: 'female', category: 'milking', dateOfBirth: d(1000), weight: 500, color: 'Black', lactationNumber: 2, lastCalvingDate: d(30) },
  { tagNumber: 'CB-006', breed: 'Crossbred', gender: 'female', category: 'pregnant', dateOfBirth: d(900), weight: 440, color: 'Brown & White' },
  { tagNumber: 'GIR-007', breed: 'Gir', gender: 'female', category: 'dry', dateOfBirth: d(1600), weight: 390, color: 'Red', lactationNumber: 5 },
  { tagNumber: 'HF-008', breed: 'Holstein Friesian', gender: 'female', category: 'heifer', dateOfBirth: d(500), weight: 280, color: 'Black & White' },
  { tagNumber: 'SAH-009', breed: 'Sahiwal', gender: 'male', category: 'bull', dateOfBirth: d(800), weight: 620, color: 'Brown' },
  { tagNumber: 'JER-010', breed: 'Jersey', gender: 'female', category: 'calf', dateOfBirth: d(90), weight: 65, color: 'Light Brown' },
];

const cattleIds = [];
for (const c of cattleData) {
  const existing = await Cattle.findOne({ farmId, tagNumber: c.tagNumber });
  if (existing) { cattleIds.push(existing._id); console.log(`  Cattle ${c.tagNumber} already exists, skipping`); continue; }
  const doc = await Cattle.create({ farmId, ...c });
  cattleIds.push(doc._id);
}
console.log(`✅ Cattle: ${cattleIds.length} records`);

// Get milking cattle IDs (first 5)
const milkingCattleIds = cattleIds.slice(0, 5);

// ═══════════════════════════════════════
// 2. MILK RECORDS (8 days × 5 cattle = 40 records)
// ═══════════════════════════════════════
let milkCount = 0;
for (let day = 0; day < 8; day++) {
  const date = d(day);
  for (const cId of milkingCattleIds) {
    const existing = await MilkRecord.findOne({ farmId, cattleId: cId, date: { $gte: new Date(date.toDateString()), $lt: new Date(new Date(date.toDateString()).getTime() + 86400000) } });
    if (existing) continue;
    const morn = +(rand(3, 8) + Math.random()).toFixed(1);
    const eve = +(rand(2, 6) + Math.random()).toFixed(1);
    await MilkRecord.create({
      farmId, cattleId: cId, date,
      morningYield: morn, morningFat: +(rand(35, 50) / 10).toFixed(1), morningSNF: +(rand(80, 90) / 10).toFixed(1),
      eveningYield: eve, eveningFat: +(rand(35, 48) / 10).toFixed(1), eveningSNF: +(rand(80, 88) / 10).toFixed(1),
    });
    milkCount++;
  }
}
console.log(`✅ Milk Records: ${milkCount} records`);

// ═══════════════════════════════════════
// 3. HEALTH RECORDS (10)
// ═══════════════════════════════════════
const healthData = [
  { cattleId: cattleIds[0], date: d(5), type: 'vaccination', description: 'FMD Vaccination', medicine: 'Raksha FMD', cost: 150, nextDueDate: d(-180), vetName: 'Dr. Sharma' },
  { cattleId: cattleIds[1], date: d(10), type: 'vaccination', description: 'HS Vaccination', medicine: 'Alum HS Vaccine', cost: 120, nextDueDate: d(-175), vetName: 'Dr. Sharma' },
  { cattleId: cattleIds[2], date: d(3), type: 'treatment', description: 'Mastitis treatment - right front quarter', medicine: 'Ceftriaxone + Meloxicam', cost: 800, vetName: 'Dr. Patel' },
  { cattleId: cattleIds[3], date: d(15), type: 'deworming', description: 'Routine deworming', medicine: 'Albendazole 10ml', cost: 80, nextDueDate: d(-75), vetName: 'Dr. Sharma' },
  { cattleId: cattleIds[4], date: d(7), type: 'checkup', description: 'Pregnancy confirmation checkup', cost: 300, vetName: 'Dr. Patel' },
  { cattleId: cattleIds[5], date: d(20), type: 'vaccination', description: 'Brucellosis Vaccination', medicine: 'S19 Vaccine', cost: 200, nextDueDate: d(-150), vetName: 'Dr. Kumar' },
  { cattleId: cattleIds[6], date: d(2), type: 'treatment', description: 'Hoof trimming and treatment', medicine: 'Topical spray', cost: 250, vetName: 'Dr. Patel' },
  { cattleId: cattleIds[7], date: d(12), type: 'vaccination', description: 'BQ (Black Quarter) Vaccination', medicine: 'BQ Vaccine', cost: 100, nextDueDate: d(-5), vetName: 'Dr. Sharma' },
  { cattleId: cattleIds[8], date: d(8), type: 'checkup', description: 'General health checkup - all okay', cost: 200, vetName: 'Dr. Kumar' },
  { cattleId: cattleIds[9], date: d(1), type: 'deworming', description: 'Calf deworming', medicine: 'Fenbendazole 5ml', cost: 50, nextDueDate: d(-85), vetName: 'Dr. Sharma' },
];
for (const h of healthData) { await HealthRecord.create({ farmId, ...h }); }
console.log(`✅ Health Records: ${healthData.length} records`);

// ═══════════════════════════════════════
// 4. BREEDING RECORDS (8)
// ═══════════════════════════════════════
const breedingData = [
  { cattleId: cattleIds[0], breedingDate: d(60), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'HF Bull #CB-421', status: 'confirmed', expectedDelivery: d(-222) },
  { cattleId: cattleIds[1], breedingDate: d(90), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'Jersey Bull #J-115', status: 'confirmed', expectedDelivery: d(-192) },
  { cattleId: cattleIds[2], breedingDate: d(45), method: 'natural', bullInfo: 'Sahiwal Bull SAH-009', status: 'bred', expectedDelivery: d(-237) },
  { cattleId: cattleIds[3], breedingDate: d(120), method: 'artificial', inseminatorName: 'Suresh Singh', bullInfo: 'Gir Bull #G-88', status: 'confirmed', expectedDelivery: d(-162) },
  { cattleId: cattleIds[4], breedingDate: d(30), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'Murrah Bull #M-55', status: 'bred', expectedDelivery: d(-252) },
  { cattleId: cattleIds[5], breedingDate: d(200), method: 'artificial', inseminatorName: 'Suresh Singh', bullInfo: 'HF Bull #CB-421', status: 'confirmed', expectedDelivery: d(-82) },
  { cattleId: cattleIds[6], breedingDate: d(300), method: 'natural', bullInfo: 'Gir Bull #G-88', status: 'delivered', actualDelivery: d(20), offspring: 'Female calf', expectedDelivery: d(18) },
  { cattleId: cattleIds[7], breedingDate: d(150), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'Jersey Bull #J-115', status: 'failed', notes: 'Repeat breeding required' },
];
for (const b of breedingData) { await BreedingRecord.create({ farmId, ...b }); }
console.log(`✅ Breeding Records: ${breedingData.length} records`);

// ═══════════════════════════════════════
// 5. FEED RECORDS (10)
// ═══════════════════════════════════════
const feedData = [
  { date: d(1), feedType: 'Green Fodder', quantity: 200, unit: 'kg', cost: 1200, notes: 'Napier grass from own field' },
  { date: d(1), feedType: 'Dry Hay', quantity: 80, unit: 'kg', cost: 800, notes: 'Wheat straw' },
  { date: d(2), feedType: 'Concentrate', quantity: 50, unit: 'kg', cost: 1500, notes: 'Amul Dan 20% protein' },
  { date: d(3), feedType: 'Cotton Seed', quantity: 30, unit: 'kg', cost: 900 },
  { date: d(3), feedType: 'Mineral Mix', quantity: 5, unit: 'kg', cost: 350, notes: 'Agrimin Forte' },
  { date: d(5), feedType: 'Silage', quantity: 100, unit: 'kg', cost: 600, notes: 'Maize silage' },
  { date: d(5), feedType: 'Mustard Cake', quantity: 25, unit: 'kg', cost: 750 },
  { date: d(7), feedType: 'Green Fodder', quantity: 180, unit: 'kg', cost: 1080 },
  { date: d(7), feedType: 'Wheat Bran', quantity: 40, unit: 'kg', cost: 600 },
  { date: d(10), feedType: 'Rice Bran', quantity: 30, unit: 'kg', cost: 420 },
];
for (const f of feedData) { await FeedRecord.create({ farmId, ...f }); }
console.log(`✅ Feed Records: ${feedData.length} records`);

// ═══════════════════════════════════════
// 6. EXPENSES (10)
// ═══════════════════════════════════════
const expenseData = [
  { date: d(1), category: 'feed', description: 'Monthly cattle feed supply', amount: 15000 },
  { date: d(3), category: 'medicine', description: 'FMD and HS vaccines batch', amount: 2500 },
  { date: d(5), category: 'equipment', description: 'Milking machine servicing', amount: 3500 },
  { date: d(7), category: 'salary', description: 'Employee salary advance - Raju', amount: 5000 },
  { date: d(8), category: 'transport', description: 'Milk tanker transportation', amount: 2000 },
  { date: d(10), category: 'maintenance', description: 'Cattle shed roof repair', amount: 8000 },
  { date: d(12), category: 'feed', description: 'Mineral mix and concentrate', amount: 4500 },
  { date: d(15), category: 'medicine', description: 'Mastitis treatment medicines', amount: 1200 },
  { date: d(18), category: 'equipment', description: 'New water trough installation', amount: 6000 },
  { date: d(20), category: 'other', description: 'Electricity bill - farm', amount: 3200 },
];
for (const e of expenseData) { await Expense.create({ farmId, ...e }); }
console.log(`✅ Expenses: ${expenseData.length} records`);

// ═══════════════════════════════════════
// 7. REVENUE (10)
// ═══════════════════════════════════════
const revenueData = [
  { date: d(1), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 4500, milkSaleType: 'retail', milkQuantity: 75, milkRate: 60 },
  { date: d(2), category: 'milk_sale', description: 'Dairy cooperative collection', amount: 8400, milkSaleType: 'dairy', milkQuantity: 120, milkRate: 70 },
  { date: d(3), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 4200, milkSaleType: 'retail', milkQuantity: 70, milkRate: 60 },
  { date: d(5), category: 'milk_sale', description: 'Dairy cooperative collection', amount: 8750, milkSaleType: 'dairy', milkQuantity: 125, milkRate: 70 },
  { date: d(7), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 4800, milkSaleType: 'retail', milkQuantity: 80, milkRate: 60 },
  { date: d(8), category: 'manure_sale', description: 'Cow dung manure - sold to farmer', amount: 3000 },
  { date: d(10), category: 'milk_sale', description: 'Dairy cooperative collection', amount: 9100, milkSaleType: 'dairy', milkQuantity: 130, milkRate: 70 },
  { date: d(12), category: 'other', description: 'Government subsidy received', amount: 15000 },
  { date: d(15), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 5100, milkSaleType: 'retail', milkQuantity: 85, milkRate: 60 },
  { date: d(20), category: 'manure_sale', description: 'Vermicompost sale', amount: 5000 },
];
for (const r of revenueData) { await Revenue.create({ farmId, ...r }); }
console.log(`✅ Revenue: ${revenueData.length} records`);

// ═══════════════════════════════════════
// 8. EMPLOYEES (8)
// ═══════════════════════════════════════
const employeeData = [
  { name: 'Raju Yadav', phone: '+91 9876543210', village: 'Mandvi', role: 'Milker', monthlySalary: 12000, joinDate: d(365), aadhar: '4567 8901 2345' },
  { name: 'Sita Devi', phone: '+91 9876543211', village: 'Mandvi', role: 'Milker', monthlySalary: 11000, joinDate: d(300) },
  { name: 'Mohan Lal', phone: '+91 9876543212', village: 'Bharuch', role: 'Feeder', monthlySalary: 10000, joinDate: d(500) },
  { name: 'Bhim Singh', phone: '+91 9876543213', village: 'Anand', role: 'Cleaner', monthlySalary: 9000, joinDate: d(200) },
  { name: 'Lakshmi Bai', phone: '+91 9876543214', village: 'Mandvi', role: 'Helper', monthlySalary: 8500, joinDate: d(150) },
  { name: 'Arjun Patel', phone: '+91 9876543215', village: 'Vadodara', role: 'Manager', monthlySalary: 18000, joinDate: d(730), bankAccount: '12345678901234', ifsc: 'SBIN0001234' },
  { name: 'Kiran Solanki', phone: '+91 9876543216', village: 'Anand', role: 'Driver', monthlySalary: 11000, joinDate: d(180) },
  { name: 'Gopal Das', phone: '+91 9876543217', village: 'Bharuch', role: 'Veterinary', monthlySalary: 20000, joinDate: d(400), notes: 'Part-time vet, visits 3 times/week' },
];
for (const e of employeeData) {
  const existing = await Employee.findOne({ farmId, name: e.name });
  if (existing) { console.log(`  Employee ${e.name} already exists, skipping`); continue; }
  await Employee.create({ farmId, ...e });
}
console.log(`✅ Employees: ${employeeData.length} records`);

// ═══════════════════════════════════════
// 9. CUSTOMERS - Dudh Khata (8)
// ═══════════════════════════════════════
const customerData = [
  { name: 'Ramesh Sharma', phone: '+91 9988776601', village: 'Mandvi', dailyQuantity: 2, ratePerLiter: 60, deliveryTime: 'morning' },
  { name: 'Sunita Patel', phone: '+91 9988776602', village: 'Bharuch', dailyQuantity: 3, ratePerLiter: 58, deliveryTime: 'morning' },
  { name: 'Vijay Kumar', phone: '+91 9988776603', village: 'Anand', dailyQuantity: 5, ratePerLiter: 55, deliveryTime: 'both', notes: 'Runs a sweet shop' },
  { name: 'Meena Devi', phone: '+91 9988776604', village: 'Mandvi', dailyQuantity: 1.5, ratePerLiter: 60, deliveryTime: 'morning' },
  { name: 'Prakash Joshi', phone: '+91 9988776605', village: 'Vadodara', dailyQuantity: 4, ratePerLiter: 55, deliveryTime: 'evening' },
  { name: 'Anita Singh', phone: '+91 9988776606', village: 'Anand', dailyQuantity: 2, ratePerLiter: 60, deliveryTime: 'morning' },
  { name: 'Govind Rao', phone: '+91 9988776607', village: 'Bharuch', dailyQuantity: 10, ratePerLiter: 50, deliveryTime: 'both', notes: 'Tea stall owner - bulk buyer' },
  { name: 'Kavita Bhen', phone: '+91 9988776608', village: 'Mandvi', dailyQuantity: 1, ratePerLiter: 62, deliveryTime: 'morning' },
];
const customerIds = [];
for (const c of customerData) {
  const existing = await Customer.findOne({ farmId, name: c.name });
  if (existing) { customerIds.push(existing._id); console.log(`  Customer ${c.name} already exists, skipping`); continue; }
  const doc = await Customer.create({ farmId, ...c });
  customerIds.push(doc._id);
}
console.log(`✅ Customers: ${customerIds.length} records`);

// ═══════════════════════════════════════
// 10. MILK DELIVERIES (7 days of deliveries)
// ═══════════════════════════════════════
let deliveryCount = 0;
for (let day = 0; day < 7; day++) {
  const date = new Date(d(day).toDateString());
  for (const custId of customerIds) {
    const cust = await Customer.findById(custId);
    if (!cust) continue;
    const sessions = cust.deliveryTime === 'both' ? ['morning', 'evening'] : [cust.deliveryTime || 'morning'];
    for (const session of sessions) {
      const existing = await MilkDelivery.findOne({ farmId, customerId: custId, date, session });
      if (existing) continue;
      const qty = +(cust.dailyQuantity + (Math.random() * 0.4 - 0.2)).toFixed(1);
      await MilkDelivery.create({ farmId, customerId: custId, date, quantity: qty, ratePerLiter: cust.ratePerLiter, amount: qty * cust.ratePerLiter, session });
      deliveryCount++;
    }
  }
}
console.log(`✅ Milk Deliveries: ${deliveryCount} records`);

// ═══════════════════════════════════════
// 11. INSURANCE (7)
// ═══════════════════════════════════════
const insuranceData = [
  { cattleId: cattleIds[0], provider: 'National Insurance', policyNumber: 'NIC-2024-001', sumInsured: 80000, premium: 3200, startDate: d(200), endDate: d(-165), status: 'active', govtScheme: 'PMFBY' },
  { cattleId: cattleIds[1], provider: 'United India Insurance', policyNumber: 'UII-2024-045', sumInsured: 120000, premium: 4800, startDate: d(180), endDate: d(-185), status: 'active' },
  { cattleId: cattleIds[2], provider: 'National Insurance', policyNumber: 'NIC-2024-002', sumInsured: 70000, premium: 2800, startDate: d(150), endDate: d(-215), status: 'active', govtScheme: 'PMFBY' },
  { cattleId: cattleIds[3], provider: 'Oriental Insurance', policyNumber: 'OIC-2024-078', sumInsured: 90000, premium: 3600, startDate: d(100), endDate: d(-265), status: 'active' },
  { cattleId: cattleIds[4], provider: 'National Insurance', policyNumber: 'NIC-2024-003', sumInsured: 100000, premium: 4000, startDate: d(120), endDate: d(-245), status: 'active', govtScheme: 'State Dairy Scheme' },
  { cattleId: cattleIds[5], provider: 'United India Insurance', policyNumber: 'UII-2023-088', sumInsured: 85000, premium: 3400, startDate: d(400), endDate: d(35), status: 'expired' },
  { cattleId: cattleIds[8], provider: 'Oriental Insurance', policyNumber: 'OIC-2024-099', sumInsured: 150000, premium: 6000, startDate: d(90), endDate: d(-275), status: 'active', notes: 'Premium bull - higher sum insured' },
];
for (const ins of insuranceData) { await Insurance.create({ farmId, ...ins }); }
console.log(`✅ Insurance: ${insuranceData.length} records`);

console.log('\n🎉 All dummy data seeded successfully!');
console.log('Summary:');
console.log('  🐄 10 Cattle (5 milking, 1 pregnant, 1 dry, 1 heifer, 1 bull, 1 calf)');
console.log('  🥛 ~40 Milk Records (8 days × 5 cattle)');
console.log('  💉 10 Health Records (vaccinations, treatments, checkups, deworming)');
console.log('  🐣 8 Breeding Records (various statuses)');
console.log('  🌾 10 Feed Records');
console.log('  💸 10 Expenses');
console.log('  💰 10 Revenue Records');
console.log('  👷 8 Employees');
console.log('  🏘️ 8 Customers (Dudh Khata)');
console.log(`  🚚 ~${deliveryCount} Milk Deliveries (7 days)`);
console.log('  🛡️ 7 Insurance Policies');

await mongoose.disconnect();
process.exit(0);
