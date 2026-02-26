import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AppConfigContext = createContext(null);

const DEFAULTS = {
  employeeRoles: ['Milker', 'Feeder', 'Cleaner', 'Manager', 'Helper', 'Driver', 'Veterinary', 'Other'],
  cattleCategories: ['milking', 'dry', 'heifer', 'calf', 'bull', 'pregnant'],
  cattleBreeds: ['Holstein Friesian', 'Sahiwal', 'Gir', 'Murrah', 'Jersey', 'Red Sindhi', 'Tharparkar', 'Hariana', 'Rathi', 'Kankrej', 'Crossbred', 'Other'],
  healthRecordTypes: ['vaccination', 'treatment', 'checkup', 'deworming'],
  expenseCategories: ['feed', 'medicine', 'equipment', 'salary', 'transport', 'maintenance', 'other'],
  revenueCategories: ['milk_sale', 'cattle_sale', 'manure_sale', 'other'],
  feedTypes: ['Green Fodder', 'Dry Hay', 'Silage', 'Concentrate', 'Cotton Seed', 'Mustard Cake', 'Wheat Bran', 'Rice Bran', 'Mineral Mix', 'Other'],
  paymentMethods: ['cash', 'upi', 'bank', 'other'],
  milkDeliverySessions: ['morning', 'evening'],
  // Feature toggles
  chatBubbleEnabled: true,
  // Module toggles (admin can disable specific farm modules)
  modulesEnabled: {
    cattle: true, milk: true, health: true, breeding: true, feed: true,
    finance: true, milkDelivery: true, employees: true, insurance: true,
    reports: true, chatbot: true,
  },
};

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/app-config');
      setConfig({ ...DEFAULTS, ...res.data.data });
    } catch {
      // Use defaults if API fails
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  return (
    <AppConfigContext.Provider value={{ ...config, loaded, refetch: fetchConfig }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export const useAppConfig = () => {
  const ctx = useContext(AppConfigContext);
  if (!ctx) return DEFAULTS;
  return ctx;
};
