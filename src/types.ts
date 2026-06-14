export type Role = 'student' | 'teacher' | 'supervisor' | 'admin';

export interface Student {
  id: string;
  name: string;
  rollNo?: string;
  class: string;
  section: string;
  gender: 'Male' | 'Female';
  present: boolean;
}

export interface MealItem {
  name: string;
  category: 'Rice' | 'Dal' | 'Egg' | 'Vegetables' | 'Dessert' | 'Special';
  unit: 'kg' | 'units';
  perCapitaQuantity: number; // in kg or units per present student
}

export interface WeeklyMenu {
  day: string;
  items: string[];
  calories: string;
  protein: string;
  fiber: string;
  veggieTag: string;
  image: string;
}

export interface WastageEntry {
  item: string;
  prepared: number;
  consumed: number;
  remaining: number;
  wastePercentage: number;
  unit: string;
}

export interface DailyWastageReport {
  id: string;
  date: string;
  items: WastageEntry[];
  avgWastePercentage: number;
  mostWastedItem: string;
  mostWastedQty: number;
}

export interface StudentFeedback {
  id: string;
  date: string;
  studentName?: string;
  itemRatings: { [foodItem: string]: number }; // 1-5 stars
  serviceRatings: {
    taste: number;
    quality: number;
    temperature: number;
    behaviour: number;
    cleanliness: number;
  };
  comments: string;
}

export interface AttendanceReport {
  id: string;
  date: string;
  classStr: string;
  section: string;
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  attendancePercentage: number;
}

// Fixed Weekly Menu according to the instructions table
export const WEEKLY_MENU: WeeklyMenu[] = [
  {
    day: 'Monday',
    items: ['Rice', 'Egg Curry', 'Chikki'],
    calories: '640 kcal',
    protein: '24g',
    fiber: '8g',
    veggieTag: 'Local Egg tier',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=400'
  },
  {
    day: 'Tuesday',
    items: ['Pulihora', 'Tomato Dal', 'Boiled Egg'],
    calories: '610 kcal',
    protein: '22g',
    fiber: '6g',
    veggieTag: 'Traditional Sour Rice',
    image: 'https://images.unsplash.com/photo-1626509653506-af1227f7995f?auto=format&fit=crop&q=80&w=400'
  },
  {
    day: 'Wednesday',
    items: ['Vegetable Rice', 'Aloo Kurma', 'Boiled Egg', 'Chikki'],
    calories: '720 kcal',
    protein: '26g',
    fiber: '10g',
    veggieTag: 'High Fiber Mix',
    image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&q=80&w=400'
  },
  {
    day: 'Thursday',
    items: ['Khichdi', 'Tomato Chutney', 'Boiled Egg'],
    calories: '580 kcal',
    protein: '20g',
    fiber: '7g',
    veggieTag: 'Nutritious Lentils',
    image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&q=80&w=400'
  },
  {
    day: 'Friday',
    items: ['Rice', 'Dal', 'Boiled Egg', 'Chikki'],
    calories: '630 kcal',
    protein: '23g',
    fiber: '8g',
    veggieTag: 'Simple Protein',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=400'
  },
  {
    day: 'Saturday',
    items: ['Rice', 'Sambar', 'Sweet Pongal'],
    calories: '690 kcal',
    protein: '18g',
    fiber: '5g',
    veggieTag: 'Weekend Special',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=400'
  }
];

// Predefined ingredients per capita (present student) in kg or units:
export const MEAL_ITEMS: MealItem[] = [
  { name: 'Rice', category: 'Rice', unit: 'kg', perCapitaQuantity: 0.150 }, // 150g
  { name: 'Dal', category: 'Dal', unit: 'kg', perCapitaQuantity: 0.040 }, // 40g
  { name: 'Eggs', category: 'Egg', unit: 'units', perCapitaQuantity: 1.0 }, // 1 egg
  { name: 'Vegetables', category: 'Vegetables', unit: 'kg', perCapitaQuantity: 0.080 }, // 80g
  { name: 'Chikki', category: 'Dessert', unit: 'units', perCapitaQuantity: 1.0 } // 1 unit
];

// Initial classroom students
export const INITIAL_STUDENTS: Student[] = [];

// Historical Wastage reports
export const INITIAL_WASTAGE_REPORTS: DailyWastageReport[] = [];

// Historical Feedback from students
export const INITIAL_FEEDBACK_LIST: StudentFeedback[] = [];

// Historical daily attendance metrics
export const HISTORICAL_ATTENDANCE: Array<{ date: string; attendancePercentage: number }> = [];
